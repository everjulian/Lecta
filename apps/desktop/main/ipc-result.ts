import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { Logger } from '@lecta/shared';
import type { ErrorCode, IpcErrorDto, IpcResult } from '../shared/session-contracts.js';

type Handler<T> = (event: IpcMainInvokeEvent, ...argumentsList: unknown[]) => T | Promise<T>;

interface ErrorDefinition {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly safeStateMessage: string;
  readonly retryable: boolean;
}

const definitions: Readonly<Record<ErrorCode, Omit<ErrorDefinition, 'code'>>> = {
  RECORDING_DEVICE_UNAVAILABLE: {
    userMessage: 'No pudimos acceder al dispositivo de grabación seleccionado.',
    safeStateMessage: 'No se inició ninguna grabación. Tus sesiones existentes siguen seguras.',
    retryable: true,
  },
  RECORDING_FILE_MISSING: {
    userMessage: 'No encontramos el archivo de grabación de esta sesión.',
    safeStateMessage: 'La sesión y cualquier transcripción existente no fueron eliminadas.',
    retryable: false,
  },
  TRANSCRIPTION_FAILED: {
    userMessage: 'No pudimos completar la transcripción.',
    safeStateMessage: 'Tu grabación sigue segura y puedes intentarlo nuevamente.',
    retryable: true,
  },
  AI_UNAVAILABLE: {
    userMessage: 'No pudimos preparar tus apuntes.',
    safeStateMessage: 'Tu grabación y transcripción siguen seguras.',
    retryable: true,
  },
  KNOWLEDGE_INDEX_FAILED: {
    userMessage: 'No pudimos consultar el conocimiento de tus sesiones.',
    safeStateMessage: 'Tus sesiones y transcripciones siguen disponibles.',
    retryable: true,
  },
  DATABASE_BUSY: {
    userMessage: 'Lecta está terminando otra operación local.',
    safeStateMessage: 'Tus datos siguen seguros. Espera un momento antes de reintentar.',
    retryable: true,
  },
  STORAGE_FULL: {
    userMessage: 'No hay espacio suficiente para guardar esta operación.',
    safeStateMessage: 'Los datos guardados anteriormente no fueron eliminados.',
    retryable: false,
  },
  UNKNOWN_ERROR: {
    userMessage: 'No pudimos completar la operación.',
    safeStateMessage: 'Tus datos existentes permanecen sin cambios.',
    retryable: true,
  },
};

const databaseReadOperations = new Set([
  'session:get',
  'session:list',
  'session:search-library',
  'session:list-subjects',
  'recording:list-incomplete',
  'recording:get-microphone-preference',
  'transcription:get-job',
  'transcription:get-transcript',
  'ai:get-notes',
]);

export function registerIpcHandler<T>(channel: string, logger: Logger, handler: Handler<T>): void {
  ipcMain.handle(channel, async (event, ...argumentsList: unknown[]): Promise<IpcResult<T>> => {
    try {
      return {
        success: true,
        data: await executeWithRecovery(channel, () => handler(event, ...argumentsList)),
      };
    } catch (cause) {
      const error = mapIpcError(cause, channel);
      logger.error('IPC operation failed', undefined, {
        technicalDetailsId: error.technicalDetailsId,
        operation: channel,
        errorCode: error.code,
        errorType: cause instanceof Error ? cause.name : typeof cause,
        systemCode: systemCodeOf(cause),
      });
      return { success: false, error };
    }
  });
}

export async function executeWithRecovery<T>(operation: string, action: () => Promise<T> | T) {
  const delays = databaseReadOperations.has(operation) ? [50, 150] : [];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await action();
    } catch (cause) {
      const delay = delays[attempt];
      if (delay === undefined || classifyError(cause, operation) !== 'DATABASE_BUSY') throw cause;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, delay));
    }
  }
}

export function mapIpcError(cause: unknown, operation: string): IpcErrorDto {
  const code = classifyError(cause, operation);
  return createIpcError(code);
}

export function createIpcError(
  code: ErrorCode,
  technicalDetailsId: string = crypto.randomUUID(),
): IpcErrorDto {
  return { ...definitions[code], code, technicalDetailsId };
}

export function classifyError(cause: unknown, operation: string): ErrorCode {
  const systemCode = systemCodeOf(cause);
  if (systemCode === 'SQLITE_BUSY' || systemCode === 'SQLITE_LOCKED') return 'DATABASE_BUSY';
  if (systemCode === 'ENOSPC') return 'STORAGE_FULL';
  if (systemCode === 'ENOENT' && operation.startsWith('recording:'))
    return 'RECORDING_FILE_MISSING';
  if (systemCode === 'ENOENT' && operation === 'transcription:enqueue')
    return 'RECORDING_FILE_MISSING';
  if (operation.startsWith('recording:')) return 'RECORDING_DEVICE_UNAVAILABLE';
  if (operation.startsWith('transcription:')) return 'TRANSCRIPTION_FAILED';
  if (operation.startsWith('ai:')) return 'AI_UNAVAILABLE';
  if (operation.startsWith('knowledge:')) return 'KNOWLEDGE_INDEX_FAILED';
  return 'UNKNOWN_ERROR';
}

function systemCodeOf(cause: unknown): string | null {
  if (!cause || typeof cause !== 'object') return null;
  const candidate = cause as Readonly<Record<string, unknown>>;
  if (typeof candidate['code'] === 'string') return candidate['code'];
  const nested = candidate['cause'];
  return nested && typeof nested === 'object' ? systemCodeOf(nested) : null;
}
