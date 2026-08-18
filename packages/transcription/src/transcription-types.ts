import type { Transcript, TranscriptSegment } from '@lecta/domain';

export type TranscriptionJobStatus =
  'QUEUED' | 'PREPARING' | 'TRANSCRIBING' | 'SAVING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type TranscriptionModel = 'small' | 'medium';
export type TranscriptionResourceMode = 'LIGHT' | 'NORMAL';

export interface TranscriptionJob {
  id: string;
  sessionId: string;
  recordingPath: string;
  model: TranscriptionModel;
  resourceMode: TranscriptionResourceMode;
  status: TranscriptionJobStatus;
  progress: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptionProgress {
  stage: 'PREPARING' | 'TRANSCRIBING';
  percent: number;
}

export interface ProviderTranscript {
  language: string | null;
  segments: readonly Omit<TranscriptSegment, 'id' | 'sessionId'>[];
}

export interface TranscriptionProvider {
  transcribe(
    recordingPath: string,
    options: {
      model: TranscriptionModel;
      resourceMode: TranscriptionResourceMode;
      modelDirectory: string;
      signal: AbortSignal;
      onProgress(progress: TranscriptionProgress): void;
    },
  ): Promise<ProviderTranscript>;
}

export interface TranscriptionJobRepository {
  save(job: TranscriptionJob): Promise<void>;
  getById(id: string): Promise<TranscriptionJob | null>;
  getBySessionId(sessionId: string): Promise<TranscriptionJob | null>;
  list(): Promise<readonly TranscriptionJob[]>;
  markActiveAsInterrupted(now: Date): Promise<void>;
}

export interface TranscriptStore {
  saveTranscript(transcript: Transcript): Promise<void>;
  getTranscriptBySessionId(sessionId: string): Promise<Transcript | null>;
}

export interface QueueDependencies {
  jobs: TranscriptionJobRepository;
  transcripts: TranscriptStore;
  provider: TranscriptionProvider;
  modelDirectory: string;
  generateId(): string;
  now(): Date;
}
