import { EventEmitter } from 'events';
import * as recorder from 'node-record-lpcm16';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types';
const VAD = require('webrtcvad');

interface AudioChunk {
  buffer: Buffer;
  timestamp: Date;
  duration: number;
}

/**
 * Audio Capture Service with WebRTC Voice Activity Detection
 * Continuously monitors microphone and automatically transcribes speech
 */
export class AudioCaptureService extends EventEmitter {
  private config: Config;
  private isRecording: boolean = false;
  private isSpeaking: boolean = false;
  private tempDir: string;
  private micStream: any = null;
  private vad: any = null;
  private audioLevel: number = 0;

  // Speech detection state
  private speechBuffer: Buffer[] = [];
  private silenceFrames: number = 0;
  private speechFrames: number = 0;
  private recordingStartTime: Date | null = null;

  // VAD configuration
  private readonly SAMPLE_RATE = 16000;
  private readonly FRAME_DURATION_MS = 30; // 30ms frames
  private readonly FRAME_SIZE = (this.SAMPLE_RATE * this.FRAME_DURATION_MS) / 1000; // 480 samples
  private readonly FRAME_SIZE_BYTES = this.FRAME_SIZE * 2; // 960 bytes (16-bit)
  private readonly SPEECH_START_FRAMES = 3; // Frames of speech to start recording
  private readonly SILENCE_END_FRAMES = 10; // Frames of silence to end recording
  private readonly VAD_MODE = 3; // 0-3, 3 is most aggressive

  private audioBuffer: Buffer = Buffer.alloc(0);

  constructor(config: Config) {
    super();
    this.config = config;
    this.tempDir = path.join(process.cwd(), 'temp', 'audio-capture');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Start continuous audio capture with WebRTC VAD
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.log('[AudioCapture] Already recording');
      return;
    }

    console.log('[AudioCapture] Starting microphone capture with WebRTC VAD...');

