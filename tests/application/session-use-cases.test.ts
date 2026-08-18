import { describe, expect, it } from 'vitest';
import {
  CreateSession,
  DeleteSession,
  FinishSession,
  GetSession,
  ListSessions,
  PauseRecording,
  ResumeRecording,
  StartRecording,
} from '@lecta/application';
import { SessionStatus, SessionType } from '@lecta/domain';
import { InMemorySessionRepository } from '@lecta/infrastructure';
import { NullLogger } from '@lecta/shared';

const clock = { now: () => new Date('2026-01-01T00:00:00Z') };
const ids = { generate: () => 'session-1' };

describe('session use cases', () => {
  it('creates, stores and lists a session', async () => {
    const sessions = new InMemorySessionRepository();
    const created = await new CreateSession({
      sessions,
      clock,
      ids,
      logger: new NullLogger(),
    }).execute({ title: 'Clase', type: SessionType.CLASS });
    expect((await new GetSession(sessions).execute(created.id)).title).toBe('Clase');
    expect(await new ListSessions(sessions).execute()).toHaveLength(1);
  });

  it('starts a stored session', async () => {
    const sessions = new InMemorySessionRepository();
    await new CreateSession({ sessions, clock, ids, logger: new NullLogger() }).execute({
      title: 'Clase',
      type: SessionType.CLASS,
    });
    const session = await new StartRecording({ sessions, clock, logger: new NullLogger() }).execute(
      'session-1',
    );
    expect(session.status).toBe(SessionStatus.RECORDING);
  });

  it('pauses, resumes and finishes a session', async () => {
    const sessions = new InMemorySessionRepository();
    const dependencies = { sessions, clock, logger: new NullLogger() };
    await new CreateSession({ ...dependencies, ids }).execute({
      title: 'Clase',
      type: SessionType.CLASS,
    });
    await new StartRecording(dependencies).execute('session-1');
    await new PauseRecording(dependencies).execute('session-1');
    await new ResumeRecording(dependencies).execute('session-1');
    const finished = await new FinishSession(dependencies).execute('session-1');
    expect(finished.status).toBe(SessionStatus.COMPLETED);
  });

  it('rejects an invalid application transition', async () => {
    const sessions = new InMemorySessionRepository();
    const dependencies = { sessions, clock, logger: new NullLogger() };
    await new CreateSession({ ...dependencies, ids }).execute({
      title: 'Clase',
      type: SessionType.CLASS,
    });
    await expect(new PauseRecording(dependencies).execute('session-1')).rejects.toThrow(
      'Invalid session transition',
    );
  });

  it('deletes an existing session', async () => {
    const sessions = new InMemorySessionRepository();
    await new CreateSession({ sessions, clock, ids, logger: new NullLogger() }).execute({
      title: 'Clase',
      type: SessionType.CLASS,
    });
    await new DeleteSession(sessions).execute('session-1');
    expect(await sessions.list()).toHaveLength(0);
  });
});
