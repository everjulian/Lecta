import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session, SessionType } from '@lecta/domain';
import { SqliteSessionRepository, SqliteTranscriptionStore } from '@lecta/infrastructure';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('SqliteTranscriptionStore', () => {
  it('persists jobs, transcripts, segments and timestamps across reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lecta-transcript-'));
    directories.push(directory);
    const databasePath = join(directory, 'lecta.sqlite');
    const sessions = new SqliteSessionRepository(databasePath);
    await sessions.save(
      Session.create({ id: 'session-1', title: 'Clase', type: SessionType.CLASS }),
    );
    sessions.close();
    const store = new SqliteTranscriptionStore(databasePath);
    await store.save({
      id: 'job-1',
      sessionId: 'session-1',
      recordingPath: 'audio.webm',
      model: 'small',
      resourceMode: 'LIGHT',
      status: 'COMPLETED',
      progress: 100,
      error: null,
      createdAt: new Date('2026-08-07T12:00:00Z'),
      updatedAt: new Date('2026-08-07T12:05:00Z'),
    });
    await store.saveTranscript({
      id: 'transcript-1',
      sessionId: 'session-1',
      language: 'es',
      createdAt: new Date('2026-08-07T12:05:00Z'),
      segments: [
        {
          id: 'segment-1',
          sessionId: 'session-1',
          startTime: 272,
          endTime: 287,
          text: 'Ahora veremos arquitectura hexagonal.',
        },
      ],
    });
    store.close();
    const reopened = new SqliteTranscriptionStore(databasePath);
    expect((await reopened.getBySessionId('session-1'))?.status).toBe('COMPLETED');
    expect((await reopened.getTranscriptBySessionId('session-1'))?.segments[0]).toMatchObject({
      startTime: 272,
      endTime: 287,
    });
    reopened.close();
  });
});
