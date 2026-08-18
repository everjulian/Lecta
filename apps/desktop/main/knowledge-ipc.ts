import { knowledgeChannels } from '../shared/session-contracts.js';
import type { ApplicationContainer } from './container.js';
import { registerIpcHandler } from './ipc-result.js';

export function registerKnowledgeHandlers(container: ApplicationContainer): void {
  let indexing: Promise<number> | null = null;
  registerIpcHandler(knowledgeChannels.ask, container.logger, async (event, value: unknown) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 500) {
      throw new TypeError('La pregunta debe tener entre 1 y 500 caracteres.');
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    event.sender.once('destroyed', abort);
    try {
      indexing ??= container.indexKnowledge.execute(controller.signal).finally(() => {
        indexing = null;
      });
      await indexing;
      const result = await container.askKnowledge.execute(value.trim(), controller.signal);
      return {
        ...result,
        sources: result.sources.map((source) => ({
          ...source,
          sessionDate: source.sessionDate.toISOString(),
        })),
      };
    } finally {
      event.sender.removeListener('destroyed', abort);
    }
  });
}
