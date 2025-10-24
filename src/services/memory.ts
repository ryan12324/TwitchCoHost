import { Config, Message } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class MemoryService {
  private messages: Message[] = [];
  private config: Config;
  private memoryDir: string;

  constructor(config: Config) {
    this.config = config;
    this.memoryDir = path.join(process.cwd(), 'memory');
    this.ensureMemoryDir();
    this.loadMemory();
  }

  private ensureMemoryDir(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  addMessage(message: Message): void {
    this.messages.push(message);

    // Trim if exceeding max messages
    if (this.messages.length > this.config.memory.maxMessages) {
      // Keep system messages and trim oldest user/assistant messages
      const systemMessages = this.messages.filter(m => m.role === 'system');
      const otherMessages = this.messages.filter(m => m.role !== 'system');

      const trimmedOther = otherMessages.slice(
        -this.config.memory.maxMessages + systemMessages.length
      );

      this.messages = [...systemMessages, ...trimmedOther];
    }

    this.saveMemory();
  }

  getRecentMessages(count?: number): Message[] {
    const limit = count || this.config.memory.contextWindow;
    return this.messages.slice(-limit);
  }

  getAllMessages(): Message[] {
    return [...this.messages];
  }

  getContextSummary(): string {
    const recent = this.getRecentMessages(10);
    if (recent.length === 0) {
      return 'No recent conversation history.';
    }

    const summary = recent
      .map(m => {
        const source = m.source ? `[${m.source}]` : '';
        const user = m.username ? `${m.username}: ` : '';
        return `${source} ${user}${m.content}`;
      })
      .join('\n');

    return `Recent conversation:\n${summary}`;
  }

  clearMemory(): void {
    this.messages = [];
    this.saveMemory();
  }

  private saveMemory(): void {
    const memoryFile = path.join(this.memoryDir, 'conversation.json');
    try {
      fs.writeFileSync(memoryFile, JSON.stringify(this.messages, null, 2));
    } catch (error) {
      console.error('Error saving memory:', error);
    }
  }

  private loadMemory(): void {
    const memoryFile = path.join(this.memoryDir, 'conversation.json');
    try {
      if (fs.existsSync(memoryFile)) {
        const data = fs.readFileSync(memoryFile, 'utf-8');
        const parsed = JSON.parse(data);

        // Convert date strings back to Date objects
        this.messages = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));

        console.log(`Loaded ${this.messages.length} messages from memory`);
      }
    } catch (error) {
      console.error('Error loading memory:', error);
      this.messages = [];
    }
  }

  getStats(): {
    totalMessages: number;
    bySource: Record<string, number>;
    byRole: Record<string, number>;
  } {
    const bySource: Record<string, number> = {};
    const byRole: Record<string, number> = {};

    for (const msg of this.messages) {
      const source = msg.source || 'unknown';
      const role = msg.role;

      bySource[source] = (bySource[source] || 0) + 1;
      byRole[role] = (byRole[role] || 0) + 1;
    }

    return {
      totalMessages: this.messages.length,
      bySource,
      byRole,
    };
  }
}
