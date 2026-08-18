import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session, SessionStatus, SessionType } from '@lecta/domain';
import { SqliteSessionRepository } from '@lecta/infrastructure';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('SqliteSessionRepository', () => {
  it('persists and restores sessions after reopening the database', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lecta-test-'));
    directories.push(directory);
    const path = join(directory, 'lecta.sqlite');
    const created = Session.create({
      id: 'session-1',
      title: 'Álgebra lineal',
      type: SessionType.CLASS,
      subject: 'Matemáticas',
      now: new Date('2026-08-07T12:00:00Z'),
    });
    created.transitionTo(SessionStatus.RECORDING, new Date('2026-08-07T12:00:01Z'));

    const first = new SqliteSessionRepository(path);
    await first.save(created);
    first.close();

    const reopened = new SqliteSessionRepository(path);
    const restored = await reopened.getById('session-1');
    expect(restored?.toPrimitives()).toEqual(created.toPrimitives());
    expect(await reopened.list()).toHaveLength(1);
    reopened.close();
  });

  it('lists newest sessions first', async () => {
    const repository = new SqliteSessionRepository(':memory:');
    await repository.save(
      Session.create({
        id: 'old',
        title: 'Anterior',
        type: SessionType.OTHER,
        now: new Date('2026-01-01'),
      }),
    );
    await repository.save(
      Session.create({
        id: 'new',
        title: 'Reciente',
        type: SessionType.MEETING,
        now: new Date('2026-02-01'),
      }),
    );
    expect((await repository.list()).map((session) => session.id)).toEqual(['new', 'old']);
    repository.close();
  });
});
