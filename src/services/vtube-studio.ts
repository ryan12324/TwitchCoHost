import WebSocket from 'ws';
import { Config } from '../types';

interface VTubeStudioRequest {
  apiName: string;
  apiVersion: string;
  requestID: string;
  messageType: string;
  data?: any;
}

interface VTubeStudioResponse {
  apiName: string;
  apiVersion: string;
  timestamp: number;
  requestID: string;
  messageType: string;
  data: any;
}

interface Expression {
  file: string;
  name: string;
}

interface Hotkey {
  name: string;
  hotkeyID: string;
  type: string;
}

/**
 * VTube Studio API Controller
 * Controls avatar expressions, animations, and parameters via WebSocket
 */
export class VTubeStudioController {
  private ws: WebSocket | null = null;
  private config: Config;
  private connected: boolean = false;
  private authenticated: boolean = false;
  private authToken: string | null = null;
  private requestCounter: number = 0;
  private pendingRequests: Map<string, (response: any) => void> = new Map();
  private reconnectInterval: NodeJS.Timeout | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Connect to VTube Studio WebSocket API
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = this.config.vtubeStudio.websocketUrl;
        console.log(`[VTubeStudio] Connecting to ${url}...`);

        this.ws = new WebSocket(url);

        this.ws.on('open', async () => {
          console.log('[VTubeStudio] WebSocket connected');
          this.connected = true;

          // Authenticate
          try {
            await this.authenticate();
            console.log('[VTubeStudio] Authenticated successfully');
            resolve();
          } catch (error) {
            console.error('[VTubeStudio] Authentication failed:', error);
            reject(error);
          }
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('close', () => {
          console.log('[VTubeStudio] Connection closed');
          this.connected = false;
          this.authenticated = false;
          this.attemptReconnect();
        });

        this.ws.on('error', (error) => {
          console.error('[VTubeStudio] WebSocket error:', error);
          this.connected = false;
          reject(error);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from VTube Studio
   */
  async disconnect(): Promise<void> {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      this.authenticated = false;
      console.log('[VTubeStudio] Disconnected');
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectInterval) return;

    console.log('[VTubeStudio] Will attempt to reconnect in 5 seconds...');
    this.reconnectInterval = setTimeout(async () => {
      this.reconnectInterval = null;
      try {
        await this.connect();
      } catch (error) {
        console.error('[VTubeStudio] Reconnection failed:', error);
      }
    }, 5000);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: string): void {
    try {
      const response: VTubeStudioResponse = JSON.parse(message);

      // Handle pending request
      const callback = this.pendingRequests.get(response.requestID);
      if (callback) {
        callback(response);
        this.pendingRequests.delete(response.requestID);
      }
    } catch (error) {
      console.error('[VTubeStudio] Error parsing message:', error);
    }
  }

  /**
   * Send request to VTube Studio API
   */
  private async sendRequest(messageType: string, data?: any): Promise<any> {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected to VTube Studio');
    }

    return new Promise((resolve, reject) => {
      const requestID = `req_${this.requestCounter++}_${Date.now()}`;

      const request: VTubeStudioRequest = {
        apiName: 'VTubeStudioPublicAPI',
        apiVersion: '1.0',
        requestID,
        messageType,
        data: data || {},
      };

      // Set up response handler
      this.pendingRequests.set(requestID, (response) => {
        if (response.data.errorID) {
          reject(new Error(response.data.message || 'VTube Studio API error'));
        } else {
          resolve(response.data);
        }
      });

      // Send request
      this.ws!.send(JSON.stringify(request));

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestID)) {
          this.pendingRequests.delete(requestID);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Authenticate with VTube Studio
   */
  private async authenticate(): Promise<void> {
    // Request authentication token if we don't have one
    if (!this.authToken) {
      const authResponse = await this.sendRequest('AuthenticationTokenRequest', {
        pluginName: 'TwitchCoHost',
        pluginDeveloper: 'CoHost',
        pluginIcon: '',
      });

      this.authToken = authResponse.authenticationToken;
    }

    // Authenticate with token
    const authResult = await this.sendRequest('AuthenticationRequest', {
      pluginName: 'TwitchCoHost',
      pluginDeveloper: 'CoHost',
      authenticationToken: this.authToken,
    });

    if (authResult.authenticated) {
      this.authenticated = true;
    } else {
      throw new Error('Authentication failed');
    }
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  /**
   * Trigger a hotkey (animation, expression, etc.)
   */
  async triggerHotkey(hotkeyID: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to VTube Studio');
    }

    try {
      await this.sendRequest('HotkeyTriggerRequest', { hotkeyID });
      console.log(`[VTubeStudio] Triggered hotkey: ${hotkeyID}`);
    } catch (error) {
      console.error('[VTubeStudio] Failed to trigger hotkey:', error);
      throw error;
    }
  }

  /**
   * Get list of available hotkeys
   */
  async getHotkeys(): Promise<Hotkey[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to VTube Studio');
    }

    try {
      const response = await this.sendRequest('HotkeysInCurrentModelRequest');
      return response.availableHotkeys || [];
    } catch (error) {
      console.error('[VTubeStudio] Failed to get hotkeys:', error);
      return [];
    }
  }

  /**
   * Get list of available expressions
   */
  async getExpressions(): Promise<Expression[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to VTube Studio');
    }

    try {
      const response = await this.sendRequest('ExpressionStateRequest');
      return response.expressions || [];
    } catch (error) {
      console.error('[VTubeStudio] Failed to get expressions:', error);
      return [];
    }
  }

  /**
   * Activate an expression by file name
   */
  async activateExpression(expressionFile: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to VTube Studio');
    }

    try {
      await this.sendRequest('ExpressionActivationRequest', {
        expressionFile,
        active: true,
      });
      console.log(`[VTubeStudio] Activated expression: ${expressionFile}`);
    } catch (error) {
      console.error('[VTubeStudio] Failed to activate expression:', error);
      throw error;
    }
  }

  /**
   * Deactivate an expression
   */
  async deactivateExpression(expressionFile: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to VTube Studio');
    }

    try {
      await this.sendRequest('ExpressionActivationRequest', {
        expressionFile,
        active: false,
      });
      console.log(`[VTubeStudio] Deactivated expression: ${expressionFile}`);
    } catch (error) {
      console.error('[VTubeStudio] Failed to deactivate expression:', error);
      throw error;
    }
  }

