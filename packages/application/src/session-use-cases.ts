import { Session, SessionStatus, type SessionType } from '@lecta/domain';
import type { Logger } from '@lecta/shared';
import { ApplicationError } from './errors';
import type { Clock, IdGenerator, SessionRepository } from './ports';

interface Dependencies {
  sessions: SessionRepository;
  clock: Clock;
  logger: Logger;
}

async function requireSession(sessions: SessionRepository, id: string): Promise<Session> {
  const session = await sessions.getById(id);
  if (!session) throw new ApplicationError('Session not found', 'SESSION_NOT_FOUND');
  return session;
}

export class CreateSession {
  constructor(private readonly deps: Dependencies & { ids: IdGenerator }) {}
  async execute(input: {
    title: string;
    type: SessionType;
    subject?: string | null;
    tags?: readonly string[];
  }): Promise<Session> {
    const session = Session.create({
      id: this.deps.ids.generate(),
      title: input.title,
      type: input.type,
      subject: input.subject,
      tags: input.tags,
      now: this.deps.clock.now(),
    });
    await this.deps.sessions.save(session);
    this.deps.logger.info('Session created', { sessionId: session.id });
    return session;
  }
}

abstract class TransitionSession {
  constructor(protected readonly deps: Dependencies) {}
  protected async transition(id: string, status: SessionStatus): Promise<Session> {
    const session = await requireSession(this.deps.sessions, id);
    session.transitionTo(status, this.deps.clock.now());
    await this.deps.sessions.save(session);
    return session;
  }
}

export class StartRecording extends TransitionSession {
  execute(id: string): Promise<Session> {
    return this.transition(id, SessionStatus.RECORDING);
  }
}
export class PauseRecording extends TransitionSession {
  execute(id: string): Promise<Session> {
    return this.transition(id, SessionStatus.PAUSED);
  }
}
export class ResumeRecording extends TransitionSession {
  execute(id: string): Promise<Session> {
    return this.transition(id, SessionStatus.RECORDING);
  }
}
export class FinishSession extends TransitionSession {
  async execute(id: string): Promise<Session> {
    const processing = await this.transition(id, SessionStatus.PROCESSING);
    processing.transitionTo(SessionStatus.COMPLETED, this.deps.clock.now());
    await this.deps.sessions.save(processing);
    return processing;
  }
}
export class FailInterruptedSession extends TransitionSession {
  async execute(id: string): Promise<Session> {
    const processing = await this.transition(id, SessionStatus.PROCESSING);
    processing.transitionTo(SessionStatus.FAILED, this.deps.clock.now());
    await this.deps.sessions.save(processing);
    return processing;
  }
}
export class StopRecording extends TransitionSession {
  execute(id: string): Promise<Session> {
    return this.transition(id, SessionStatus.PROCESSING);
  }
}

export class GetSession {
  constructor(private readonly sessions: SessionRepository) {}
  execute(id: string): Promise<Session> {
    return requireSession(this.sessions, id);
  }
}
export class ListSessions {
  constructor(private readonly sessions: SessionRepository) {}
  execute(): Promise<readonly Session[]> {
    return this.sessions.list();
  }
}
export class DeleteSession {
  constructor(private readonly sessions: SessionRepository) {}
  async execute(id: string): Promise<void> {
    await requireSession(this.sessions, id);
    await this.sessions.delete(id);
  }
}
