import { EventEmitter } from 'node:events';
import type { ChildProcess, ForkOptions, fork } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullLogger } from '@lecta/shared';
import {
  KnowledgeWorkerClient,
  KnowledgeWorkerError,
} from '../../workers/knowledge-worker/src/knowledge-worker-client';
import {
  parseKnowledgeWorkerRequest,
  parseKnowledgeWorkerResponse,
  type KnowledgeWorkerRequest,
  type KnowledgeWorkerResponse,
} from '../../workers/knowledge-worker/src/contracts';

class FakeChildProcess extends EventEmitter {
  connected = true;
  readonly pid = 1234;
  readonly sent: KnowledgeWorkerRequest[] = [];
  killed = false;
  onSend?: (message: KnowledgeWorkerRequest) => void;

  send(value: unknown, callback?: (error: Error | null) => void): boolean {
    const message = parseKnowledgeWorkerRequest(value);
    if (message) {
      this.sent.push(message);
      this.onSend?.(message);
    }
    callback?.(null);
    return true;
  }

  disconnect(): void {
    this.connected = false;
  }

  kill(): boolean {
    if (this.killed) return false;
    this.killed = true;
    this.connected = false;
    queueMicrotask(() => this.emit('exit', 0, null));
    return true;
  }

  respond(message: KnowledgeWorkerResponse): void {
    this.emit('message', message);
  }

  crash(): void {
    this.connected = false;
    this.emit('exit', 1, null);
  }
}

const clients: KnowledgeWorkerClient[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.shutdown()));
  vi.useRealTimers();
});