  /**
   * Set a model parameter value
   */
  async setParameter(parameterName: string, value: number): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to VTube Studio');
    }

    try {
      await this.sendRequest('InjectParameterDataRequest', {
        parameterValues: [
          {
            id: parameterName,
            value: value,
          },
        ],
      });
      console.log(`[VTubeStudio] Set parameter ${parameterName} to ${value}`);
    } catch (error) {
      console.error('[VTubeStudio] Failed to set parameter:', error);
      throw error;
    }
  }

  /**
   * Get current model info
   */
  async getCurrentModel(): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to VTube Studio');
    }

    try {
      return await this.sendRequest('CurrentModelRequest');
    } catch (error) {
      console.error('[VTubeStudio] Failed to get current model:', error);
      throw error;
    }
  }

  /**
   * Trigger emotion-based expressions
   */
  async setEmotion(emotion: string): Promise<void> {
    // Map emotions to common expression names
    const emotionMap: Record<string, string[]> = {
      happy: ['happy', 'smile', 'joy', 'excited'],
      sad: ['sad', 'cry', 'tears', 'unhappy'],
      angry: ['angry', 'mad', 'annoyed'],
      surprised: ['surprised', 'shock', 'amazed'],
      confused: ['confused', 'puzzled', 'thinking'],
      neutral: ['neutral', 'default', 'idle'],
      love: ['love', 'heart', 'blush'],
      scared: ['scared', 'afraid', 'fear'],
    };

    const searchTerms = emotionMap[emotion.toLowerCase()] || [emotion.toLowerCase()];

    try {
      const expressions = await this.getExpressions();

      // Find matching expression
      for (const term of searchTerms) {
        const match = expressions.find(exp =>
          exp.name.toLowerCase().includes(term) ||
          exp.file.toLowerCase().includes(term)
        );

        if (match) {
          await this.activateExpression(match.file);
          return;
        }
      }

      console.log(`[VTubeStudio] No expression found for emotion: ${emotion}`);
    } catch (error) {
      console.error('[VTubeStudio] Failed to set emotion:', error);
    }
  }

  /**
   * Trigger animation by name
   */
  async triggerAnimation(animationName: string): Promise<void> {
    try {
      const hotkeys = await this.getHotkeys();

      // Find matching hotkey
      const match = hotkeys.find(hk =>
        hk.name.toLowerCase().includes(animationName.toLowerCase())
      );

      if (match) {
        await this.triggerHotkey(match.hotkeyID);
      } else {
        console.log(`[VTubeStudio] No hotkey found for animation: ${animationName}`);
      }
    } catch (error) {
      console.error('[VTubeStudio] Failed to trigger animation:', error);
    }
  }
}
