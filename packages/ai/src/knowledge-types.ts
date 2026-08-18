export interface KnowledgeChunk {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface EmbeddedKnowledgeChunk extends KnowledgeChunk {
  embedding: readonly number[];
  model: string;
}

export interface KnowledgeMatch extends KnowledgeChunk {
  score: number;
}

export interface EmbeddingProvider {
  readonly model: string;
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export interface VectorStore {
  replaceSession(
    sessionId: string,
    transcriptId: string,
    chunks: readonly EmbeddedKnowledgeChunk[],
  ): Promise<void>;
  isIndexed(sessionId: string, transcriptId: string, model: string): Promise<boolean>;
  search(
    embedding: readonly number[],
    model: string,
    limit: number,
  ): Promise<readonly KnowledgeMatch[]>;
}

export interface KnowledgeTranscript {
  id: string;
  sessionId: string;
  segments: readonly { startTime: number; endTime: number; text: string }[];
}

export interface KnowledgeTranscriptSource {
  list(): Promise<readonly KnowledgeTranscript[]>;
}

export interface KnowledgeSource extends KnowledgeMatch {
  sessionTitle: string;
  sessionDate: Date;
}

export interface KnowledgeSessionReader {
  enrich(matches: readonly KnowledgeMatch[]): Promise<readonly KnowledgeSource[]>;
}

export interface KnowledgeAnswer {
  answer: string;
  sources: readonly KnowledgeSource[];
  insufficient: boolean;
}
