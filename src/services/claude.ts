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

  /**
   * Analyze text for emotional content and suggest avatar expressions
   */
  analyzeEmotion(text: string): {
    emotion: string;
    confidence: number;
    animations?: string[];
  } {
    const textLower = text.toLowerCase();

    // Emotion patterns with keywords and animations
    const emotionPatterns = [
      {
        emotion: 'happy',
        keywords: ['happy', 'excited', 'great', 'awesome', 'wonderful', 'amazing', 'love', 'haha', 'lol', 'yay', '!', 'fantastic'],
        animations: ['wave', 'clap', 'celebrate'],
        weight: 0,
      },
      {
        emotion: 'sad',
        keywords: ['sad', 'sorry', 'unfortunately', 'apologize', 'aw', 'oh no', 'disappointed'],
        animations: ['sigh', 'head_down'],
        weight: 0,
      },
      {
        emotion: 'surprised',
        keywords: ['wow', 'whoa', 'omg', 'amazing', 'incredible', 'unbelievable', 'seriously', '!?', 'what'],
        animations: ['gasp', 'jump'],
        weight: 0,
      },
      {
        emotion: 'confused',
        keywords: ['confused', 'hmm', 'not sure', 'maybe', 'perhaps', 'wondering', '?'],
        animations: ['think', 'tilt_head'],
        weight: 0,
      },
      {
        emotion: 'angry',
        keywords: ['angry', 'mad', 'annoyed', 'frustrated', 'ugh', 'grr'],
        animations: ['shake_head', 'cross_arms'],
        weight: 0,
      },
      {
        emotion: 'love',
        keywords: ['love', 'adore', 'heart', 'sweet', 'cute', 'aww', '<3'],
        animations: ['heart', 'blush'],
        weight: 0,
      },
      {
        emotion: 'thinking',
        keywords: ['think', 'consider', 'let me', "let's see", 'well', 'actually'],
        animations: ['think', 'look_up'],
        weight: 0,
      },
    ];

    // Calculate weights based on keyword matches
    for (const pattern of emotionPatterns) {
      for (const keyword of pattern.keywords) {
        if (textLower.includes(keyword)) {
          pattern.weight += 1;
          // Bonus weight for multiple exclamation marks or question marks
          if (keyword === '!' && (text.match(/!/g) || []).length > 1) {
            pattern.weight += 1;
          }
          if (keyword === '?' && (text.match(/\?/g) || []).length > 1) {
            pattern.weight += 1;
          }
        }
      }
    }

    // Find highest scoring emotion
    const sorted = emotionPatterns.sort((a, b) => b.weight - a.weight);
    const topEmotion = sorted[0];

    // If no strong emotion detected, return neutral
    if (topEmotion.weight === 0) {
      return {
        emotion: 'neutral',
        confidence: 1.0,
      };
    }

    // Calculate confidence (normalize weight)
    const maxPossibleWeight = topEmotion.keywords.length;
    const confidence = Math.min(topEmotion.weight / maxPossibleWeight, 1.0);

    return {
      emotion: topEmotion.emotion,
      confidence,
      animations: topEmotion.animations,
    };
  }

  /**
   * Determine if a message warrants a response from the AI
   * Uses Claude to analyze if the message is directed at the cohost or requires engagement
   */
  async shouldRespond(message: string, context?: string): Promise<{
    shouldRespond: boolean;
    reason: string;
    confidence: number;
  }> {
    try {
      const prompt = `You are analyzing a message to determine if the AI cohost should respond to it.

Message: "${message}"

${context ? `Recent context:\n${context}` : ''}

Analyze if this message:
1. Is a direct question or statement to the cohost
2. Requires a response to keep conversation flowing
3. Is interesting/relevant enough to engage with
4. Would benefit the stream if responded to

Respond with ONLY a JSON object in this exact format:
{
  "shouldRespond": true/false,
  "reason": "brief explanation",
  "confidence": 0.0-1.0
}

Examples:
- "what game are you playing?" -> {"shouldRespond": true, "reason": "direct question", "confidence": 0.9}
- "lol" -> {"shouldRespond": false, "reason": "just a reaction", "confidence": 0.8}
- "hey cohost, how are you?" -> {"shouldRespond": true, "reason": "direct greeting", "confidence": 1.0}
- "gg" -> {"shouldRespond": false, "reason": "common chat reaction", "confidence": 0.9}
- "can you explain that?" -> {"shouldRespond": true, "reason": "request for clarification", "confidence": 0.95}`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        // Default to not responding if analysis fails
        return {
          shouldRespond: false,
          reason: 'Analysis failed',
          confidence: 0.5,
        };
      }

      // Parse JSON response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          shouldRespond: result.shouldRespond || false,
          reason: result.reason || 'Unknown',
          confidence: result.confidence || 0.5,
        };
      }

      // Fallback
      return {
        shouldRespond: false,
        reason: 'Could not parse analysis',
        confidence: 0.5,
      };
    } catch (error) {
      console.error('[Claude] Error in shouldRespond analysis:', error);
      // Default to not responding on error to avoid spam
      return {
        shouldRespond: false,
        reason: 'Error in analysis',
        confidence: 0.3,
      };
    }
  }
}
