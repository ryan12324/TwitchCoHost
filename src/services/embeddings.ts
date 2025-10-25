import { pipeline } from '@xenova/transformers';

/**
 * Embedding service using local transformer models
 * Generates vector embeddings for semantic search
 */
export class EmbeddingService {
  private embedder: any = null;
  private modelName: string = 'Xenova/all-MiniLM-L6-v2';
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(modelName?: string) {
    if (modelName) {
      this.modelName = modelName;
    }
  }

  /**
   * Initialize the embedding model
   * This loads the model into memory and may take a few seconds
   */
  async initialize(): Promise<void> {
    // If already initialized, return
    if (this.isInitialized) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = (async () => {
      try {
        console.log(`[Embeddings] Loading model: ${this.modelName}...`);
        this.embedder = await pipeline('feature-extraction', this.modelName);
        this.isInitialized = true;
        console.log('[Embeddings] Model loaded successfully');
      } catch (error) {
        console.error('[Embeddings] Failed to load model:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Generate embeddings for a single text
   */
  async embed(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    try {
      // Generate embedding
      const output = await this.embedder(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert to array
      const embedding = Array.from(output.data) as number[];
      return embedding;
    } catch (error) {
      console.error('[Embeddings] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than calling embed() multiple times
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    try {
      const embeddings: number[][] = [];

      // Process in batches to avoid memory issues
      const batchSize = 32;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        for (const text of batch) {
          const output = await this.embedder(text, {
            pooling: 'mean',
            normalize: true,
          });
          embeddings.push(Array.from(output.data));
        }
      }

      return embeddings;
    } catch (error) {
      console.error('[Embeddings] Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance for reuse across the application
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}
