import type { StructuredNotes, Transcript } from '@lecta/domain';

export interface AIProvider {
  generateJson(input: {
    systemPrompt: string;
    userPrompt: string;
    signal: AbortSignal;
  }): Promise<unknown>;
}

export interface StructuredNotesRepository {
  save(notes: StructuredNotes): Promise<void>;
  getBySessionId(sessionId: string): Promise<StructuredNotes | null>;
}

export interface TranscriptReader {
  getTranscriptBySessionId(sessionId: string): Promise<Transcript | null>;
}

export interface GenerateNotesDependencies {
  provider: AIProvider;
  notes: StructuredNotesRepository;
  transcripts: TranscriptReader;
  generateId(): string;
  now(): Date;
  chunkSize?: number;
}

export interface GenerationProgress {
  stage: 'CHUNKING' | 'SUMMARIZING' | 'SYNTHESIZING' | 'SAVING';
  percent: number;
}
