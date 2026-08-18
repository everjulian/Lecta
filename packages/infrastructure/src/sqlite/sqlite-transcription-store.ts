import type { Transcript, TranscriptSegment } from '@lecta/domain';
import type {
  TranscriptStore,
  TranscriptionJob,
  TranscriptionJobRepository,
  TranscriptionJobStatus,
  TranscriptionModel,
  TranscriptionResourceMode,
} from '@lecta/transcription';
import { DatabaseSync } from 'node:sqlite';
import initialMigration from './migrations/001-initial.sql?raw';
import transcriptionMigration from './migrations/002-transcription.sql?raw';
import libraryMigration from './migrations/004-library.sql?raw';
import { InfrastructureError } from '../errors';

interface JobRow {
  id: string;
  session_id: string;
  recording_path: string;
  model: string;
  resource_mode: string;
  status: string;
  progress: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface TranscriptRow {
  id: string;
  session_id: string;
  language: string | null;
  created_at: string;
}
interface SegmentRow {
  id: string;
  session_id: string;
  start_time: number;
  end_time: number;
  text: string;
}

export class SqliteTranscriptionStore implements TranscriptionJobRepository, TranscriptStore {
  private readonly database: DatabaseSync;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.database.exec(initialMigration);
    this.database.exec(transcriptionMigration);
    this.database.exec(libraryMigration);
  }

  save(job: TranscriptionJob): Promise<void> {
    try {
      this.database
        .prepare(
          `
        INSERT INTO transcription_jobs
          (id, session_id, recording_path, model, resource_mode, status, progress, error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          recording_path = excluded.recording_path,
          model = excluded.model,
          resource_mode = excluded.resource_mode,
          status = excluded.status,
          progress = excluded.progress,
          error = excluded.error,
          updated_at = excluded.updated_at
      `,
        )
        .run(
          job.id,
          job.sessionId,
          job.recordingPath,
          job.model,
          job.resourceMode,
          job.status,
          job.progress,
          job.error,
          job.createdAt.toISOString(),
          job.updatedAt.toISOString(),
        );
      return Promise.resolve();
    } catch (cause) {
      return Promise.reject(new InfrastructureError('Unable to save transcription job', { cause }));
    }
  }

  getById(id: string): Promise<TranscriptionJob | null> {
    const row = this.database.prepare('SELECT * FROM transcription_jobs WHERE id = ?').get(id) as
      JobRow | undefined;
    return Promise.resolve(row ? this.toJob(row) : null);
  }

  getBySessionId(sessionId: string): Promise<TranscriptionJob | null> {
    const row = this.database
      .prepare('SELECT * FROM transcription_jobs WHERE session_id = ?')
      .get(sessionId) as JobRow | undefined;
    return Promise.resolve(row ? this.toJob(row) : null);
  }

  list(): Promise<readonly TranscriptionJob[]> {
    const rows = this.database
      .prepare('SELECT * FROM transcription_jobs ORDER BY created_at DESC')
      .all() as unknown as JobRow[];
    return Promise.resolve(rows.map((row) => this.toJob(row)));
  }

  markActiveAsInterrupted(now: Date): Promise<void> {
    this.database
      .prepare(
        `
      UPDATE transcription_jobs
      SET status = 'FAILED', error = 'La aplicación se cerró durante la transcripción. Puedes reiniciarla.', updated_at = ?
      WHERE status IN ('QUEUED', 'PREPARING', 'TRANSCRIBING', 'SAVING')
    `,
      )
      .run(now.toISOString());
    return Promise.resolve();
  }

  saveTranscript(transcript: Transcript): Promise<void> {
    return this.persistTranscript(transcript);
  }

  getTranscriptBySessionId(sessionId: string): Promise<Transcript | null> {
    return this.loadTranscript(sessionId);
  }

  close(): void {
    this.database.close();
  }

  private persistTranscript(transcript: Transcript): Promise<void> {
    try {
      this.database.exec('BEGIN IMMEDIATE');
      this.database
        .prepare('DELETE FROM transcripts WHERE session_id = ?')
        .run(transcript.sessionId);
      this.database
        .prepare(
          'INSERT INTO transcripts (id, session_id, language, created_at) VALUES (?, ?, ?, ?)',
        )
        .run(
          transcript.id,
          transcript.sessionId,
          transcript.language,
          transcript.createdAt.toISOString(),
        );
      const statement = this.database.prepare(`
        INSERT INTO transcript_segments
          (id, transcript_id, session_id, segment_index, start_time, end_time, text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      transcript.segments.forEach((segment, index) =>
        statement.run(
          segment.id,
          transcript.id,
          segment.sessionId,
          index,
          segment.startTime,
          segment.endTime,
          segment.text,
        ),
      );
      this.database
        .prepare("DELETE FROM session_search WHERE session_id = ? AND source = 'transcript'")
        .run(transcript.sessionId);
      const searchableText = transcript.segments.map((segment) => segment.text).join('\n');
      if (searchableText.trim()) {
        this.database
          .prepare(
            "INSERT INTO session_search (session_id, source, content) VALUES (?, 'transcript', ?)",
          )
          .run(transcript.sessionId, searchableText);
      }
      this.database.exec('COMMIT');
      return Promise.resolve();
    } catch (cause) {
      try {
        this.database.exec('ROLLBACK');
      } catch {
        /* preserve original storage error */
      }
      return Promise.reject(new InfrastructureError('Unable to save transcript', { cause }));
    }
  }

  private loadTranscript(sessionId: string): Promise<Transcript | null> {
    const transcript = this.database
      .prepare('SELECT * FROM transcripts WHERE session_id = ?')
      .get(sessionId) as TranscriptRow | undefined;
    if (!transcript) return Promise.resolve(null);
    const rows = this.database
      .prepare(
        'SELECT id, session_id, start_time, end_time, text FROM transcript_segments WHERE transcript_id = ? ORDER BY segment_index',
      )
      .all(transcript.id) as unknown as SegmentRow[];
    return Promise.resolve({
      id: transcript.id,
      sessionId: transcript.session_id,
      language: transcript.language,
      createdAt: new Date(transcript.created_at),
      segments: rows.map((row): TranscriptSegment => ({
        id: row.id,
        sessionId: row.session_id,
        startTime: row.start_time,
        endTime: row.end_time,
        text: row.text,
      })),
    });
  }

  private toJob(row: JobRow): TranscriptionJob {
    return {
      id: row.id,
      sessionId: row.session_id,
      recordingPath: row.recording_path,
      model: row.model as TranscriptionModel,
      resourceMode: row.resource_mode as TranscriptionResourceMode,
      status: row.status as TranscriptionJobStatus,
      progress: row.progress,
      error: row.error,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
