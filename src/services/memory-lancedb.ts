import { Config, Message } from '../types';
import * as lancedb from '@lancedb/lancedb';
import { getEmbeddingService } from './embeddings';
import * as path from 'path';

interface MessageRecord {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  source?: string;
  username?: string;
  vector: number[];
  [key: string]: any;
}

/**
 * LanceDB-powered memory service with semantic search capabilities
 */
export class MemoryService {
  private config: Config;
  private db: lancedb.Connection | null = null;
  private table: any = null;
  private embeddings = getEmbeddingService();
  private isInitialized: boolean = false;
  private dbPath: string;
  private messageCount: number = 0;

  constructor(config: Config) {
    this.config = config;
    this.dbPath = path.join(process.cwd(), 'memory', 'lancedb');
  }

  /**
   * Initialize LanceDB connection and table
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[Memory] Initializing LanceDB...');

      // Initialize embeddings first
      await this.embeddings.initialize();

      // Connect to LanceDB
      this.db = await lancedb.connect(this.dbPath);

      // Check if table exists
      const tableNames = await this.db.tableNames();

      if (tableNames.includes('messages')) {
        // Open existing table
        this.table = await this.db.openTable('messages');
        console.log('[Memory] Opened existing messages table');

        // Count messages
        const count = await this.table.countRows();
        this.messageCount = count;
        console.log(`[Memory] Loaded ${count} messages from database`);
      } else {
        // Create new table with schema
        console.log('[Memory] Creating new messages table...');

        // Create a sample record to define schema
        const sampleVector = await this.embeddings.embed('sample');
        const sampleData: MessageRecord[] = [{
          id: 'init',
          role: 'system',
          content: 'Initialization message',
          timestamp: new Date().toISOString(),
          vector: sampleVector,
        }];

        this.table = await this.db.createTable('messages', sampleData);

        // Delete the sample record
        await this.table.delete('id = "init"');

        console.log('[Memory] Created new messages table');
      }

      this.isInitialized = true;
      console.log('[Memory] LanceDB initialized successfully');
    } catch (error) {
      console.error('[Memory] Failed to initialize LanceDB:', error);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Add a message to memory with vector embedding
   */
  async addMessage(message: Message): Promise<void> {
    await this.ensureInitialized();

    if (!this.table) {
      throw new Error('Table not initialized');
    }

    try {
      // Generate embedding for the message content
      const vector = await this.embeddings.embed(message.content);

      // Create record
      const record: MessageRecord = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        source: message.source,
        username: message.username,
        vector,
      };

      // Add to table
      await this.table.add([record]);
      this.messageCount++;

      // Trim if exceeding max messages
      if (this.messageCount > this.config.memory.maxMessages) {
        await this.trimOldMessages();
      }
    } catch (error) {
      console.error('[Memory] Error adding message:', error);
      throw error;
    }
  }

  /**
   * Trim old messages to stay within max limit
   */
  private async trimOldMessages(): Promise<void> {
    if (!this.table) {
      return;
    }

    try {
      // Get all messages sorted by timestamp
      const allMessages = await this.table
        .select(['id', 'timestamp', 'role'])
        .toArray();

      // Keep system messages and trim oldest user/assistant messages
      const systemMessages = allMessages.filter((m: any) => m.role === 'system');
      const otherMessages = allMessages
        .filter((m: any) => m.role !== 'system')
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const maxOther = this.config.memory.maxMessages - systemMessages.length;
      const toDelete = otherMessages.slice(0, otherMessages.length - maxOther);

      // Delete old messages
      for (const msg of toDelete) {
        await this.table.delete(`id = "${msg.id}"`);
        this.messageCount--;
      }

      console.log(`[Memory] Trimmed ${toDelete.length} old messages`);
    } catch (error) {
      console.error('[Memory] Error trimming messages:', error);
    }
  }

  /**
   * Get recent messages chronologically
   */
  async getRecentMessages(count?: number): Promise<Message[]> {
    await this.ensureInitialized();

    if (!this.table) {
      return [];
    }

    try {
      const limit = count || this.config.memory.contextWindow;

      // Query messages sorted by timestamp (descending)
      const results = await this.table
        .select(['role', 'content', 'timestamp', 'source', 'username'])
        .toArray();

      // Sort by timestamp and take last N
      const sorted = results
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-limit);

      // Convert to Message objects
      return sorted.map((r: any) => ({
        role: r.role,
        content: r.content,
        timestamp: new Date(r.timestamp),
        source: r.source,
        username: r.username,
      }));
    } catch (error) {
      console.error('[Memory] Error getting recent messages:', error);
      return [];
    }
  }

  /**
   * Semantic search: Find messages similar to a query
   */
  async searchSimilar(query: string, limit: number = 5): Promise<Message[]> {
    await this.ensureInitialized();

    if (!this.table) {
      return [];
    }

    try {
      // Generate embedding for the query
      const queryVector = await this.embeddings.embed(query);

      // Perform vector search
      const results = await this.table
        .search(queryVector)
        .limit(limit)
        .toArray();

      // Convert to Message objects
      return results.map((r: any) => ({
        role: r.role,
        content: r.content,
        timestamp: new Date(r.timestamp),
        source: r.source,
        username: r.username,
      }));
    } catch (error) {
      console.error('[Memory] Error searching similar messages:', error);
      return [];
    }
  }

  /**
   * Get all messages (for compatibility)
   */
  async getAllMessages(): Promise<Message[]> {
    await this.ensureInitialized();

    if (!this.table) {
      return [];
    }

    try {
      const results = await this.table
        .select(['role', 'content', 'timestamp', 'source', 'username'])
        .toArray();

      // Sort by timestamp
      const sorted = results.sort((a: any, b: any) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return sorted.map((r: any) => ({
        role: r.role,
        content: r.content,
        timestamp: new Date(r.timestamp),
        source: r.source,
        username: r.username,
      }));
    } catch (error) {
      console.error('[Memory] Error getting all messages:', error);
      return [];
    }
  }

  /**
   * Get context summary with semantic relevance
   */
  async getContextSummary(currentTopic?: string): Promise<string> {
    await this.ensureInitialized();

    let messages: Message[];

    if (currentTopic) {
      // Get semantically relevant messages
      const relevant = await this.searchSimilar(currentTopic, 5);
      const recent = await this.getRecentMessages(5);

      // Combine and deduplicate
      const combined = [...relevant, ...recent];
      const uniqueMap = new Map();
      combined.forEach(m => {
        const key = `${m.timestamp.getTime()}_${m.content}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, m);
        }
      });

      messages = Array.from(uniqueMap.values())
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .slice(-10);
    } else {
      messages = await this.getRecentMessages(10);
    }

    if (messages.length === 0) {
      return 'No recent conversation history.';
    }

    const summary = messages
      .map(m => {
        const source = m.source ? `[${m.source}]` : '';
        const user = m.username ? `${m.username}: ` : '';
        return `${source} ${user}${m.content}`;
      })
      .join('\n');

    return `Recent conversation:\n${summary}`;
  }

  /**
   * Clear all memory
   */
  async clearMemory(): Promise<void> {
    await this.ensureInitialized();

    if (!this.table) {
      return;
    }

    try {
      // Drop and recreate table
      if (this.db) {
        await this.db.dropTable('messages');

        // Create new empty table
        const sampleVector = await this.embeddings.embed('sample');
        const sampleData: MessageRecord[] = [{
          id: 'init',
          role: 'system',
          content: 'Initialization message',
          timestamp: new Date().toISOString(),
          vector: sampleVector,
        }];

        this.table = await this.db.createTable('messages', sampleData);
        await this.table.delete('id = "init"');

        this.messageCount = 0;
        console.log('[Memory] Cleared all messages');
      }
    } catch (error) {
      console.error('[Memory] Error clearing memory:', error);
      throw error;
    }
  }

  /**
   * Get statistics about stored messages
   */
  async getStats(): Promise<{
    totalMessages: number;
    bySource: Record<string, number>;
    byRole: Record<string, number>;
  }> {
    await this.ensureInitialized();

    if (!this.table) {
      return {
        totalMessages: 0,
        bySource: {},
        byRole: {},
      };
    }

    try {
      const all = await this.getAllMessages();

      const bySource: Record<string, number> = {};
      const byRole: Record<string, number> = {};

      for (const msg of all) {
        const source = msg.source || 'unknown';
        const role = msg.role;

        bySource[source] = (bySource[source] || 0) + 1;
        byRole[role] = (byRole[role] || 0) + 1;
      }

      return {
        totalMessages: all.length,
        bySource,
        byRole,
      };
    } catch (error) {
      console.error('[Memory] Error getting stats:', error);
      return {
        totalMessages: 0,
        bySource: {},
        byRole: {},
      };
    }
  }

  /**
   * Find messages from a specific user
   */
  async getMessagesByUser(username: string): Promise<Message[]> {
    await this.ensureInitialized();

    if (!this.table) {
      return [];
    }

    try {
      const results = await this.table
        .filter(`username = "${username}"`)
        .toArray();

      return results.map((r: any) => ({
        role: r.role,
        content: r.content,
        timestamp: new Date(r.timestamp),
        source: r.source,
        username: r.username,
      }));
    } catch (error) {
      console.error('[Memory] Error getting messages by user:', error);
      return [];
    }
  }
}
