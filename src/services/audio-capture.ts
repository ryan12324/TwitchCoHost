import { EventEmitter } from 'events';
import { MicVAD, NonRealTimeVAD } from '@ricky0123/vad-node';
import * as recorder from 'node-record-lpcm16';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types';

interface AudioChunk {
  buffer: Buffer;
  timestamp: Date;
  duration: number;
}

/**
 * Audio Capture Service with Voice Activity Detection
 * Continuously monitors microphone and automatically transcribes speech
 */
export class AudioCaptureService extends EventEmitter {
  private config: Config;
  private isRecording: boolean = false;
  private audioBuffer: Buffer[] = [];
  private recordingStartTime: Date | null = null;
  private tempDir: string;
  private vad: MicVAD | null = null;
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
   * Start continuous audio capture with VAD
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.log('[AudioCapture] Already recording');
      return;
    }

    console.log('[AudioCapture] Starting microphone capture with VAD...');

    try {
      // Initialize VAD
      this.vad = await MicVAD.new({
        // Sensitivity: lower = more sensitive
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.5,
        // How much audio to buffer before/after speech
        redemptionFrames: 8,
        // Sample rate (16kHz is optimal for Whisper)
        frameSamples: 1536,

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

    if (this.vad) {
      this.vad.pause();
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
