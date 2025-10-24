import { spawn } from 'child_process';
import { Config, TranscriptionResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class WhisperService {
  private config: Config;
  private tempDir: string;

  constructor(config: Config) {
    this.config = config;
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async transcribe(audioFilePath: string): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      // Validate input file exists
      if (!fs.existsSync(audioFilePath)) {
        reject(new Error(`Audio file not found: ${audioFilePath}`));
        return;
      }

      // Prepare output file
      const outputFile = path.join(this.tempDir, `transcription-${Date.now()}.txt`);

      // Run whisper.cpp
      const args = [
        '-m', this.config.whisper.modelPath,
        '-f', audioFilePath,
        '-otxt',
        '-of', outputFile.replace('.txt', ''), // whisper.cpp adds .txt
      ];

      console.log(`Running Whisper CPP: ${this.config.whisper.cppPath} ${args.join(' ')}`);

      const whisperProcess = spawn(this.config.whisper.cppPath, args);

      let stderr = '';

      whisperProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      whisperProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Whisper CPP exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Read the transcription
          const transcription = fs.readFileSync(outputFile, 'utf-8').trim();

          // Clean up
          if (fs.existsSync(outputFile)) {
            fs.unlinkSync(outputFile);
          }

          resolve({
            text: transcription,
          });
        } catch (error) {
          reject(error);
        }
      });

      whisperProcess.on('error', (error) => {
        reject(new Error(`Failed to start Whisper CPP: ${error.message}`));
      });
    });
  }

  async transcribeBuffer(audioBuffer: Buffer, format: string = 'wav'): Promise<TranscriptionResult> {
    // Save buffer to temp file
    const tempFile = path.join(this.tempDir, `audio-${Date.now()}.${format}`);

    try {
      fs.writeFileSync(tempFile, audioBuffer);
      const result = await this.transcribe(tempFile);

      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }

      return result;
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw error;
    }
  }

  isAvailable(): boolean {
    return (
      fs.existsSync(this.config.whisper.cppPath) &&
      fs.existsSync(this.config.whisper.modelPath)
    );
  }
}
