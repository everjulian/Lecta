import type { EmbeddingProvider, KnowledgeMatch, VectorStore } from './knowledge-types';

export class KnowledgeRetriever {
  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly vectors: VectorStore,
    private readonly minimumScore = 0.42,
  ) {}

  async retrieve(query: string, limit = 6): Promise<readonly KnowledgeMatch[]> {
    const [embedding] = await this.embeddings.embed([`query: ${query}`]);
    if (!embedding) return [];
    return (await this.vectors.search(embedding, this.embeddings.model, limit)).filter(
      (match) => match.score >= this.minimumScore,
    );
  }
}
