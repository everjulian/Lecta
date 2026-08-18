import type { Recording, Session, Transcript } from '@lecta/domain';

export interface SessionRepository {
  save(session: Session): Promise<void>;
  getById(id: string): Promise<Session | null>;
  list(): Promise<readonly Session[]>;
  delete(id: string): Promise<void>;
}

export interface LibraryQuery {
  text?: string;
  type?: 'CLASS' | 'MEETING' | 'OTHER';
  subject?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
  sort: 'NEWEST' | 'OLDEST';
}

export interface LibraryItem {
  id: string;
  title: string;
  type: 'CLASS' | 'MEETING' | 'OTHER';
  subject: string | null;
  tags: readonly string[];
  status: 'IDLE' | 'RECORDING' | 'PAUSED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryPage {
  items: readonly LibraryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LibraryRepository {
  search(query: LibraryQuery): Promise<LibraryPage>;
  listSubjects(): Promise<readonly string[]>;
}

export interface RecordingRepository {
  save(recording: Recording): Promise<void>;
  getBySessionId(sessionId: string): Promise<Recording | null>;
}

export interface TranscriptRepository {
  save(transcript: Transcript): Promise<void>;
  getBySessionId(sessionId: string): Promise<Transcript | null>;
}

export interface IdGenerator {
  generate(): string;
}
export interface Clock {
  now(): Date;
}
