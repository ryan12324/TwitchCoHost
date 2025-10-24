import { Config } from '../types';
import { spawn } from 'child_process';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export class TTSService {
  private config: Config;
  private audioDir: string;

  constructor(config: Config) {
    this.config = config;
    this.audioDir = path.join(process.cwd(), 'temp', 'audio');
    this.ensureAudioDir();
  }

  private ensureAudioDir(): void {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  async speak(text: string): Promise<string> {
    switch (this.config.tts.engine) {
      case 'elevenlabs':
        return this.speakElevenLabs(text);
      case 'system':
        return this.speakSystem(text);
      case 'browser':
      default:
        return this.speakBrowser(text);
    }
  }

  private async speakElevenLabs(text: string): Promise<string> {
    if (!this.config.tts.elevenlabsApiKey || !this.config.tts.elevenlabsVoiceId) {
      throw new Error('ElevenLabs API key and voice ID required');
    }

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.config.tts.elevenlabsVoiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.config.tts.elevenlabsApiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      // Save audio file
      const audioFile = path.join(this.audioDir, `tts-${Date.now()}.mp3`);
      fs.writeFileSync(audioFile, response.data);

      console.log(`[TTS] ElevenLabs audio saved: ${audioFile}`);
      return audioFile;
    } catch (error) {
      console.error('[TTS] ElevenLabs error:', error);
      throw error;
    }
  }

  private async speakSystem(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use system TTS (works on macOS/Linux with 'say' or 'espeak')
      const isMac = process.platform === 'darwin';
      const command = isMac ? 'say' : 'espeak';
      const args = isMac ? [text] : [text, '--stdout'];

      const audioFile = path.join(this.audioDir, `tts-${Date.now()}.wav`);

      if (isMac) {
        // macOS 'say' command
        const sayProcess = spawn(command, args);

        sayProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`[TTS] System TTS completed`);
            resolve(audioFile);
          } else {
            reject(new Error(`TTS failed with code ${code}`));
          }
        });

        sayProcess.on('error', (error) => {
          reject(new Error(`Failed to run TTS: ${error.message}`));
        });
      } else {
        // Linux espeak - save to file
        const espeakProcess = spawn(command, [...args, '-w', audioFile]);

        espeakProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`[TTS] System TTS saved: ${audioFile}`);
            resolve(audioFile);
          } else {
            reject(new Error(`TTS failed with code ${code}`));
          }
        });

        espeakProcess.on('error', (error) => {
          reject(new Error(`Failed to run TTS: ${error.message}`));
        });
      }
    });
  }

  private async speakBrowser(text: string): Promise<string> {
    // For browser-based TTS, we just return the text
    // This would typically be handled by a web interface
    console.log(`[TTS] Browser mode - text to speak: "${text}"`);
    return text;
  }

  async speakAsync(text: string): Promise<void> {
    // Fire and forget version
    this.speak(text).catch(error => {
      console.error('[TTS] Error during speech:', error);
    });
  }
}
