import Anthropic from '@anthropic-ai/sdk';
import { Config, Message } from '../types';

export class ClaudeService {
  private client: Anthropic;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }

  async generateResponse(
    messages: Message[],
    context?: string
  ): Promise<string> {
    try {
      // Build system prompt with personality and context
      const systemPrompt = this.buildSystemPrompt(context);

      // Convert our message format to Claude's format
      const claudeMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      // Call Claude API
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
      });

      // Extract text from response
      const textContent = response.content.find(
        block => block.type === 'text'
      );

      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      return textContent.text;
    } catch (error) {
      console.error('Error generating Claude response:', error);
      throw error;
    }
  }

  private buildSystemPrompt(context?: string): string {
    let prompt = `You are ${this.config.cohost.name}, a ${this.config.cohost.personality}.

You are a VTuber cohost helping with a live stream on Twitch. Your role is to:
- Engage with chat messages and respond naturally
- React to what the streamer says (transcribed via speech recognition)
- Keep responses concise and entertaining (1-3 sentences typically)
- Be supportive, fun, and add value to the stream
- You can control OBS scenes when appropriate by mentioning commands like "switch to [scene name]"

Remember: You are speaking in a live stream context, so be conversational and timely.`;

    if (context) {
      prompt += `\n\nCurrent context:\n${context}`;
    }

    return prompt;
  }

  async analyzeForOBSCommands(text: string): Promise<{
    hasCommand: boolean;
    command?: string;
    parameter?: string;
  }> {
    // Simple pattern matching for OBS commands in the response
    const patterns = [
      { regex: /switch to (?:the )?(.+?) scene/i, command: 'switch_scene' },
      { regex: /change to (?:the )?(.+?) scene/i, command: 'switch_scene' },
      { regex: /show (?:the )?(.+?) source/i, command: 'show_source' },
      { regex: /hide (?:the )?(.+?) source/i, command: 'hide_source' },
      { regex: /toggle (?:the )?(.+?) source/i, command: 'toggle_source' },
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        return {
          hasCommand: true,
          command: pattern.command,
          parameter: match[1],
        };
      }
    }

    return { hasCommand: false };
  }
}
