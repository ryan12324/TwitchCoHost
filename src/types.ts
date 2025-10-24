export interface Config {
  anthropic: {
    apiKey: string;
  };
  twitch: {
    channel: string;
    botUsername: string;
    oauthToken: string;
  };
  obs: {
    websocketUrl: string;
    password: string;
  };
  whisper: {
    cppPath: string;
    modelPath: string;
  };
  tts: {
    engine: 'browser' | 'system' | 'elevenlabs';
    elevenlabsApiKey?: string;
    elevenlabsVoiceId?: string;
  };
  memory: {
    maxMessages: number;
    contextWindow: number;
  };
  cohost: {
    name: string;
    personality: string;
    responseCooldown: number;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  source?: 'chat' | 'voice' | 'system';
  username?: string;
}

export interface ChatMessage {
  username: string;
  message: string;
  timestamp: Date;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
}

export interface OBSScene {
  sceneName: string;
  sceneIndex: number;
}

export interface OBSSource {
  sourceName: string;
  sourceKind: string;
}

export enum OBSCommand {
  SWITCH_SCENE = 'switch_scene',
  TOGGLE_SOURCE = 'toggle_source',
  SET_TEXT = 'set_text',
  START_STREAM = 'start_stream',
  STOP_STREAM = 'stop_stream',
  START_RECORDING = 'start_recording',
  STOP_RECORDING = 'stop_recording',
}
