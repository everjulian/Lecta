import { BrowserWindow, ipcMain } from 'electron';
import type { StructuredNotes } from '@lecta/domain';
import { aiChannels, type StructuredNotesDto } from '../shared/session-contracts.js';
import type { ApplicationContainer } from './container.js';

const requireId = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value)) {
    throw new TypeError('A valid identifier is required');
  }
  return value;
};

const toDto = (notes: StructuredNotes): StructuredNotesDto => ({
  ...notes,
  createdAt: notes.createdAt.toISOString(),
  updatedAt: notes.updatedAt.toISOString(),
});

export function registerAIHandlers(container: ApplicationContainer): void {
  const active = new Map<string, Promise<StructuredNotesDto>>();
  ipcMain.handle(aiChannels.getNotes, (_event, value: unknown) =>
    container.structuredNotes
      .getBySessionId(requireId(value))
      .then((notes) => (notes ? toDto(notes) : null)),
  );
  ipcMain.handle(aiChannels.generate, (_event, value: unknown) => {
    const sessionId = requireId(value);
    const running = active.get(sessionId);
    if (running) return running;
    const task = container.generateStructuredNotes
      .execute({
        sessionId,
        signal: new AbortController().signal,
        onProgress: (progress) => {
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(aiChannels.progress, {
              sessionId,
              stage: progress.stage,
              progress: progress.percent,
            });
          }
        },
      })
      .then(toDto)
      .finally(() => active.delete(sessionId));
    active.set(sessionId, task);
    return task;
  });
}
