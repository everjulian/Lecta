import { fork, type ChildProcess } from 'node:child_process';
import type { Logger } from '@lecta/shared';
import type { KnowledgeMatch } from '@lecta/ai';
import {
  parseKnowledgeWorkerResponse,
  type IndexProgressMessage,
  type KnowledgeWorkerRequest,
  type KnowledgeWorkerResponse,
  type QueryProgressMessage,
} from './contracts';

export interface KnowledgeWorkerClientOptions {
  readonly entrypoint: string;
  readonly databasePath: string;
  readonly modelDirectory: string;
  readonly model: string;
  readonly logger: Logger;
  readonly timeoutMs?: number;
  readonly cancelGraceMs?: number;
  readonly processFactory?: typeof fork;
}

interface PendingRequest {
  readonly resolve: (message: KnowledgeWorkerResponse) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly onProgress?: (message: IndexProgressMessage | QueryProgressMessage) => void;
}

export class KnowledgeWorkerError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = 'KnowledgeWorkerError';
  }
}

export class KnowledgeWorkerClient {
  private child: ChildProcess | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private shuttingDown = false;

  constructor(private readonly options: KnowledgeWorkerClientOptions) {}

  async index(
    signal?: AbortSignal,
    onProgress?: (progress: IndexProgressMessage) => void,
  ): Promise<number> {
    const response = await this.request(
      { type: 'INDEX_START', requestId: crypto.randomUUID() },
      signal,
      onProgress
        ? (progress) => {
            if (progress.type === 'INDEX_PROGRESS') onProgress(progress);
          }
        : undefined,
    );
    if (response.type !== 'INDEX_COMPLETE')
      throw new KnowledgeWorkerError('Unexpected index response', 'INVALID_RESPONSE');
    return response.indexed;
  }

  async query(
    query: string,
    limit = 6,
    signal?: AbortSignal,
    onProgress?: (progress: QueryProgressMessage) => void,
  ): Promise<readonly KnowledgeMatch[]> {
    const response = await this.request(
      { type: 'QUERY_START', requestId: crypto.randomUUID(), query, limit },
      signal,
      onProgress
        ? (progress) => {
            if (progress.type === 'QUERY_PROGRESS') onProgress(progress);
          }
        : undefined,
    );
    if (response.type !== 'QUERY_COMPLETE')
      throw new KnowledgeWorkerError('Unexpected query response', 'INVALID_RESPONSE');
    return response.matches;
  }

  restart(): Promise<void> {
    return this.stopChild('Knowledge worker restarted').then(() => {
      this.ensureChild();
    });
  }

  shutdown(): Promise<void> {
    this.shuttingDown = true;
    return this.stopChild('Knowledge worker shut down');
  }

  private request(
    message: Exclude<KnowledgeWorkerRequest, { type: 'CANCEL' }>,
    signal?: AbortSignal,
    onProgress?: PendingRequest['onProgress'],
  ): Promise<KnowledgeWorkerResponse> {
    if (signal?.aborted) return Promise.reject(abortError());
    const child = this.ensureChild();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cancel(
          message.requestId,
          new KnowledgeWorkerError('Knowledge worker timed out', 'TIMEOUT'),
        );
      }, this.options.timeoutMs ?? 120_000);
      this.pending.set(message.requestId, { resolve, reject, timer, onProgress });
      const abort = () => this.cancel(message.requestId, abortError());
      signal?.addEventListener('abort', abort, { once: true });
      child.send(message, (error) => {
        if (error)
          this.rejectPending(
            message.requestId,
            new KnowledgeWorkerError(error.message, 'SEND_FAILED'),
          );
      });
    });
  }

  private ensureChild(): ChildProcess {
    if (this.child?.connected) return this.child;
    this.shuttingDown = false;
    const child = (this.options.processFactory ?? fork)(
      this.options.entrypoint,
      [this.options.databasePath, this.options.modelDirectory, this.options.model],
      {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: knowledgeWorkerEnvironment(),
      },
    );
    this.child = child;
    child.on('message', (value) => this.handleMessage(value));
    child.on('error', (error) => this.handleFailure(error));
    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null;
      if (!this.shuttingDown)
        this.handleFailure(
          new KnowledgeWorkerError(
            `Knowledge worker exited (${String(code ?? signal ?? 'unknown')})`,
            'WORKER_EXIT',
          ),
        );
    });
    this.options.logger.info('Knowledge worker started', { pid: child.pid });
    return child;
  }

  private handleMessage(value: unknown): void {
    const message = parseKnowledgeWorkerResponse(value);
    if (!message) {
      this.handleFailure(
        new KnowledgeWorkerError('Invalid knowledge worker message', 'INVALID_MESSAGE'),
      );
      void this.stopChild('Invalid worker message');
      return;
    }
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    if (message.type === 'INDEX_PROGRESS' || message.type === 'QUERY_PROGRESS') {
      pending.onProgress?.(message);
      return;
    }
    this.pending.delete(message.requestId);
    clearTimeout(pending.timer);
    if (message.type === 'INDEX_FAILED' || message.type === 'QUERY_FAILED') {
      pending.reject(
        new KnowledgeWorkerError(
          message.error.message,
          message.error.code,
          message.error.retryable,
        ),
      );
      return;
    }
    pending.resolve(message);
  }

  private cancel(requestId: string, error: Error): void {
    if (!this.pending.has(requestId)) return;
    this.child?.send({ type: 'CANCEL', requestId } satisfies KnowledgeWorkerRequest);
    this.rejectPending(requestId, error);
    setTimeout(() => {
      if (this.child) void this.stopChild('Knowledge operation cancelled');
    }, this.options.cancelGraceMs ?? 25).unref();
  }

  private rejectPending(requestId: string, error: Error): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  private handleFailure(error: Error): void {
    this.options.logger.error('Knowledge worker failed', error);
    for (const requestId of [...this.pending.keys()]) this.rejectPending(requestId, error);
  }

  private stopChild(reason: string): Promise<void> {
    const child = this.child;
    this.child = null;
    this.handleFailure(new KnowledgeWorkerError(reason, 'WORKER_STOPPED'));
    if (!child) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      child.once('exit', done);
      if (child.connected) child.disconnect();
      if (!child.kill()) resolve();
      setTimeout(done, 500).unref();
    });
  }
}

function abortError(): KnowledgeWorkerError {
  return new KnowledgeWorkerError('Knowledge operation cancelled', 'CANCELLED');
}

function knowledgeWorkerEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    'PATH',
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
    'LOCALAPPDATA',
    'APPDATA',
    'NODE_ENV',
  ] as const;
  const environment: NodeJS.ProcessEnv = { ELECTRON_RUN_AS_NODE: '1' };
  for (const name of allowed) {
    const value = process.env[name];
    if (value !== undefined) environment[name] = value;
  }
  return environment;
}
