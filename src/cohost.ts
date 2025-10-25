import { Config, Message, ChatMessage } from './types';
import { ClaudeService } from './services/claude';
import { MemoryService } from './services/memory';
import { WhisperService } from './services/whisper';
import { TTSService } from './services/tts';
import { OBSController } from './services/obs';
import { TwitchChatService } from './services/twitch';
import { VTubeStudioController } from './services/vtube-studio';
import { AudioCaptureService } from './services/audio-capture';

export class CoHost {
  private config: Config;
  private claude: ClaudeService;
  private memory: MemoryService;
  private whisper: WhisperService;
  private tts: TTSService;
  private obs: OBSController;
  private twitch: TwitchChatService;
  private vtubeStudio: VTubeStudioController;
  private audioCapture: AudioCaptureService;
  private lastResponseTime: number = 0;
  private isProcessing: boolean = false;

  constructor(config: Config) {
    this.config = config;

    // Initialize services
    this.claude = new ClaudeService(config);
    this.memory = new MemoryService(config);
    this.whisper = new WhisperService(config);
    this.tts = new TTSService(config);
    this.obs = new OBSController(config);
    this.twitch = new TwitchChatService(config);
    this.vtubeStudio = new VTubeStudioController(config);
    this.audioCapture = new AudioCaptureService(config);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle Twitch chat messages
    this.twitch.on('message', (chatMessage: ChatMessage) => {
      this.handleChatMessage(chatMessage);
    });

    // Handle Twitch events
    this.twitch.on('subscription', (data: any) => {
      this.handleSpecialEvent('subscription', `${data.username} just subscribed!`);
    });

    this.twitch.on('cheer', (data: any) => {
      this.handleSpecialEvent('cheer', `${data.username} cheered ${data.bits} bits!`);
    });

    this.twitch.on('raid', (data: any) => {
      this.handleSpecialEvent('raid', `${data.username} raided with ${data.viewers} viewers!`);
    });

    // Handle audio capture events
    this.audioCapture.on('speechEnd', async (data: any) => {
      console.log('[CoHost] Processing voice input...');
      await this.processVoiceInput(data.filePath);
    });
  }

  async start(): Promise<void> {
    console.log(`\n🎬 Starting ${this.config.cohost.name}...\n`);

    // Initialize memory with LanceDB
    try {
      await this.memory.initialize();
      console.log('✅ Memory system initialized\n');
    } catch (error) {
      console.error('❌ Failed to initialize memory:', error);
      throw error;
    }

    // Connect to VTube Studio
    if (this.config.vtubeStudio.enabled) {
      try {
        await this.vtubeStudio.connect();
        console.log('✅ VTube Studio connected\n');
      } catch (error) {
        console.error('❌ Failed to connect to VTube Studio:', error);
        console.log('⚠️  Continuing without VTube Studio...\n');
      }
    }

    // Connect to OBS
    try {
      await this.obs.connect();
      console.log('✅ OBS connected\n');
    } catch (error) {
      console.error('❌ Failed to connect to OBS:', error);
      console.log('⚠️  Continuing without OBS...\n');
    }

    // Connect to Twitch
    try {
      await this.twitch.connect();
      console.log('✅ Twitch connected\n');
    } catch (error) {
      console.error('❌ Failed to connect to Twitch:', error);
      throw error;
    }

    // Check Whisper availability
    if (this.whisper.isAvailable()) {
      console.log('✅ Whisper CPP available\n');
    } else {
      console.log('⚠️  Whisper CPP not found at configured path\n');
    }

    console.log(`🤖 ${this.config.cohost.name} is now live!\n`);
    console.log('Commands:');
    console.log('  - Type messages to test Claude responses');
    console.log('  - Chat messages will be processed automatically');
    console.log('  - Use Ctrl+C to exit\n');
  }

  async stop(): Promise<void> {
    console.log(`\n👋 Shutting down ${this.config.cohost.name}...\n`);

    await this.twitch.disconnect();
    await this.obs.disconnect();
    if (this.config.vtubeStudio.enabled) {
      await this.vtubeStudio.disconnect();
    }

    console.log('Goodbye!\n');
  }

