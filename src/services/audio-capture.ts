import { EventEmitter } from 'events';
import { RealTimeVAD } from '@ericedouard/vad-node-realtime';
import * as recorder from 'node-record-lpcm16';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types';
import { Readable } from 'stream';

interface AudioChunk {
  buffer: Buffer;
  timestamp: Date;
  duration: number;
}

/**
 * Audio Capture Service with Real-Time Voice Activity Detection
 * Continuously monitors microphone and automatically transcribes speech
 */
export class AudioCaptureService extends EventEmitter {
  private config: Config;
  private isRecording: boolean = false;
  private audioBuffer: Float32Array[] = [];
  private recordingStartTime: Date | null = null;
  private tempDir: string;
  private vad: any = null; // RealTimeVAD instance
  private micStream: Readable | null = null;
  private audioLevel: number = 0;
  private isSpeaking: boolean = false;

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
   * Start continuous audio capture with Real-Time VAD
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.log('[AudioCapture] Already recording');
      return;
    }

    console.log('[AudioCapture] Starting microphone capture with Real-Time VAD...');

    try {
      // Initialize Real-Time VAD
      this.vad = await RealTimeVAD.new({
        // Sample rate (16kHz is optimal for Whisper)
        sampleRate: 16000,

        // Sensitivity thresholds
        positiveSpeechThreshold: 0.6,
        negativeSpeechThreshold: 0.4,
        minSpeechFrames: 4,

        onSpeechStart: () => {
          this.handleSpeechStart();
        },

        onSpeechEnd: (audio: Float32Array) => {
          this.handleSpeechEnd(audio);
        },

        onVADMisfire: () => {
          console.log('[AudioCapture] VAD misfire - ignoring short audio');
        },
      });

      // Start VAD processing
      this.vad.start();

      // Start microphone capture
      this.micStream = recorder.record({
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw',
        recorder: 'sox', // or 'rec' on Linux, 'sox' on Mac/Windows
        silence: '0', // Disable automatic silence detection (VAD handles this)
      }).stream();

      // Process audio chunks from microphone
      this.micStream.on('data', async (chunk: Buffer) => {
        // Convert Int16 PCM buffer to Float32Array
        const float32Audio = this.int16ToFloat32(chunk);

        // Feed to Real-Time VAD
        if (this.vad) {
          await this.vad.processAudio(float32Audio);
        }

        // Update audio level for visualization
        this.updateAudioLevel(float32Audio);
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

    // Stop microphone stream
    if (this.micStream) {
      this.micStream.removeAllListeners();
      recorder.stop();
      this.micStream = null;
    }

    // Flush and destroy VAD
    if (this.vad) {
      try {
        await this.vad.flush();
        this.vad.destroy();
      } catch (error) {
        console.error('[AudioCapture] Error stopping VAD:', error);
      }
      this.vad = null;
    }

    this.isRecording = false;
    this.audioBuffer = [];
    this.isSpeaking = false;
    this.emit('stopped');
    console.log('[AudioCapture] Stopped');
  }

  /**
   * Handle speech start event
   */
  private handleSpeechStart(): void {
    this.isSpeaking = true;
    this.recordingStartTime = new Date();
    this.audioBuffer = [];

    console.log('[AudioCapture] 🎤 Speech detected, recording...');
    this.emit('speechStart');
  }

  /**
   * Handle speech end event
   */
  private async handleSpeechEnd(audio: Float32Array): Promise<void> {
    this.isSpeaking = false;

    if (!this.recordingStartTime) {
      return;
    }

    const duration = Date.now() - this.recordingStartTime.getTime();
    console.log(`[AudioCapture] 🔇 Speech ended (${(duration / 1000).toFixed(1)}s)`);

    // Convert Float32Array to Buffer (16-bit PCM)
    const audioBuffer = this.float32ToInt16(audio);

    // Save to WAV file
    const audioFile = await this.saveAudioChunk(audioBuffer);

    // Emit event with audio file path
    this.emit('speechEnd', {
      filePath: audioFile,
      duration,
      timestamp: this.recordingStartTime,
    });

    this.recordingStartTime = null;
  }

  /**
   * Convert Int16 PCM Buffer to Float32Array
   */
  private int16ToFloat32(buffer: Buffer): Float32Array {
    const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
      // Normalize int16 (-32768 to 32767) to float32 (-1.0 to 1.0)
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
    }

    return float32Array;
  }

  /**
   * Convert Float32Array to 16-bit PCM Buffer
   */
  private float32ToInt16(float32Array: Float32Array): Buffer {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return Buffer.from(int16Array.buffer);
  }

  /**
   * Update audio level for visualization
   */
  private updateAudioLevel(audioData: Float32Array): void {
    // Calculate RMS (Root Mean Square) for audio level
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);

    // Convert to 0-100 scale (with some amplification for visibility)
    this.audioLevel = Math.min(100, Math.floor(rms * 300));
  }

  /**
   * Save audio chunk to WAV file
   */
  private async saveAudioChunk(audioData: Buffer): Promise<string> {
    const fileName = `speech-${Date.now()}.wav`;
    const filePath = path.join(this.tempDir, fileName);

    // Create WAV header (16kHz, 16-bit, mono)
    const sampleRate = 16000;
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
