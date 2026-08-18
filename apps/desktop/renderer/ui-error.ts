import { errorCodes, type ErrorCode, type IpcErrorDto } from '../shared/session-contracts';

export function toUiError(cause: unknown): IpcErrorDto {
  if (isIpcError(cause)) return cause;
  const code = recordingCode(cause);
  if (code) {
    return {
      code,
      userMessage: 'No pudimos acceder al dispositivo de grabación seleccionado.',
      safeStateMessage: 'No se inició ninguna grabación. Tus sesiones existentes siguen seguras.',
      retryable: true,
      technicalDetailsId: crypto.randomUUID(),
    };
  }
  return {
    code: 'UNKNOWN_ERROR',
    userMessage: 'No pudimos completar la operación.',
    safeStateMessage: 'Tus datos existentes permanecen sin cambios.',
    retryable: true,
    technicalDetailsId: crypto.randomUUID(),
  };
}

export function isIpcError(value: unknown): value is IpcErrorDto {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  return (
    typeof candidate['code'] === 'string' &&
    errorCodes.includes(candidate['code'] as ErrorCode) &&
    typeof candidate['userMessage'] === 'string' &&
    typeof candidate['safeStateMessage'] === 'string' &&
    typeof candidate['retryable'] === 'boolean' &&
    typeof candidate['technicalDetailsId'] === 'string'
  );
}

function recordingCode(cause: unknown): ErrorCode | null {
  if (!(cause instanceof DOMException)) return null;
  return ['NotFoundError', 'NotReadableError', 'NotAllowedError', 'AbortError'].includes(cause.name)
    ? 'RECORDING_DEVICE_UNAVAILABLE'
    : null;
}
