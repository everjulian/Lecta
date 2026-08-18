import type { EmbeddingProvider, KnowledgeMatch, VectorStore } from './knowledge-types';

export class KnowledgeRetriever {
  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly vectors: VectorStore,
    private readonly minimumScore = 0.42,
  ) {}

  async retrieve(
    query: string,
    limit = 6,
    signal?: AbortSignal,
    onRanking?: () => void,
  ): Promise<readonly KnowledgeMatch[]> {
    throwIfAborted(signal);
    const [embedding] = await this.embeddings.embed([`query: ${query}`]);
    throwIfAborted(signal);
    if (!embedding) return [];
    onRanking?.();
    return (await this.vectors.search(embedding, this.embeddings.model, limit)).filter(
      (match) => match.score >= this.minimumScore,
    );
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Knowledge operation cancelled', 'AbortError');
}