  private async handleChatMessage(chatMessage: ChatMessage): Promise<void> {
    // Check cooldown
    const now = Date.now();
    if (now - this.lastResponseTime < this.config.cohost.responseCooldown) {
      return;
    }

    // Always add to memory
    await this.memory.addMessage({
      role: 'user',
      content: `${chatMessage.username}: ${chatMessage.message}`,
      timestamp: chatMessage.timestamp,
      source: 'chat',
      username: chatMessage.username,
    });

    // Check if wake word is detected
    const hasWakeWord = this.detectWakeWord(chatMessage.message);

    if (this.config.cohost.wakeWordEnabled && hasWakeWord) {
      console.log(`[CoHost] Wake word detected! Responding to: "${chatMessage.message}"`);
      await this.processInput(
        chatMessage.message,
        'chat',
        chatMessage.username
      );
      return;
    }

    // If wake word is enabled but not detected, don't respond
    if (this.config.cohost.wakeWordEnabled && !hasWakeWord) {
      console.log(`[CoHost] No wake word in: "${chatMessage.message}" - skipping`);
      return;
    }

    // If smart response filter is enabled, use AI to decide
    if (this.config.cohost.smartResponseFilter) {
      const context = await this.memory.getContextSummary();
      const analysis = await this.claude.shouldRespond(chatMessage.message, context);

      console.log(
        `[CoHost] AI analysis: ${analysis.shouldRespond ? 'RESPOND' : 'SKIP'} - ${analysis.reason} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`
      );

      if (!analysis.shouldRespond) {
        return;
      }
    }

    // Respond to the message
    await this.processInput(
      chatMessage.message,
      'chat',
      chatMessage.username
    );
  }

  /**
   * Detect if a message contains the wake word
   */
  private detectWakeWord(message: string): boolean {
    const messageLower = message.toLowerCase();
    const wakeWord = this.config.cohost.wakeWord.toLowerCase();

    // Check for exact wake word match
    if (messageLower.includes(wakeWord)) {
      return true;
    }

    // Also check for bot name mentions
    if (messageLower.includes(this.config.cohost.name.toLowerCase())) {
      return true;
    }

    // Check for @mention
    if (messageLower.includes('@' + this.config.twitch.botUsername.toLowerCase())) {
      return true;
    }

    return false;
  }

  private async handleSpecialEvent(eventType: string, message: string): Promise<void> {
    console.log(`[Event] ${eventType}: ${message}`);

    // Add to memory
    await this.memory.addMessage({
      role: 'system',
      content: `[${eventType}] ${message}`,
      timestamp: new Date(),
      source: 'system',
    });

    // Generate a response to the event
    await this.processInput(
      `A special event happened: ${message}. Please acknowledge this briefly.`,
      'system'
    );
  }