    try {
      // Initialize WebRTC VAD
      this.vad = new VAD(this.SAMPLE_RATE, this.VAD_MODE);
      console.log(`[AudioCapture] VAD initialized (mode: ${this.VAD_MODE}, sample rate: ${this.SAMPLE_RATE}Hz)`);

      // Start microphone capture
      this.micStream = recorder.record({
        sampleRate: this.SAMPLE_RATE,
        channels: 1,
        audioType: 'raw',
        recorder: 'sox',
        silence: '0', // Disable sox's silence detection, we use VAD
      }).stream();

      // Process audio chunks
      this.micStream.on('data', (chunk: Buffer) => {
        this.processAudioChunk(chunk);
      });

      this.micStream.on('error', (error: Error) => {
        console.error('[AudioCapture] Microphone stream error:', error);
        this.emit('error', error);
      });

      this.isRecording = true;
      this.emit('started');
      console.log('[AudioCapture] Microphone capture started');
      console.log('[AudioCapture] Listening for speech...');
    } catch (error) {
      console.error('[AudioCapture] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
  async stop(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    console.log('[AudioCapture] Stopping microphone capture...');

    // Stop microphone
    if (this.micStream) {
      this.micStream.removeAllListeners();
      recorder.stop();
      this.micStream = null;
    }

    // Clean up VAD
    this.vad = null;

    // Reset state
    this.isRecording = false;
    this.audioBuffer = Buffer.alloc(0);
    this.speechBuffer = [];
    this.isSpeaking = false;
    this.silenceFrames = 0;
    this.speechFrames = 0;

    this.emit('stopped');
    console.log('[AudioCapture] Stopped');
  }

  /**
   * Process audio chunks and run VAD
   */
  private processAudioChunk(chunk: Buffer): void {
    // Add to buffer
    this.audioBuffer = Buffer.concat([this.audioBuffer, chunk]);

    // Update audio level for visualization
    this.updateAudioLevel(chunk);

    // Process complete frames
    while (this.audioBuffer.length >= this.FRAME_SIZE_BYTES) {
      // Extract one frame
      const frame = this.audioBuffer.subarray(0, this.FRAME_SIZE_BYTES);
      this.audioBuffer = this.audioBuffer.subarray(this.FRAME_SIZE_BYTES);

      // Run VAD on this frame
      this.processFrame(frame);
    }
  }

  /**
   * Process a single audio frame with VAD
   */
  private processFrame(frame: Buffer): void {
    try {
      // Check if frame contains speech
      const isSpeech = this.vad.process(frame);

      if (isSpeech) {
        this.speechFrames++;
        this.silenceFrames = 0;

        // Start recording if we have enough speech frames
        if (!this.isSpeaking && this.speechFrames >= this.SPEECH_START_FRAMES) {
          this.handleSpeechStart();
        }

        // Always add speech frames to buffer when speaking
        if (this.isSpeaking) {
          this.speechBuffer.push(frame);
        }
      } else {
        this.silenceFrames++;
        this.speechFrames = 0;

        // Continue adding frames during silence (for context)
        if (this.isSpeaking) {
          this.speechBuffer.push(frame);

          // End recording if we have enough silence
          if (this.silenceFrames >= this.SILENCE_END_FRAMES) {
            this.handleSpeechEnd();
          }
        }
      }
    } catch (error) {
      console.error('[AudioCapture] Error processing frame:', error);
    }
  }

  /**
   * Handle speech start event
   */
  private handleSpeechStart(): void {
    this.isSpeaking = true;
    this.recordingStartTime = new Date();
    this.speechBuffer = [];
    this.silenceFrames = 0;

    console.log('[AudioCapture] 🎤 Speech detected, recording...');
    this.emit('speechStart');
  }

  /**
   * Handle speech end event
   */
  private async handleSpeechEnd(): Promise<void> {
    if (!this.recordingStartTime) {
      return;
    }

    const duration = Date.now() - this.recordingStartTime.getTime();
    console.log(`[AudioCapture] 🔇 Speech ended (${(duration / 1000).toFixed(1)}s)`);

    this.isSpeaking = false;

    // Combine all speech frames into one buffer
    const audioData = Buffer.concat(this.speechBuffer);

    // Save to WAV file
    const audioFile = await this.saveAudioChunk(audioData);

    // Emit event with audio file path
    this.emit('speechEnd', {
      filePath: audioFile,
      duration,
      timestamp: this.recordingStartTime,
    });

    // Reset state
    this.speechBuffer = [];
    this.silenceFrames = 0;
    this.speechFrames = 0;
    this.recordingStartTime = null;
  }

  /**
   * Update audio level for visualization
   */
  private updateAudioLevel(audioData: Buffer): void {
    // Calculate RMS (Root Mean Square) for audio level
    let sum = 0;
    const samples = audioData.length / 2; // 16-bit samples

    for (let i = 0; i < audioData.length; i += 2) {
      const sample = audioData.readInt16LE(i) / 32768.0; // Normalize to -1.0 to 1.0
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / samples);
    this.audioLevel = Math.min(100, Math.floor(rms * 300));
  }

  /**
   * Save audio chunk to WAV file
   */
  private async saveAudioChunk(audioData: Buffer): Promise<string> {
    const fileName = `speech-${Date.now()}.wav`;
    const filePath = path.join(this.tempDir, fileName);

    // Create WAV header (16kHz, 16-bit, mono)
    const sampleRate = this.SAMPLE_RATE;
    const numChannels = 1;
    const bitsPerSample = 16;

    const header = this.createWavHeader(
      audioData.length,
      sampleRate,
      numChannels,
      bitsPerSample
    );

    // Combine header and audio data
    const wavFile = Buffer.concat([header, audioData]);

    // Write to file
    fs.writeFileSync(filePath, wavFile);

    console.log(`[AudioCapture] Saved audio: ${filePath}`);
    return filePath;
  }

  /**
   * Create WAV file header
   */
  private createWavHeader(
    dataLength: number,
    sampleRate: number,
    numChannels: number,
    bitsPerSample: number
  ): Buffer {
    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // audio format (1 = PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byte rate
    header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // block align
    header.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);

    return header;
  }

  /**
   * Get current audio level (0-100)
   */
  getAudioLevel(): number {
    return this.audioLevel;
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Check if recording is active
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Clean up old audio files
   */
  async cleanup(olderThanMinutes: number = 30): Promise<void> {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const cutoff = olderThanMinutes * 60 * 1000;

      let deleted = 0;
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }

      if (deleted > 0) {
        console.log(`[AudioCapture] Cleaned up ${deleted} old audio files`);
      }
    } catch (error) {
      console.error('[AudioCapture] Error during cleanup:', error);
    }
  }
}
