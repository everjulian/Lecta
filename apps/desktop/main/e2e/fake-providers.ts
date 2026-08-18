import type { SessionRepository } from '@lecta/application';
import type { AIProvider, KnowledgeMatch } from '@lecta/ai';
import type { TranscriptionProvider } from '@lecta/transcription';
import type { E2EScenario } from './e2e-config';

export class FakeTranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly scenario: E2EScenario) {}

  async transcribe(
    _recordingPath: string,
    options: Parameters<TranscriptionProvider['transcribe']>[1],
  ): ReturnType<TranscriptionProvider['transcribe']> {
    options.onProgress({ stage: 'PREPARING', percent: 10 });
    await tick();
    if (this.scenario === 'transcription-failure')
      throw new Error('Fixture: la transcripción falló de forma controlada.');
    if (this.scenario === 'missing-recording')
      throw new Error('Fixture: no encontramos el archivo de grabación.');
    if (options.signal.aborted) throw new Error('Transcription cancelled');
    options.onProgress({ stage: 'TRANSCRIBING', percent: 75 });
    await tick();
    return {
      language: 'es',
      segments: [
        {
          startTime: 1,
          endTime: 8,
          text: 'Clean Architecture separa las reglas de negocio de la infraestructura.',
        },
        {
          startTime: 8,
          endTime: 15,
          text: 'La tarea es estudiar puertos y adaptadores para el examen.',
        },
      ],
    };
  }
}

export class FakeAIProvider implements AIProvider {
  constructor(private readonly scenario: E2EScenario) {}

  async generateJson(input: Parameters<AIProvider['generateJson']>[0]): Promise<unknown> {
    await tick();
    if (this.scenario === 'ai-timeout')
      throw new Error('Fixture: la generación superó el tiempo permitido. Puedes reintentar.');
    if (input.signal.aborted) throw new Error('AI generation cancelled');
    if (input.systemPrompt.includes('citationIds'))
      return {
        answer: 'Clean Architecture fue explicada en la sesión de prueba.',
        citationIds: ['e2e-knowledge-source'],
      };
    if (!input.systemPrompt.includes('Sintetiza análisis parciales'))
      return { summary: 'Análisis parcial determinista con timestamps.' };
    return {
      summary: 'La sesión explica Clean Architecture y sus límites principales.',
      topics: [{ title: 'Arquitectura', notes: ['Separar dominio e infraestructura.'] }],
      keyConcepts: ['Clean Architecture', 'Puertos y adaptadores'],
      tasks: ['Estudiar los límites arquitectónicos'],
      studyQuestions: ['¿Por qué el dominio no depende de infraestructura?'],
      importantMoments: [
        { timestamp: 1, title: 'Clean Architecture', description: 'Explicación principal.' },
      ],
      examMentions: ['Estudiar puertos y adaptadores para el examen.'],
    };
  }
}

export class FakeKnowledgeWorker {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly scenario: E2EScenario,
  ) {}

  index(): Promise<number> {
    if (this.scenario === 'knowledge-failure')
      return Promise.reject(new Error('Fixture: el índice de conocimiento no está disponible.'));
    return Promise.resolve(1);
  }

  async query(): Promise<readonly KnowledgeMatch[]> {
    if (this.scenario === 'knowledge-failure')
      throw new Error('Fixture: el conocimiento local falló de forma controlada.');
    const session = (await this.sessions.list())[0];
    if (!session) return [];
    return [
      {
        id: 'e2e-knowledge-source',
        sessionId: session.id,
        startTime: 1,
        endTime: 8,
        text: 'Clean Architecture separa dominio e infraestructura.',
        score: 0.99,
      },
    ];
  }

  restart(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}