describe('KnowledgeWorkerClient', () => {
  it('starts lazily, indexes with progress and shuts down', async () => {
    const child = new FakeChildProcess();
    const client = createClient([child]);
    const progress = vi.fn();
    child.onSend = (message) => {
      if (message.type !== 'INDEX_START') return;
      child.respond({
        type: 'INDEX_PROGRESS',
        requestId: message.requestId,
        completed: 1,
        total: 2,
        percent: 50,
      });
      child.respond({
        type: 'INDEX_COMPLETE',
        requestId: message.requestId,
        indexed: 12,
        durationMs: 20,
      });
    };

    await expect(client.index(undefined, progress)).resolves.toBe(12);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ percent: 50 }));
    await client.shutdown();
    expect(child.killed).toBe(true);
  });

  it('queries and returns ranked matches', async () => {
    const child = new FakeChildProcess();
    const client = createClient([child]);
    child.onSend = (message) => {
      if (message.type !== 'QUERY_START') return;
      child.respond({
        type: 'QUERY_COMPLETE',
        requestId: message.requestId,
        matches: [
          {
            id: 'chunk-1',
            sessionId: 'session-1',
            startTime: 1,
            endTime: 2,
            text: 'Clean Architecture',
            score: 0.91,
          },
        ],
        durationMs: 4,
      });
    };

    await expect(client.query('arquitectura')).resolves.toMatchObject([
      { id: 'chunk-1', score: 0.91 },
    ]);
  });

  it('cancels an active operation and terminates native work', async () => {
    const child = new FakeChildProcess();
    const client = createClient([child], { cancelGraceMs: 0 });
    const controller = new AbortController();
    const operation = client.query('cancelar', 6, controller.signal);
    controller.abort();

    await expect(operation).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(child.killed).toBe(true));
    expect(child.sent.some((message) => message.type === 'CANCEL')).toBe(true);
  });

  it('isolates a crash and starts a clean worker on the next operation', async () => {
    const first = new FakeChildProcess();
    const second = new FakeChildProcess();
    const client = createClient([first, second]);
    const failed = client.index();
    first.crash();
    await expect(failed).rejects.toMatchObject({ code: 'WORKER_EXIT' });
    second.onSend = (message) => {
      if (message.type === 'INDEX_START')
        second.respond({
          type: 'INDEX_COMPLETE',
          requestId: message.requestId,
          indexed: 0,
          durationMs: 1,
        });
    };
    await expect(client.index()).resolves.toBe(0);
  });

  it('supports an explicit restart', async () => {
    const first = new FakeChildProcess();
    const second = new FakeChildProcess();
    const client = createClient([first, second]);
    const pending = client.index();
    await client.restart();
    await expect(pending).rejects.toMatchObject({ code: 'WORKER_STOPPED' });
    expect(first.killed).toBe(true);
    expect(second.connected).toBe(true);
  });

  it('rejects invalid worker messages without crashing the coordinator', async () => {
    const child = new FakeChildProcess();
    const client = createClient([child]);
    const pending = client.index();
    child.emit('message', { type: 'UNKNOWN', requestId: crypto.randomUUID() });
    await expect(pending).rejects.toMatchObject({ code: 'INVALID_MESSAGE' });
    await vi.waitFor(() => expect(child.killed).toBe(true));
  });

  it('times out and recovers through process termination', async () => {
    const child = new FakeChildProcess();
    const client = createClient([child], { timeoutMs: 5, cancelGraceMs: 0 });
    await expect(client.index()).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.waitFor(() => expect(child.killed).toBe(true));
  });

  it('starts as Node without forwarding product secrets', async () => {
    const child = new FakeChildProcess();
    let spawnOptions: ForkOptions | undefined;
    const processFactory = ((
      _modulePath: string,
      _args: readonly string[],
      options: ForkOptions,
    ) => {
      spawnOptions = options;
      return child as unknown as ChildProcess;
    }) as typeof fork;
    const previousApiKey = process.env['LECTA_AI_API_KEY'];
    process.env['LECTA_AI_API_KEY'] = 'must-not-reach-worker';
    const client = new KnowledgeWorkerClient({
      entrypoint: 'knowledge-worker.js',
      databasePath: 'lecta.sqlite',
      modelDirectory: 'models',
      model: 'test-model',
      logger: new NullLogger(),
      processFactory,
    });
    clients.push(client);
    child.onSend = (message) => {
      if (message.type === 'INDEX_START')
        child.respond({
          type: 'INDEX_COMPLETE',
          requestId: message.requestId,
          indexed: 0,
          durationMs: 1,
        });
    };

    try {
      await client.index();
      expect(spawnOptions?.env?.['ELECTRON_RUN_AS_NODE']).toBe('1');
      expect(spawnOptions?.env?.['LECTA_AI_API_KEY']).toBeUndefined();
    } finally {
      if (previousApiKey === undefined) delete process.env['LECTA_AI_API_KEY'];
      else process.env['LECTA_AI_API_KEY'] = previousApiKey;
    }
  });
});

describe('knowledge worker contracts', () => {
  it('rejects unknown, oversized and structurally invalid messages', () => {
    expect(parseKnowledgeWorkerRequest({ type: 'INDEX_START', requestId: 'short' })).toBeNull();
    expect(
      parseKnowledgeWorkerRequest({
        type: 'QUERY_START',
        requestId: crypto.randomUUID(),
        query: 'x'.repeat(501),
        limit: 6,
      }),
    ).toBeNull();
    expect(
      parseKnowledgeWorkerResponse({
        type: 'QUERY_COMPLETE',
        requestId: crypto.randomUUID(),
        matches: [{ score: Number.NaN }],
        durationMs: 1,
      }),
    ).toBeNull();
  });
});

function createClient(
  children: FakeChildProcess[],
  overrides: { timeoutMs?: number; cancelGraceMs?: number } = {},
): KnowledgeWorkerClient {
  const processFactory = (() => {
    const child = children.shift();
    if (!child) throw new KnowledgeWorkerError('No fake worker available', 'TEST_SETUP');
    return child as unknown as ChildProcess;
  }) as typeof fork;
  const client = new KnowledgeWorkerClient({
    entrypoint: 'knowledge-worker.js',
    databasePath: 'lecta.sqlite',
    modelDirectory: 'models',
    model: 'test-model',
    logger: new NullLogger(),
    processFactory,
    ...overrides,
  });
  clients.push(client);
  return client;
}
