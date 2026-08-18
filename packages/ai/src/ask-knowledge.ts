import type { AIProvider } from './ai-types';
import type { KnowledgeAnswer, KnowledgeSessionReader } from './knowledge-types';
import type { KnowledgeRetriever } from './knowledge-retriever';

export const INSUFFICIENT_ANSWER = 'No encontré información suficiente en tus sesiones.';

export class AskKnowledge {
  constructor(
    private readonly retriever: KnowledgeRetriever,
    private readonly sessions: KnowledgeSessionReader,
    private readonly ai: AIProvider,
  ) {}

  async execute(question: string, signal: AbortSignal): Promise<KnowledgeAnswer> {
    const matches = await this.retriever.retrieve(question);
    if (matches.length === 0) return emptyAnswer();
    const evidence = await this.sessions.enrich(matches);
    if (evidence.length === 0) return emptyAnswer();
    const response = await this.ai.generateJson({
      systemPrompt: `Responde en español usando exclusivamente la evidencia. Devuelve JSON {"answer":"string","citationIds":["id"]}. Si la evidencia no responde directamente, usa answer exactamente "${INSUFFICIENT_ANSWER}" y citationIds vacío. No inventes.`,
      userPrompt: `Pregunta: ${question}\nEvidencia:\n${evidence.map((item) => `[${item.id}] ${item.sessionTitle} (${item.sessionDate.toISOString()}) ${item.startTime}-${item.endTime}: ${item.text}`).join('\n')}`,
      signal,
    });
    const parsed = parseAnswer(response);
    if (parsed.answer === INSUFFICIENT_ANSWER) return emptyAnswer();
    const byId = new Map(evidence.map((source) => [source.id, source]));
    const sources = [...new Set(parsed.citationIds)]
      .map((id) => byId.get(id))
      .filter((source) => source !== undefined);
    if (sources.length === 0 || sources.length !== new Set(parsed.citationIds).size)
      return emptyAnswer();
    return { answer: parsed.answer, sources, insufficient: false };
  }
}

function parseAnswer(value: unknown): { answer: string; citationIds: readonly string[] } {
  if (!value || typeof value !== 'object') return { answer: INSUFFICIENT_ANSWER, citationIds: [] };
  const object = value as Readonly<Record<string, unknown>>;
  if (
    typeof object['answer'] !== 'string' ||
    !Array.isArray(object['citationIds']) ||
    object['citationIds'].some((id) => typeof id !== 'string')
  )
    return { answer: INSUFFICIENT_ANSWER, citationIds: [] };
  return { answer: object['answer'].trim(), citationIds: object['citationIds'] as string[] };
}

function emptyAnswer(): KnowledgeAnswer {
  return { answer: INSUFFICIENT_ANSWER, sources: [], insufficient: true };
}
