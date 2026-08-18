import type { IpcErrorDto } from '../shared/session-contracts';

export function ErrorNotice({
  error,
  onRetry,
  compact = false,
}: {
  error: IpcErrorDto;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <section className={`error-banner${compact ? ' compact' : ''}`} role="alert">
      <strong>{error.userMessage}</strong>
      <span>{error.safeStateMessage}</span>
      {error.retryable && onRetry && (
        <button type="button" className="secondary-button" onClick={onRetry}>
          Reintentar
        </button>
      )}
      <small>Referencia: {error.technicalDetailsId}</small>
    </section>
  );
}
