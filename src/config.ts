import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

export function loadConfig(): Config {
  const required = [
    'ANTHROPIC_API_KEY',
    'TWITCH_CHANNEL',
    'TWITCH_BOT_USERNAME',
    'TWITCH_OAUTH_TOKEN',
    'OBS_WEBSOCKET_URL',
    'WHISPER_CPP_PATH',
    'WHISPER_MODEL_PATH',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
    },
    twitch: {
      channel: process.env.TWITCH_CHANNEL!,
      botUsername: process.env.TWITCH_BOT_USERNAME!,
      oauthToken: process.env.TWITCH_OAUTH_TOKEN!,
    },
    obs: {
      websocketUrl: process.env.OBS_WEBSOCKET_URL!,
      password: process.env.OBS_WEBSOCKET_PASSWORD || '',
    },
    whisper: {
      cppPath: process.env.WHISPER_CPP_PATH!,
      modelPath: process.env.WHISPER_MODEL_PATH!,
    },
    tts: {
      engine: (process.env.TTS_ENGINE as any) || 'browser',
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
      elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID,
    },
    memory: {
      maxMessages: parseInt(process.env.MEMORY_MAX_MESSAGES || '50'),
      contextWindow: parseInt(process.env.MEMORY_CONTEXT_WINDOW || '20'),
    },
    cohost: {
      name: process.env.COHOST_NAME || 'CoHost',
      personality: process.env.COHOST_PERSONALITY || 'friendly and helpful AI assistant',
      responseCooldown: parseInt(process.env.RESPONSE_COOLDOWN_MS || '3000'),
    },
  };
}
