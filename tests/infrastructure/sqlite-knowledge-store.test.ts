import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session, SessionType } from '@lecta/domain';
import { IndexKnowledge } from '@lecta/ai';
import {
  SqliteKnowledgeStore,
  SqliteSessionRepository,
  SqliteTranscriptionStore,
} from '@lecta/infrastructure';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('SqliteKnowledgeStore', () => {
  it('persists vectors, ranks by cosine and enriches citations from local metadata', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lecta-knowledge-'));
    directories.push(directory);
    const path = join(directory, 'lecta.sqlite');
    const sessions = new SqliteSessionRepository(path);
    await sessions.save(
      Session.create({
        id: 'session-1',
        title: 'Clase REST',
        type: SessionType.CLASS,
        now: new Date('2026-08-07'),
      }),
    );
    sessions.close();
    const transcripts = new SqliteTranscriptionStore(path);
    await transcripts.saveTranscript({
      id: 'transcript-1',
      sessionId: 'session-1',
      language: 'es',
      createdAt: new Date(),
      segments: [
        {
          id: 'segment-1',
          sessionId: 'session-1',
          startTime: 12,
          endTime: 20,
          text: 'Diseño de APIs REST',
        },
      ],
    });
    transcripts.close();
    const store = new SqliteKnowledgeStore(path);
    expect((await store.list())[0]?.segments[0]).toEqual({
      startTime: 12,
      endTime: 20,
      text: 'Diseño de APIs REST',
    });
    const indexer = new IndexKnowledge(
      store,
      {
        model: 'indexed-model',
        embed: (texts) => Promise.resolve(texts.map(() => [1, 0])),
      },
      store,
    );
    await expect(indexer.execute()).resolves.toBe(1);
    expect(await store.isIndexed('session-1', 'transcript-1', 'indexed-model')).toBe(true);
    await store.replaceSession('session-1', 'transcript-1', [
      {
        id: 'close',
        sessionId: 'session-1',
        startTime: 12,
        endTime: 20,
        text: 'APIs REST',
        embedding: [1, 0],
        model: 'test',
      },
      {
        id: 'far',
        sessionId: 'session-1',
        startTime: 30,
        endTime: 40,
        text: 'Otro',
        embedding: [0, 1],
        model: 'test',
      },
    ]);
    const matches = await store.search([0.9, 0.1], 'test', 2);
    expect(matches.map((item) => item.id)).toEqual(['close', 'far']);
    expect(await store.enrich([matches[0]!])).toMatchObject([
      { sessionTitle: 'Clase REST', sessionId: 'session-1', startTime: 12 },
    ]);
    expect(await store.isIndexed('session-1', 'transcript-1', 'test')).toBe(true);
    store.close();
  });
});
