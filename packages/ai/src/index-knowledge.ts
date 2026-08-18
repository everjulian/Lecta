import type { EmbeddingProvider, KnowledgeTranscriptSource, VectorStore } from './knowledge-types';
import { KnowledgeChunker } from './knowledge-chunker';

export class IndexKnowledge {
  constructor(
    private readonly source: KnowledgeTranscriptSource,
    private readonly embeddings: EmbeddingProvider,
    private readonly vectors: VectorStore,
    private readonly chunker = new KnowledgeChunker(),
  ) {}

  async execute(): Promise<number> {
    let indexed = 0;
    for (const transcript of await this.source.list()) {
      if (await this.vectors.isIndexed(transcript.sessionId, transcript.id, this.embeddings.model))
        continue;
      const chunks = this.chunker.chunk(transcript);
      const vectors = await this.embeddings.embed(chunks.map((chunk) => `passage: ${chunk.text}`));
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
    }
    return indexed;
  }
}
