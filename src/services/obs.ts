import OBSWebSocket from 'obs-websocket-js';
import { Config, OBSCommand } from '../types';

export class OBSController {
  private obs: OBSWebSocket;
  private config: Config;
  private connected: boolean = false;

  constructor(config: Config) {
    this.config = config;
    this.obs = new OBSWebSocket();
  }

  async connect(): Promise<void> {
    try {
      const url = this.config.obs.websocketUrl;
      const password = this.config.obs.password;

      console.log(`[OBS] Connecting to ${url}...`);

      await this.obs.connect(url, password);
      this.connected = true;

      console.log('[OBS] Connected successfully');

      // Set up event listeners
      this.obs.on('ConnectionClosed', () => {
        console.log('[OBS] Connection closed');
        this.connected = false;
      });

      this.obs.on('ConnectionError', (error) => {
        console.error('[OBS] Connection error:', error);
        this.connected = false;
      });
    } catch (error) {
      console.error('[OBS] Failed to connect:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.obs.disconnect();
      this.connected = false;
      console.log('[OBS] Disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async switchScene(sceneName: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    try {
      await this.obs.call('SetCurrentProgramScene', {
        sceneName,
      });
      console.log(`[OBS] Switched to scene: ${sceneName}`);
    } catch (error) {
      console.error(`[OBS] Failed to switch scene:`, error);
      throw error;
    }
  }

  async getCurrentScene(): Promise<string> {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    try {
      const response = await this.obs.call('GetCurrentProgramScene');
      return response.currentProgramSceneName;
    } catch (error) {
      console.error('[OBS] Failed to get current scene:', error);
      throw error;
    }
  }

  async listScenes(): Promise<string[]> {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    try {
      const response = await this.obs.call('GetSceneList');
      return response.scenes.map((scene: any) => scene.sceneName);
    } catch (error) {
      console.error('[OBS] Failed to list scenes:', error);
      throw error;
    }
  }

  async toggleSource(sourceName: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    try {
      const currentScene = await this.getCurrentScene();
      const response = await this.obs.call('GetSceneItemId', {
        sceneName: currentScene,
        sourceName,
      });

      const sceneItemId = response.sceneItemId;

      // Get current visibility
      const itemResponse = await this.obs.call('GetSceneItemEnabled', {
        sceneName: currentScene,
        sceneItemId,
      });

      const newState = !itemResponse.sceneItemEnabled;

      // Toggle
      await this.obs.call('SetSceneItemEnabled', {
        sceneName: currentScene,
        sceneItemId,
        sceneItemEnabled: newState,
      });

      console.log(`[OBS] Toggled source "${sourceName}" to ${newState ? 'visible' : 'hidden'}`);
    } catch (error) {
      console.error(`[OBS] Failed to toggle source:`, error);
      throw error;
    }
  }

  async setSourceVisibility(
    sourceName: string,
    visible: boolean
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    try {
      const currentScene = await this.getCurrentScene();
      const response = await this.obs.call('GetSceneItemId', {
        sceneName: currentScene,
        sourceName,
      });

      const sceneItemId = response.sceneItemId;

      await this.obs.call('SetSceneItemEnabled', {
        sceneName: currentScene,
        sceneItemId,
        sceneItemEnabled: visible,
      });

      console.log(`[OBS] Set source "${sourceName}" to ${visible ? 'visible' : 'hidden'}`);
    } catch (error) {
      console.error(`[OBS] Failed to set source visibility:`, error);
      throw error;
    }
  }

  async startStreaming(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    try {
      await this.obs.call('StartStream');
      console.log('[OBS] Started streaming');
    } catch (error) {
      console.error('[OBS] Failed to start streaming:', error);
      throw error;
    }
  }

  async stopStreaming(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    try {
      await this.obs.call('StopStream');
      console.log('[OBS] Stopped streaming');
    } catch (error) {
      console.error('[OBS] Failed to stop streaming:', error);
      throw error;
    }
  }

  async startRecording(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    try {
      await this.obs.call('StartRecord');
      console.log('[OBS] Started recording');
    } catch (error) {
      console.error('[OBS] Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS');
    }

    try {
      await this.obs.call('StopRecord');
      console.log('[OBS] Stopped recording');
    } catch (error) {
      console.error('[OBS] Failed to stop recording:', error);
      throw error;
    }
  }

  async executeCommand(command: string, parameter?: string): Promise<void> {
    switch (command) {
      case 'switch_scene':
        if (parameter) {
          await this.switchScene(parameter);
        }
        break;
      case 'show_source':
        if (parameter) {
          await this.setSourceVisibility(parameter, true);
        }
        break;
      case 'hide_source':
        if (parameter) {
          await this.setSourceVisibility(parameter, false);
        }
        break;
      case 'toggle_source':
        if (parameter) {
          await this.toggleSource(parameter);
        }
        break;
      case 'start_stream':
        await this.startStreaming();
        break;
      case 'stop_stream':
        await this.stopStreaming();
        break;
      case 'start_recording':
        await this.startRecording();
        break;
      case 'stop_recording':
        await this.stopRecording();
        break;
      default:
        console.warn(`[OBS] Unknown command: ${command}`);
    }
  }
}
