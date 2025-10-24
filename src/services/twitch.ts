import tmi from 'tmi.js';
import { Config, ChatMessage } from '../types';
import { EventEmitter } from 'events';

export class TwitchChatService extends EventEmitter {
  private client: tmi.Client | null = null;
  private config: Config;
  private connected: boolean = false;

  constructor(config: Config) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const options: tmi.Options = {
      options: { debug: false },
      connection: {
        reconnect: true,
        secure: true,
      },
      identity: {
        username: this.config.twitch.botUsername,
        password: this.config.twitch.oauthToken,
      },
      channels: [this.config.twitch.channel],
    };

    this.client = new tmi.Client(options);

    // Set up event handlers
    this.client.on('connected', (address, port) => {
      this.connected = true;
      console.log(`[Twitch] Connected to ${address}:${port}`);
      this.emit('connected');
    });

    this.client.on('disconnected', (reason) => {
      this.connected = false;
      console.log(`[Twitch] Disconnected: ${reason}`);
      this.emit('disconnected', reason);
    });

    this.client.on('message', (channel, tags, message, self) => {
      // Ignore messages from the bot itself
      if (self) return;

      const chatMessage: ChatMessage = {
        username: tags['display-name'] || tags.username || 'Unknown',
        message: message.trim(),
        timestamp: new Date(),
      };

      console.log(`[Twitch] ${chatMessage.username}: ${chatMessage.message}`);
      this.emit('message', chatMessage);
    });

    this.client.on('subscription', (channel, username, method, message, tags) => {
      console.log(`[Twitch] New subscription from ${username}`);
      this.emit('subscription', { username, method, message });
    });

    this.client.on('cheer', (channel, tags, message) => {
      const username = tags['display-name'] || tags.username || 'Unknown';
      const bits = tags.bits || '0';
      console.log(`[Twitch] ${username} cheered ${bits} bits`);
      this.emit('cheer', { username, bits, message });
    });

    this.client.on('raided', (channel, username, viewers) => {
      console.log(`[Twitch] Raided by ${username} with ${viewers} viewers`);
      this.emit('raid', { username, viewers });
    });

    try {
      await this.client.connect();
    } catch (error) {
      console.error('[Twitch] Failed to connect:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.disconnect();
      this.connected = false;
      console.log('[Twitch] Disconnected');
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to Twitch');
    }

    try {
      await this.client.say(this.config.twitch.channel, message);
      console.log(`[Twitch] Sent: ${message}`);
    } catch (error) {
      console.error('[Twitch] Failed to send message:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getChannel(): string {
    return this.config.twitch.channel;
  }
}
