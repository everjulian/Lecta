import type { EmbeddingProvider, KnowledgeTranscriptSource, VectorStore } from './knowledge-types';
import { KnowledgeChunker } from './knowledge-chunker';

export class IndexKnowledge {
  constructor(
    private readonly source: KnowledgeTranscriptSource,
    private readonly embeddings: EmbeddingProvider,
    private readonly vectors: VectorStore,
    private readonly chunker = new KnowledgeChunker(),
  ) {}

  async execute(options: IndexKnowledgeOptions = {}): Promise<number> {
    let indexed = 0;
    const transcripts = await this.source.list();
    let completed = 0;
    options.onProgress?.({ completed, total: transcripts.length, indexed });
    for (const transcript of transcripts) {
      throwIfAborted(options.signal);
      if (await this.vectors.isIndexed(transcript.sessionId, transcript.id, this.embeddings.model))
        options.onProgress?.({ completed: ++completed, total: transcripts.length, indexed });
      else {
        const chunks = this.chunker.chunk(transcript);
        const vectors = await this.embeddings.embed(
          chunks.map((chunk) => `passage: ${chunk.text}`),
        );
        throwIfAborted(options.signal);
        await this.vectors.replaceSession(
          transcript.sessionId,
          transcript.id,
          chunks.map((chunk, index) => ({
            ...chunk,
            embedding: vectors[index] ?? [],
            model: this.embeddings.model,
          })),
        );
        indexed += chunks.length;
        options.onProgress?.({ completed: ++completed, total: transcripts.length, indexed });
      }
    }
    return indexed;
  }
}

export interface IndexKnowledgeOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: {
    readonly completed: number;
    readonly total: number;
    readonly indexed: number;
  }) => void;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Knowledge operation cancelled', 'AbortError');
}
