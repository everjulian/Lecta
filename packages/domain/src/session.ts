import { DomainError } from './errors';

export enum SessionStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum SessionType {
  CLASS = 'CLASS',
  MEETING = 'MEETING',
  OTHER = 'OTHER',
}

export interface SessionProps {
  id: string;
  title: string;
  type: SessionType;
  subject: string | null;
  status: SessionStatus;
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
  tags?: readonly string[];
}

const transitions: Readonly<Record<SessionStatus, readonly SessionStatus[]>> = {
  [SessionStatus.IDLE]: [SessionStatus.RECORDING],
  [SessionStatus.RECORDING]: [SessionStatus.PAUSED, SessionStatus.PROCESSING],
  [SessionStatus.PAUSED]: [SessionStatus.RECORDING, SessionStatus.PROCESSING],
  [SessionStatus.PROCESSING]: [SessionStatus.COMPLETED, SessionStatus.FAILED],
  [SessionStatus.COMPLETED]: [],
  [SessionStatus.FAILED]: [],
};

export class Session {
  private constructor(private props: SessionProps) {}

  static create(input: {
    id: string;
    title: string;
    type: SessionType;
    subject?: string | null;
    tags?: readonly string[];
    now?: Date;
  }): Session {
    const title = input.title.trim();
    const subject = input.subject?.trim() || null;
    if (!input.id.trim()) throw new DomainError('Session id is required');
    if (!title) throw new DomainError('Session title is required');
    if (!Object.values(SessionType).includes(input.type)) {
      throw new DomainError('Session type is invalid');
    }
    const now = input.now ?? new Date();
    return new Session({
      id: input.id,
      title,
      type: input.type,
      subject,
      status: SessionStatus.IDLE,
      durationMs: 0,
      createdAt: now,
      updatedAt: now,
      tags: normalizeTags(input.tags),
    });
  }

  static restore(props: SessionProps): Session {
    if (props.durationMs < 0) throw new DomainError('Session duration cannot be negative');
    return new Session({ ...props, tags: normalizeTags(props.tags) });
  }

  transitionTo(next: SessionStatus, now = new Date()): void {
    if (!transitions[this.props.status].includes(next)) {
      throw new DomainError(`Invalid session transition: ${this.props.status} -> ${next}`);
    }
    const elapsed =
      this.props.status === SessionStatus.RECORDING
        ? Math.max(0, now.getTime() - this.props.updatedAt.getTime())
        : 0;
    this.props = {
      ...this.props,
      status: next,
      durationMs: this.props.durationMs + elapsed,
      updatedAt: now,
    };
  }

  get id(): string {
    return this.props.id;
  }
  get title(): string {
    return this.props.title;
  }
  get type(): SessionType {
    return this.props.type;
  }
  get subject(): string | null {
    return this.props.subject;
  }
  get status(): SessionStatus {
    return this.props.status;
  }
  get durationMs(): number {
    return this.props.durationMs;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get tags(): readonly string[] {
    return this.props.tags ?? [];
  }
  toPrimitives(): SessionProps {
    return { ...this.props };
  }
}

function normalizeTags(tags: readonly string[] | undefined): readonly string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}
