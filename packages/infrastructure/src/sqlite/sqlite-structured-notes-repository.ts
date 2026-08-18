import type { StructuredNotes } from '@lecta/domain';
import type { StructuredNotesRepository } from '@lecta/ai';
import { DatabaseSync } from 'node:sqlite';
import initialMigration from './migrations/001-initial.sql?raw';
import transcriptionMigration from './migrations/002-transcription.sql?raw';
import aiNotesMigration from './migrations/003-ai-notes.sql?raw';
import libraryMigration from './migrations/004-library.sql?raw';
import { InfrastructureError } from '../errors';

interface NotesRow {
  id: string;
  session_id: string;
  transcript_id: string;
  summary: string;
  topics_json: string;
  key_concepts_json: string;
  tasks_json: string;
  study_questions_json: string;
  important_moments_json: string;
  exam_mentions_json: string;
  created_at: string;
  updated_at: string;
}

export class SqliteStructuredNotesRepository implements StructuredNotesRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.database.exec(initialMigration);
    this.database.exec(transcriptionMigration);
    this.database.exec(aiNotesMigration);
    this.database.exec(libraryMigration);
  }

  save(notes: StructuredNotes): Promise<void> {
    try {
      this.database
        .prepare(
          `
        INSERT INTO structured_notes
          (id, session_id, transcript_id, summary, topics_json, key_concepts_json,
           tasks_json, study_questions_json, important_moments_json, exam_mentions_json,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          transcript_id = excluded.transcript_id,
          summary = excluded.summary,
          topics_json = excluded.topics_json,
          key_concepts_json = excluded.key_concepts_json,
          tasks_json = excluded.tasks_json,
          study_questions_json = excluded.study_questions_json,
          important_moments_json = excluded.important_moments_json,
          exam_mentions_json = excluded.exam_mentions_json,
          updated_at = excluded.updated_at
      `,
        )
        .run(
          notes.id,
          notes.sessionId,
          notes.transcriptId,
          notes.summary,
          JSON.stringify(notes.topics),
          JSON.stringify(notes.keyConcepts),
          JSON.stringify(notes.tasks),
          JSON.stringify(notes.studyQuestions),
          JSON.stringify(notes.importantMoments),
          JSON.stringify(notes.examMentions),
          notes.createdAt.toISOString(),
          notes.updatedAt.toISOString(),
        );
      this.database
        .prepare("DELETE FROM session_search WHERE session_id = ? AND source = 'notes'")
        .run(notes.sessionId);
      const searchableText = [
        notes.summary,
        ...notes.topics.flatMap((topic) => [topic.title, ...topic.notes]),
        ...notes.keyConcepts,
        ...notes.tasks,
        ...notes.studyQuestions,
        ...notes.importantMoments.flatMap((moment) => [moment.title, moment.description]),
        ...notes.examMentions,
      ].join('\n');
      this.database
        .prepare("INSERT INTO session_search (session_id, source, content) VALUES (?, 'notes', ?)")
        .run(notes.sessionId, searchableText);
      return Promise.resolve();
    } catch (cause) {
      return Promise.reject(new InfrastructureError('Unable to save structured notes', { cause }));
    }
  }

  getBySessionId(sessionId: string): Promise<StructuredNotes | null> {
    try {
      const row = this.database
        .prepare('SELECT * FROM structured_notes WHERE session_id = ?')
        .get(sessionId) as NotesRow | undefined;
      if (!row) return Promise.resolve(null);
      return Promise.resolve({
        id: row.id,
        sessionId: row.session_id,
        transcriptId: row.transcript_id,
        summary: row.summary,
        topics: JSON.parse(row.topics_json) as StructuredNotes['topics'],
        keyConcepts: JSON.parse(row.key_concepts_json) as string[],
        tasks: JSON.parse(row.tasks_json) as string[],
        studyQuestions: JSON.parse(row.study_questions_json) as string[],
        importantMoments: JSON.parse(
          row.important_moments_json,
        ) as StructuredNotes['importantMoments'],
        examMentions: JSON.parse(row.exam_mentions_json) as string[],
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      });
    } catch (cause) {
      return Promise.reject(new InfrastructureError('Unable to load structured notes', { cause }));
    }
  }

  close(): void {
    this.database.close();
  }
}