  async processInput(
    input: string,
    source: 'chat' | 'voice' | 'system' = 'chat',
    username?: string
  ): Promise<void> {
    if (this.isProcessing) {
      console.log('[CoHost] Already processing, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      // Add user message to memory
      const userMessage: Message = {
        role: 'user',
        content: username ? `${username}: ${input}` : input,
        timestamp: new Date(),
        source,
        username,
      };

      await this.memory.addMessage(userMessage);

      // Get context with semantic relevance
      const context = await this.memory.getContextSummary(input);

      // Generate response
      console.log(`\n[CoHost] Generating response...`);
      const response = await this.claude.generateResponse(
        await this.memory.getRecentMessages(),
        context
      );

      console.log(`[CoHost] ${this.config.cohost.name}: ${response}\n`);

      // Add assistant response to memory
      await this.memory.addMessage({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        source: 'system',
      });

      // Analyze emotion and update avatar
      if (this.config.vtubeStudio.enabled && this.vtubeStudio.isConnected()) {
        const emotionAnalysis = this.claude.analyzeEmotion(response);
        console.log(
          `[CoHost] Detected emotion: ${emotionAnalysis.emotion} (confidence: ${(emotionAnalysis.confidence * 100).toFixed(0)}%)`
        );

        // Set avatar expression based on emotion
        try {
          await this.vtubeStudio.setEmotion(emotionAnalysis.emotion);

          // Trigger animation if suggested
          if (emotionAnalysis.animations && emotionAnalysis.animations.length > 0) {
            // Pick a random animation from suggestions
            const animation =
              emotionAnalysis.animations[
                Math.floor(Math.random() * emotionAnalysis.animations.length)
              ];
            await this.vtubeStudio.triggerAnimation(animation);
          }
        } catch (error) {
          console.error('[CoHost] Error controlling VTube Studio:', error);
        }
      }

      // Check for OBS commands
      if (this.obs.isConnected()) {
        const commandAnalysis = await this.claude.analyzeForOBSCommands(response);
        if (commandAnalysis.hasCommand && commandAnalysis.command) {
          console.log(
            `[CoHost] Executing OBS command: ${commandAnalysis.command} ${commandAnalysis.parameter || ''}`
          );
          await this.obs.executeCommand(
            commandAnalysis.command,
            commandAnalysis.parameter
          );
        }
      }

      // Send to Twitch chat if from chat
      if (source === 'chat' && this.twitch.isConnected()) {
        await this.twitch.sendMessage(response);
      }

      // Speak the response
      await this.tts.speakAsync(response);

      this.lastResponseTime = Date.now();
    } catch (error) {
      console.error('[CoHost] Error processing input:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processVoiceInput(audioFilePath: string): Promise<void> {
    try {
      console.log('[CoHost] Transcribing audio...');
      const transcription = await this.whisper.transcribe(audioFilePath);

      if (!transcription.text.trim()) {
        return;
      }

      console.log(`[Voice] Transcribed: "${transcription.text}"`);

      // Check for wake word in voice input
      const hasWakeWord = this.detectWakeWord(transcription.text);

      if (this.config.cohost.wakeWordEnabled && !hasWakeWord) {
        console.log(`[CoHost] No wake word in voice input - skipping`);
        // Still add to memory for context
        await this.memory.addMessage({
          role: 'user',
          content: transcription.text,
          timestamp: new Date(),
          source: 'voice',
        });
        return;
      }

      if (hasWakeWord) {
        console.log(`[CoHost] Wake word detected in voice!`);
      }

      // Process the voice input
      await this.processInput(transcription.text, 'voice');
    } catch (error) {
      console.error('[CoHost] Error processing voice input:', error);
    }
  }

  async getMemoryStats() {
    return await this.memory.getStats();
  }

  async searchMemory(query: string, limit: number = 5) {
    return await this.memory.searchSimilar(query, limit);
  }

  async listOBSScenes(): Promise<string[]> {
    if (!this.obs.isConnected()) {
      throw new Error('OBS not connected');
    }
    return await this.obs.listScenes();
  }

  async getCurrentOBSScene(): Promise<string> {
    if (!this.obs.isConnected()) {
      throw new Error('OBS not connected');
    }
    return await this.obs.getCurrentScene();
  }

  // Audio capture controls
  async startAudioCapture(): Promise<void> {
    await this.audioCapture.start();
  }

  async stopAudioCapture(): Promise<void> {
    await this.audioCapture.stop();
  }

  isAudioCaptureActive(): boolean {
    return this.audioCapture.isActive();
  }

  isCurrentlySpeaking(): boolean {
    return this.audioCapture.isCurrentlySpeaking();
  }

  // Service accessors for GUI
  getServices() {
    return {
      obs: this.obs,
      twitch: this.twitch,
      vtubeStudio: this.vtubeStudio,
      audioCapture: this.audioCapture,
      memory: this.memory,
    };
  }

  getServiceStatus() {
    return {
      obs: this.obs.isConnected(),
      twitch: this.twitch.isConnected(),
      vtubeStudio: this.config.vtubeStudio.enabled && this.vtubeStudio.isConnected(),
      audioCapture: this.audioCapture.isActive(),
      speaking: this.audioCapture.isCurrentlySpeaking(),
      processing: this.isProcessing,
    };
  }
}
