import type { Clock, IdGenerator, SessionRepository } from '@lecta/application';
import { Session } from '@lecta/domain';

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, ReturnType<Session['toPrimitives']>>();
  save(session: Session): Promise<void> {
    this.sessions.set(session.id, session.toPrimitives());
    return Promise.resolve();
  }
  getById(id: string): Promise<Session | null> {
    const props = this.sessions.get(id);
    return Promise.resolve(props ? Session.restore(props) : null);
  }
  list(): Promise<readonly Session[]> {
    return Promise.resolve([...this.sessions.values()].map((props) => Session.restore(props)));
  }
  delete(id: string): Promise<void> {
    this.sessions.delete(id);
    return Promise.resolve();
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
export class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}

export { SqliteSessionRepository } from './sqlite/sqlite-session-repository';
export { InfrastructureError } from './errors';
export * from './recording/file-recording-store';
export * from './recording/file-preference-store';
export * from './sqlite/sqlite-transcription-store';
export * from './sqlite/sqlite-structured-notes-repository';
export * from './sqlite/sqlite-knowledge-store';
