import { describe, expect, it } from 'vitest';
import { DomainError, Session, SessionStatus, SessionType } from '@lecta/domain';

describe('Session', () => {
  it('creates an idle session with a normalized title', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const session = Session.create({
      id: 'session-1',
      title: '  Arquitectura  ',
      type: SessionType.CLASS,
      subject: '  Software  ',
      now,
    });
    expect(session.toPrimitives()).toEqual({
      id: 'session-1',
      title: 'Arquitectura',
      type: SessionType.CLASS,
      subject: 'Software',
      status: SessionStatus.IDLE,
      durationMs: 0,
      createdAt: now,
      updatedAt: now,
      tags: [],
    });
  });

  it('supports the recording lifecycle', () => {
    const session = Session.create({
      id: 'session-1',
      title: 'Clase',
      type: SessionType.CLASS,
      now: new Date(0),
    });
    session.transitionTo(SessionStatus.RECORDING, new Date(1_000));
    session.transitionTo(SessionStatus.PAUSED, new Date(6_000));
    session.transitionTo(SessionStatus.RECORDING, new Date(10_000));
    session.transitionTo(SessionStatus.PROCESSING, new Date(13_000));
    session.transitionTo(SessionStatus.COMPLETED, new Date(14_000));
    expect(session.status).toBe(SessionStatus.COMPLETED);
    expect(session.durationMs).toBe(8_000);
  });

  it('rejects an invalid transition', () => {
    const session = Session.create({ id: 'session-1', title: 'Clase', type: SessionType.CLASS });
    expect(() => session.transitionTo(SessionStatus.COMPLETED)).toThrow(DomainError);
  });
});
