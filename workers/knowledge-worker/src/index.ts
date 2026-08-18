import { SqliteKnowledgeStore } from '@lecta/infrastructure';
import { IndexKnowledge, KnowledgeRetriever, TransformersEmbeddingProvider } from '@lecta/ai';
import { parseKnowledgeWorkerRequest, type KnowledgeWorkerResponse } from './contracts';

const [databasePath, modelDirectory, model] = process.argv.slice(2);
const sendToParent = process.send?.bind(process);
if (!databasePath || !modelDirectory || !model || !sendToParent)
  throw new Error('Knowledge worker configuration is incomplete');

const store = new SqliteKnowledgeStore(databasePath);
const embeddings = new TransformersEmbeddingProvider(model, modelDirectory);
const indexer = new IndexKnowledge(store, embeddings, store);
const retriever = new KnowledgeRetriever(embeddings, store);
const operations = new Map<string, AbortController>();

process.on('message', (value: unknown) => {
  const message = parseKnowledgeWorkerRequest(value);
  if (!message) {
    process.disconnect?.();
    return;
  }
  if (message.type === 'CANCEL') {
    operations.get(message.requestId)?.abort();
    return;
  }
  if (operations.size > 0) {
    send({
      type: message.type === 'INDEX_START' ? 'INDEX_FAILED' : 'QUERY_FAILED',
      requestId: message.requestId,
      error: { code: 'BUSY', message: 'Knowledge worker is busy', retryable: true },
    });
    return;
  }
  const controller = new AbortController();
  operations.set(message.requestId, controller);
  if (message.type === 'INDEX_START') void runIndex(message.requestId, controller);
  else void runQuery(message.requestId, message.query, message.limit, controller);
});

process.on('disconnect', () => {
  for (const controller of operations.values()) controller.abort();
  store.close();
});

async function runIndex(requestId: string, controller: AbortController): Promise<void> {
  const started = performance.now();
  try {
    const indexed = await indexer.execute({
      signal: controller.signal,
      onProgress: ({ completed, total }) =>
        send({
          type: 'INDEX_PROGRESS',
          requestId,
          completed,
          total,
          percent: total === 0 ? 100 : Math.round((completed / total) * 100),
        }),
    });
    send({ type: 'INDEX_COMPLETE', requestId, indexed, durationMs: performance.now() - started });
  } catch (error) {
    sendFailure('INDEX_FAILED', requestId, error);
  } finally {
    operations.delete(requestId);
  }
}

async function runQuery(
  requestId: string,
  query: string,
  limit: number,
  controller: AbortController,
): Promise<void> {
  const started = performance.now();
  try {
    send({ type: 'QUERY_PROGRESS', requestId, stage: 'EMBEDDING', percent: 10 });
    const matches = await retriever.retrieve(query, limit, controller.signal, () =>
      send({ type: 'QUERY_PROGRESS', requestId, stage: 'RANKING', percent: 60 }),
    );
    send({
      type: 'QUERY_COMPLETE',
      requestId,
      matches,
      durationMs: performance.now() - started,
    });
  } catch (error) {
    sendFailure('QUERY_FAILED', requestId, error);
  } finally {
    operations.delete(requestId);
  }
}

function send(message: KnowledgeWorkerResponse): void {
  sendToParent?.(message);
}

function sendFailure(
  type: 'INDEX_FAILED' | 'QUERY_FAILED',
  requestId: string,
  error: unknown,
): void {
  const cancelled = error instanceof Error && error.name === 'AbortError';
  send({
    type,
    requestId,
    error: {
      code: cancelled ? 'CANCELLED' : 'OPERATION_FAILED',
      message: cancelled ? 'Knowledge operation cancelled' : 'Knowledge operation failed',
      retryable: true,
    },
  });
}
