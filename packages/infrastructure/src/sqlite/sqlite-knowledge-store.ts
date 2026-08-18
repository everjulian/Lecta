import type {
  EmbeddedKnowledgeChunk,
  KnowledgeMatch,
  KnowledgeSessionReader,
  KnowledgeSource,
  KnowledgeTranscript,
  KnowledgeTranscriptSource,
  VectorStore,
} from '@lecta/ai';
import { DatabaseSync } from 'node:sqlite';
import initialMigration from './migrations/001-initial.sql?raw';
import transcriptionMigration from './migrations/002-transcription.sql?raw';
import semanticMigration from './migrations/005-semantic-knowledge.sql?raw';
import { InfrastructureError } from '../errors';

interface VectorRow {
  id: string;
  session_id: string;
  start_time: number;
  end_time: number;
  text: string;
  embedding: Uint8Array;
  dimension: number;
}

interface SegmentRow {
  start_time: number;
  end_time: number;
  text: string;
}

export class SqliteKnowledgeStore
  implements VectorStore, KnowledgeTranscriptSource, KnowledgeSessionReader
{
  private readonly database: DatabaseSync;
  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.database.exec(initialMigration);
    this.database.exec(transcriptionMigration);
    this.database.exec(semanticMigration);
  }

  list(): Promise<readonly KnowledgeTranscript[]> {
    try {
      const transcripts = this.database
        .prepare('SELECT id, session_id FROM transcripts ORDER BY created_at')
        .all() as unknown as { id: string; session_id: string }[];
      const statement = this.database.prepare(
        'SELECT start_time, end_time, text FROM transcript_segments WHERE transcript_id = ? ORDER BY segment_index',
      );
      return Promise.resolve(
        transcripts.map((transcript) => ({
          id: transcript.id,
          sessionId: transcript.session_id,
          segments: (statement.all(transcript.id) as unknown as SegmentRow[]).map((segment) => ({
            startTime: segment.start_time,
            endTime: segment.end_time,
            text: segment.text,
          })),
        })),
      );
    } catch (cause) {
      return Promise.reject(
        new InfrastructureError('Unable to list knowledge transcripts', { cause }),
      );
    }
  }

  isIndexed(sessionId: string, transcriptId: string, model: string): Promise<boolean> {
    const row = this.database
      .prepare(
        'SELECT 1 FROM knowledge_chunks WHERE session_id = ? AND transcript_id = ? AND model = ? LIMIT 1',
      )
      .get(sessionId, transcriptId, model);
    return Promise.resolve(Boolean(row));
  }

  replaceSession(
    sessionId: string,
    transcriptId: string,
    chunks: readonly EmbeddedKnowledgeChunk[],
  ): Promise<void> {
    try {
      this.database.exec('BEGIN IMMEDIATE');
      this.database.prepare('DELETE FROM knowledge_chunks WHERE session_id = ?').run(sessionId);
      const insert = this.database.prepare(`INSERT INTO knowledge_chunks
        (id, session_id, transcript_id, start_time, end_time, text, embedding, dimension, model)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const chunk of chunks)
        insert.run(
          chunk.id,
          chunk.sessionId,
          transcriptId,
          chunk.startTime,
          chunk.endTime,
          chunk.text,
          toBlob(chunk.embedding),
          chunk.embedding.length,
          chunk.model,
        );
      this.database.exec('COMMIT');
      return Promise.resolve();
    } catch (cause) {
      try {
        this.database.exec('ROLLBACK');
      } catch {
        /* preserve original error */
      }
      return Promise.reject(
        new InfrastructureError('Unable to replace knowledge vectors', { cause }),
      );
    }
  }

  search(
    embedding: readonly number[],
    model: string,
    limit: number,
  ): Promise<readonly KnowledgeMatch[]> {
    try {
      const rows = this.database
        .prepare(
          'SELECT id, session_id, start_time, end_time, text, embedding, dimension FROM knowledge_chunks WHERE model = ? AND dimension = ?',
        )
        .all(model, embedding.length) as unknown as VectorRow[];
      return Promise.resolve(
        rows
          .map((row) => ({
            id: row.id,
            sessionId: row.session_id,
            startTime: row.start_time,
            endTime: row.end_time,
            text: row.text,
            score: cosine(embedding, fromBlob(row.embedding, row.dimension)),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit),
      );
    } catch (cause) {
      return Promise.reject(
        new InfrastructureError('Unable to search knowledge vectors', { cause }),
      );
    }
  }

  enrich(matches: readonly KnowledgeMatch[]): Promise<readonly KnowledgeSource[]> {
    const statement = this.database.prepare('SELECT title, created_at FROM sessions WHERE id = ?');
    return Promise.resolve(
      matches.flatMap((match) => {
        const session = statement.get(match.sessionId) as
          { title: string; created_at: string } | undefined;
        return session
          ? [{ ...match, sessionTitle: session.title, sessionDate: new Date(session.created_at) }]
          : [];
      }),
    );
  }

  close(): void {
    this.database.close();
  }
}

function toBlob(values: readonly number[]): Uint8Array {
  return new Uint8Array(new Float32Array(values).buffer);
}
function fromBlob(blob: Uint8Array, dimension: number): Float32Array {
  const copy = new Uint8Array(blob).slice();
  return new Float32Array(copy.buffer, copy.byteOffset, dimension);
}
function cosine(left: ArrayLike<number>, right: ArrayLike<number>): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}
