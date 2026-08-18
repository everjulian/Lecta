import type { SessionStatusDto, SessionTypeDto } from '../shared/session-contracts';

export const sessionTypeLabel: Readonly<Record<SessionTypeDto, string>> = {
  CLASS: 'Clase',
  MEETING: 'Reunión',
  OTHER: 'Otro',
};
export const sessionStatusLabel: Readonly<Record<SessionStatusDto, string>> = {
  IDLE: 'Lista para grabar',
  RECORDING: 'Grabando',
  PAUSED: 'En pausa',
  PROCESSING: 'Procesando',
  COMPLETED: 'Completada',
  FAILED: 'Fallida',
};

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value),
  );
}

export function formatDuration(milliseconds: number, includeSeconds = false): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (includeSeconds)
    return [hours, minutes, seconds].map((part) => part.toString().padStart(2, '0')).join(':');
  if (hours > 0) return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
  return `${minutes} min`;
}

export function formatTimestamp(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  return [hours, minutes, remaining].map((part) => part.toString().padStart(2, '0')).join(':');
}
