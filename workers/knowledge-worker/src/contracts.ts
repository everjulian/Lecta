import type { KnowledgeMatch } from '@lecta/ai';

export interface IndexStartMessage {
  readonly type: 'INDEX_START';
  readonly requestId: string;
}

export interface QueryStartMessage {
  readonly type: 'QUERY_START';
  readonly requestId: string;
  readonly query: string;
  readonly limit: number;
}

export interface CancelMessage {
  readonly type: 'CANCEL';
  readonly requestId: string;
}

export type KnowledgeWorkerRequest = IndexStartMessage | QueryStartMessage | CancelMessage;

export interface IndexProgressMessage {
  readonly type: 'INDEX_PROGRESS';
  readonly requestId: string;
  readonly completed: number;
  readonly total: number;
  readonly percent: number;
}

export interface IndexCompleteMessage {
  readonly type: 'INDEX_COMPLETE';
  readonly requestId: string;
  readonly indexed: number;
  readonly durationMs: number;
}

export interface QueryProgressMessage {
  readonly type: 'QUERY_PROGRESS';
  readonly requestId: string;
  readonly stage: 'EMBEDDING' | 'RANKING';
  readonly percent: number;
}

export interface QueryCompleteMessage {
  readonly type: 'QUERY_COMPLETE';
  readonly requestId: string;
  readonly matches: readonly KnowledgeMatch[];
  readonly durationMs: number;
}

export interface WorkerFailureMessage {
  readonly type: 'INDEX_FAILED' | 'QUERY_FAILED';
  readonly requestId: string;
  readonly error: { readonly code: string; readonly message: string; readonly retryable: boolean };
}

export type KnowledgeWorkerResponse =
  | IndexProgressMessage
  | IndexCompleteMessage
  | QueryProgressMessage
  | QueryCompleteMessage
  | WorkerFailureMessage;

export function parseKnowledgeWorkerRequest(value: unknown): KnowledgeWorkerRequest | null {
  if (!isRecord(value) || !isRequestId(value['requestId']) || typeof value['type'] !== 'string')
    return null;
  if (value['type'] === 'INDEX_START' || value['type'] === 'CANCEL')
    return { type: value['type'], requestId: value['requestId'] };
  if (
    value['type'] === 'QUERY_START' &&
    typeof value['query'] === 'string' &&
    value['query'].trim().length > 0 &&
    value['query'].length <= 500 &&
    Number.isInteger(value['limit']) &&
    Number(value['limit']) >= 1 &&
    Number(value['limit']) <= 50
  )
    return {
      type: 'QUERY_START',
      requestId: value['requestId'],
      query: value['query'].trim(),
      limit: Number(value['limit']),
    };
  return null;
}

export function parseKnowledgeWorkerResponse(value: unknown): KnowledgeWorkerResponse | null {
  if (!isRecord(value) || !isRequestId(value['requestId']) || typeof value['type'] !== 'string')
    return null;
  const requestId = value['requestId'];
  if (
    value['type'] === 'INDEX_PROGRESS' &&
    isFiniteNumber(value['completed']) &&
    isFiniteNumber(value['total']) &&
    isPercent(value['percent'])
  )
    return {
      type: value['type'],
      requestId,
      completed: value['completed'],
      total: value['total'],
      percent: value['percent'],
    };
  if (
    value['type'] === 'INDEX_COMPLETE' &&
    isFiniteNumber(value['indexed']) &&
    isFiniteNumber(value['durationMs'])
  )
    return {
      type: value['type'],
      requestId,
      indexed: value['indexed'],
      durationMs: value['durationMs'],
    };
  if (
    value['type'] === 'QUERY_PROGRESS' &&
    (value['stage'] === 'EMBEDDING' || value['stage'] === 'RANKING') &&
    isPercent(value['percent'])
  )
    return {
      type: value['type'],
      requestId,
      stage: value['stage'],
      percent: value['percent'],
    };
  if (
    value['type'] === 'QUERY_COMPLETE' &&
    Array.isArray(value['matches']) &&
    value['matches'].every(isKnowledgeMatch) &&
    isFiniteNumber(value['durationMs'])
  )
    return {
      type: value['type'],
      requestId,
      matches: value['matches'],
      durationMs: value['durationMs'],
    };
  if (
    (value['type'] === 'INDEX_FAILED' || value['type'] === 'QUERY_FAILED') &&
    isWorkerError(value['error'])
  )
    return { type: value['type'], requestId, error: value['error'] };
  return null;
}

function isKnowledgeMatch(value: unknown): value is KnowledgeMatch {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['sessionId'] === 'string' &&
    typeof value['text'] === 'string' &&
    isFiniteNumber(value['startTime']) &&
    isFiniteNumber(value['endTime']) &&
    isFiniteNumber(value['score'])
  );
}

function isWorkerError(value: unknown): value is WorkerFailureMessage['error'] {
  return (
    isRecord(value) &&
    typeof value['code'] === 'string' &&
    typeof value['message'] === 'string' &&
    typeof value['retryable'] === 'boolean'
  );
}

function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d-]{16,64}$/i.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPercent(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
