import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session, SessionType } from '@lecta/domain';
import {
  SqliteSessionRepository,
  SqliteStructuredNotesRepository,
  SqliteTranscriptionStore,
} from '@lecta/infrastructure';

let directory: string;
let sessions: SqliteSessionRepository;
let transcripts: SqliteTranscriptionStore;
let notes: SqliteStructuredNotesRepository;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'lecta-library-'));
  const databasePath = join(directory, 'lecta.sqlite');
  sessions = new SqliteSessionRepository(databasePath);
  transcripts = new SqliteTranscriptionStore(databasePath);
  notes = new SqliteStructuredNotesRepository(databasePath);
  for (let index = 1; index <= 15; index += 1) {
    await sessions.save(
      Session.create({
        id: `session-${index}`,
        title: `Sesión ${String(index).padStart(2, '0')}`,
        type: index % 2 === 0 ? SessionType.CLASS : SessionType.MEETING,
        subject: index % 2 === 0 ? 'Ingeniería de Software' : 'Proyecto X',
        tags: index === 2 ? ['universidad', 'parcial'] : [],
        now: new Date(`2026-08-${String(index).padStart(2, '0')}T12:00:00Z`),
      }),
    );
  }
});

afterEach(() => {
  notes.close();
  transcripts.close();
  sessions.close();
  rmSync(directory, { recursive: true });
});

describe('SQLite library', () => {
  it('searches title, transcript, notes, concepts and tasks without loading transcripts', async () => {
    await transcripts.saveTranscript({
      id: 'transcript-2',
      sessionId: 'session-2',
      language: 'es',
      createdAt: new Date(),
      segments: [
        {
          id: 'segment-2',
          sessionId: 'session-2',
          startTime: 0,
          endTime: 4,
          text: 'Explicación sobre arquitectura hexagonal',
        },
      ],
    });
    await notes.save({
      id: 'notes-2',
      sessionId: 'session-2',
      transcriptId: 'transcript-2',
      summary: 'Patrones de arquitectura',
      topics: [{ title: 'Puertos', notes: ['Separación de responsabilidades'] }],
      keyConcepts: ['adaptadores'],
      tasks: ['Entregar diagrama'],
      studyQuestions: ['¿Qué es un puerto?'],
      importantMoments: [],
      examMentions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    for (const text of ['Sesión 02', 'hexagonal', 'adaptadores', 'diagrama']) {
      const result = await sessions.search({ text, page: 1, pageSize: 10, sort: 'NEWEST' });
      expect(result.items.map((item) => item.id)).toContain('session-2');
    }
  });

  it('combines date, type and subject filters', async () => {
    const result = await sessions.search({
      type: 'CLASS',
      subject: 'Ingeniería de Software',
      dateFrom: new Date('2026-08-08T00:00:00Z'),
      dateTo: new Date('2026-08-12T23:59:59Z'),
      page: 1,
      pageSize: 20,
      sort: 'NEWEST',
    });
    expect(result.items.map((item) => item.id)).toEqual(['session-12', 'session-10', 'session-8']);
  });

  it('paginates deterministically and reports total', async () => {
    const result = await sessions.search({ page: 2, pageSize: 5, sort: 'NEWEST' });
    expect(result.total).toBe(15);
    expect(result.items.map((item) => item.id)).toEqual([
      'session-10',
      'session-9',
      'session-8',
      'session-7',
      'session-6',
    ]);
  });

  it('sorts oldest and newest and exposes subjects and tags', async () => {
    const oldest = await sessions.search({ page: 1, pageSize: 2, sort: 'OLDEST' });
    const newest = await sessions.search({ page: 1, pageSize: 2, sort: 'NEWEST' });
    expect(oldest.items[0]?.id).toBe('session-1');
    expect(newest.items[0]?.id).toBe('session-15');
    expect(
      (await sessions.search({ text: 'parcial', page: 1, pageSize: 5, sort: 'NEWEST' })).items[0]
        ?.tags,
    ).toContain('parcial');
    expect(await sessions.listSubjects()).toEqual(['Ingeniería de Software', 'Proyecto X']);
  });
});
