import type {
  LibraryPage,
  LibraryQuery,
  LibraryRepository,
  SessionRepository,
} from '@lecta/application';
import { Session, type SessionStatus, type SessionType } from '@lecta/domain';
import { DatabaseSync } from 'node:sqlite';
import initialMigration from './migrations/001-initial.sql?raw';
import libraryMigration from './migrations/004-library.sql?raw';
import type { SessionRow } from './session-row';
import { InfrastructureError } from '../errors';

export class SqliteSessionRepository implements SessionRepository, LibraryRepository {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    try {
      this.database = new DatabaseSync(path);
      this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      this.database.exec(initialMigration);
      this.database.exec(libraryMigration);
    } catch (cause) {
      throw new InfrastructureError('Unable to initialize the sessions database', { cause });
    }
  }

  save(session: Session): Promise<void> {
    const value = session.toPrimitives();
    try {
      this.database
        .prepare(
          `
          INSERT INTO sessions (id, title, type, subject, status, duration_ms, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            type = excluded.type,
            subject = excluded.subject,
            status = excluded.status,
            duration_ms = excluded.duration_ms,
            updated_at = excluded.updated_at
        `,
        )
        .run(
          value.id,
          value.title,
          value.type,
          value.subject,
          value.status,
          value.durationMs,
          value.createdAt.toISOString(),
          value.updatedAt.toISOString(),
        );
      this.database.prepare('DELETE FROM session_tags WHERE session_id = ?').run(value.id);
      const insertTag = this.database.prepare(
        'INSERT OR IGNORE INTO session_tags (session_id, tag) VALUES (?, ?)',
      );
      for (const tag of session.tags) insertTag.run(value.id, tag);
      this.replaceSearchDocument(value.id, 'session', [
        value.title,
        value.subject,
        ...session.tags,
      ]);
      return Promise.resolve();
    } catch (cause) {
      return Promise.reject(new InfrastructureError('Unable to save the session', { cause }));
    }
  }

  getById(id: string): Promise<Session | null> {
    try {
      const row = this.database
        .prepare(
          `SELECT s.*, (SELECT GROUP_CONCAT(tag, char(31)) FROM session_tags WHERE session_id = s.id) AS tags
          FROM sessions s WHERE s.id = ?`,
        )
        .get(id) as SessionRow | undefined;
      return Promise.resolve(row ? this.toDomain(row) : null);
    } catch (cause) {
      return Promise.reject(new InfrastructureError('Unable to get the session', { cause }));
    }
  }

  list(): Promise<readonly Session[]> {
    try {
      const rows = this.database
        .prepare(
          `SELECT s.*, GROUP_CONCAT(st.tag, char(31)) AS tags
          FROM sessions s LEFT JOIN session_tags st ON st.session_id = s.id
          GROUP BY s.id ORDER BY s.created_at DESC`,
        )
        .all() as unknown as SessionRow[];
      return Promise.resolve(rows.map((row) => this.toDomain(row)));
    } catch (cause) {
      return Promise.reject(new InfrastructureError('Unable to list sessions', { cause }));
    }
  }

  search(query: LibraryQuery): Promise<LibraryPage> {
    try {
      const conditions: string[] = [];
      const parameters: (string | number)[] = [];
      if (query.text) {
        const ftsQuery = toFtsQuery(query.text);
        if (ftsQuery) {
          conditions.push(
            'EXISTS (SELECT 1 FROM session_search f WHERE f.session_id = s.id AND session_search MATCH ?)',
          );
          parameters.push(ftsQuery);
        }
      }
      if (query.type) {
        conditions.push('s.type = ?');
        parameters.push(query.type);
      }
      if (query.subject) {
        conditions.push('s.subject = ? COLLATE NOCASE');
        parameters.push(query.subject);
      }
      if (query.dateFrom) {
        conditions.push('s.created_at >= ?');
        parameters.push(query.dateFrom.toISOString());
      }
      if (query.dateTo) {
        conditions.push('s.created_at <= ?');
        parameters.push(query.dateTo.toISOString());
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const totalRow = this.database
        .prepare(`SELECT COUNT(*) AS total FROM sessions s ${where}`)
        .get(...parameters) as { total: number };
      const direction = query.sort === 'OLDEST' ? 'ASC' : 'DESC';
      const rows = this.database
        .prepare(
          `SELECT s.*, GROUP_CONCAT(st.tag, char(31)) AS tags
          FROM sessions s LEFT JOIN session_tags st ON st.session_id = s.id
          ${where} GROUP BY s.id ORDER BY s.created_at ${direction}, s.id ${direction}
          LIMIT ? OFFSET ?`,
        )
        .all(
          ...parameters,
          query.pageSize,
          (query.page - 1) * query.pageSize,
        ) as unknown as SessionRow[];
      return Promise.resolve({
        items: rows.map((row) => {
          const session = this.toDomain(row);
          return session.toPrimitives() as LibraryPage['items'][number];
        }),
        total: totalRow.total,
        page: query.page,
        pageSize: query.pageSize,
      });
    } catch (cause) {
      return Promise.reject(new InfrastructureError('Unable to search the library', { cause }));
    }
  }

  listSubjects(): Promise<readonly string[]> {
    try {
      const rows = this.database
        .prepare(
          `SELECT DISTINCT subject FROM sessions
          WHERE subject IS NOT NULL AND TRIM(subject) <> '' ORDER BY subject COLLATE NOCASE`,
        )
        .all() as unknown as { subject: string }[];
      return Promise.resolve(rows.map((row) => row.subject));
    } catch (cause) {
      return Promise.reject(new InfrastructureError('Unable to list subjects', { cause }));
    }
  }

  delete(id: string): Promise<void> {
    try {
      this.database.prepare('DELETE FROM session_search WHERE session_id = ?').run(id);
      this.database.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      return Promise.resolve();
    } catch (cause) {
      return Promise.reject(new InfrastructureError('Unable to delete the session', { cause }));
    }
  }

  close(): void {
    this.database.close();
  }

  ensureLibraryIndex(): void {
    const indexed = this.database
      .prepare('SELECT 1 FROM library_index_state WHERE version = 1')
      .get();
    if (indexed) return;
    try {
      this.database.exec('BEGIN IMMEDIATE');
      this.database.exec('DELETE FROM session_search');
      this.database.exec(`INSERT INTO session_search (session_id, source, content)
        SELECT s.id, 'session', s.title || char(10) || COALESCE(s.subject, '') || char(10) ||
          COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM session_tags WHERE session_id = s.id), '')
        FROM sessions s`);
      this.database.exec(`INSERT INTO session_search (session_id, source, content)
        SELECT session_id, 'transcript', GROUP_CONCAT(text, char(10))
        FROM transcript_segments GROUP BY session_id`);
      this.database.exec(`INSERT INTO session_search (session_id, source, content)
        SELECT session_id, 'notes', summary || char(10) || topics_json || char(10) ||
          key_concepts_json || char(10) || tasks_json || char(10) || study_questions_json ||
          char(10) || important_moments_json || char(10) || exam_mentions_json
        FROM structured_notes`);
      this.database
        .prepare('INSERT INTO library_index_state (version, indexed_at) VALUES (1, ?)')
        .run(new Date().toISOString());
      this.database.exec('COMMIT');
    } catch (cause) {
      try {
        this.database.exec('ROLLBACK');
      } catch {
        /* preserve original error */
      }
      throw new InfrastructureError('Unable to initialize the library search index', { cause });
    }
  }

  private toDomain(row: SessionRow): Session {
    return Session.restore({
      id: row.id,
      title: row.title,
      type: row.type as SessionType,
      subject: row.subject,
      status: row.status as SessionStatus,
      durationMs: row.duration_ms,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      tags: row.tags ? row.tags.split(String.fromCharCode(31)) : [],
    });
  }

  private replaceSearchDocument(
    sessionId: string,
    source: string,
    values: readonly (string | null)[],
  ): void {
    this.database
      .prepare('DELETE FROM session_search WHERE session_id = ? AND source = ?')
      .run(sessionId, source);
    const content = values.filter((value): value is string => Boolean(value?.trim())).join('\n');
    if (content)
      this.database
        .prepare('INSERT INTO session_search (session_id, source, content) VALUES (?, ?, ?)')
        .run(sessionId, source, content);
  }
}

function toFtsQuery(text: string): string | null {
  const terms = text.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];
  if (terms.length === 0) return null;
  return terms
    .slice(0, 10)
    .map((term) => `"${term.replaceAll('"', '""')}"*`)
    .join(' AND ');
}
