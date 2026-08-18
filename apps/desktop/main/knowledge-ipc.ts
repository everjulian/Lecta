import { ipcMain } from 'electron';
import { knowledgeChannels } from '../shared/session-contracts.js';
import type { ApplicationContainer } from './container.js';

export function registerKnowledgeHandlers(container: ApplicationContainer): void {
  let indexing: Promise<number> | null = null;
  ipcMain.handle(knowledgeChannels.ask, async (_event, value: unknown) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 500) {
      throw new TypeError('La pregunta debe tener entre 1 y 500 caracteres.');
    }
    indexing ??= container.indexKnowledge.execute().finally(() => {
      indexing = null;
    });
    await indexing;
    const result = await container.askKnowledge.execute(value.trim(), new AbortController().signal);
    return {
      ...result,
      sources: result.sources.map((source) => ({
        ...source,
        sessionDate: source.sessionDate.toISOString(),
      })),
    };
  });
}
