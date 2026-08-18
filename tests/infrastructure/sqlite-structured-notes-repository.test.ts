import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session, SessionType } from '@lecta/domain';
import {
  SqliteSessionRepository,
  SqliteStructuredNotesRepository,
  SqliteTranscriptionStore,
} from '@lecta/infrastructure';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('SqliteStructuredNotesRepository', () => {
  it('persists derived notes across reopen and replaces them on regeneration', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lecta-notes-'));
    directories.push(directory);
    const path = join(directory, 'lecta.sqlite');
    const sessions = new SqliteSessionRepository(path);
    await sessions.save(
      Session.create({ id: 'session-1', title: 'Clase', type: SessionType.CLASS }),
    );
    sessions.close();
    const transcripts = new SqliteTranscriptionStore(path);
    await transcripts.saveTranscript({
      id: 'transcript-1',
      sessionId: 'session-1',
      language: 'es',
      createdAt: new Date(),
      segments: [],
    });
    transcripts.close();
    const notes = new SqliteStructuredNotesRepository(path);
    const base = {
      id: 'notes-1',
      sessionId: 'session-1',
      transcriptId: 'transcript-1',
      summary: 'Inicial',
      topics: [],
      keyConcepts: ['A'],
      tasks: [],
      studyQuestions: [],
      importantMoments: [],
      examMentions: [],
      createdAt: new Date('2026-08-13T10:00:00Z'),
      updatedAt: new Date('2026-08-13T10:00:00Z'),
    };
    await notes.save(base);
    await notes.save({
      ...base,
      id: 'ignored-new-id',
      summary: 'Regenerado',
      updatedAt: new Date('2026-08-13T11:00:00Z'),
    });
    notes.close();
    const reopened = new SqliteStructuredNotesRepository(path);
    expect(await reopened.getBySessionId('session-1')).toMatchObject({
      id: 'notes-1',
      summary: 'Regenerado',
      keyConcepts: ['A'],
    });
    reopened.close();
  });
});
