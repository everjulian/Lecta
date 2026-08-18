import type { Logger } from '@lecta/shared';

const allowedContextKeys = new Set([
  'technicalDetailsId',
  'operation',
  'errorCode',
  'errorType',
  'systemCode',
]);

export class SafeStderrLogger implements Logger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.write('debug', message, context);
  }
  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.write('info', message, context);
  }
  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.write('warn', message, context);
  }
  error(message: string, _error?: unknown, context?: Readonly<Record<string, unknown>>): void {
    this.write('error', message, context);
  }

  private write(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    const safeContext = Object.fromEntries(
      Object.entries(context ?? {}).filter(([key]) => allowedContextKeys.has(key)),
    );
    process.stderr.write(
      `${JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...safeContext })}\n`,
    );
  }
}
