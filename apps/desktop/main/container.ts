import {
  CreateSession,
  FinishSession,
  FailInterruptedSession,
  GetSession,
  ListSessions,
  PauseRecording,
  ResumeRecording,
  StartRecording,
  SearchLibrary,
  ListLibrarySubjects,
} from '@lecta/application';
import {
  CryptoIdGenerator,
  FilePreferenceStore,
  FileRecordingStore,
  SqliteSessionRepository,
  SqliteTranscriptionStore,
  SqliteStructuredNotesRepository,
  SqliteKnowledgeStore,
  SystemClock,
} from '@lecta/infrastructure';
import path from 'node:path';
import { TranscriptionQueue } from '@lecta/transcription';
import { FasterWhisperProvider } from '../../../workers/transcription-worker/src/index';
import {
  AskKnowledge,
  GenerateStructuredNotes,
  OpenAICompatibleAIProvider,
  type AIProvider,
} from '@lecta/ai';
import { KnowledgeWorkerClient } from '../../../workers/knowledge-worker/src/knowledge-worker-client';
import type { TranscriptionProvider } from '@lecta/transcription';
import type { E2EConfig } from './e2e/e2e-config';
import {
  FakeAIProvider,
  FakeKnowledgeWorker,
  FakeTranscriptionProvider,
} from './e2e/fake-providers';
import { SafeStderrLogger } from './safe-stderr-logger';

export function createContainer(
  userDataPath: string,
  appPath: string,
  options: { readonly e2e?: E2EConfig } = {},
) {
  const databasePath = path.join(userDataPath, 'lecta.sqlite');
  const sessions = new SqliteSessionRepository(databasePath);
  const transcriptionStore = new SqliteTranscriptionStore(databasePath);
  const structuredNotes = new SqliteStructuredNotesRepository(databasePath);
  const knowledgeStore = new SqliteKnowledgeStore(databasePath);
  sessions.ensureLibraryIndex();
  const recordings = new FileRecordingStore(path.join(userDataPath, 'recordings'));
  const preferences = new FilePreferenceStore(userDataPath);
  const logger = new SafeStderrLogger();
  const shared = { sessions, clock: new SystemClock(), logger };
  const transcriptionProvider: TranscriptionProvider = options.e2e
    ? new FakeTranscriptionProvider(options.e2e.scenario)
    : new FasterWhisperProvider(
        process.env['LECTA_PYTHON_PATH'] ??
          path.join(userDataPath, 'runtime', 'Scripts', 'python.exe'),
        path.join(appPath, 'dist', 'transcription-worker', 'worker.py'),
      );
  const transcriptionQueue = new TranscriptionQueue({
    jobs: transcriptionStore,
    transcripts: transcriptionStore,
    provider: transcriptionProvider,
    modelDirectory: path.join(userDataPath, 'models', 'faster-whisper'),
    generateId: () => crypto.randomUUID(),
    now: () => new Date(),
    logger,
  });
  const aiProvider = options.e2e ? new FakeAIProvider(options.e2e.scenario) : createAIProvider();
  const generateStructuredNotes = new GenerateStructuredNotes({
    provider: aiProvider,
    notes: structuredNotes,
    transcripts: transcriptionStore,
    generateId: () => crypto.randomUUID(),
    now: () => new Date(),
  });
  const knowledgeWorker = options.e2e
    ? new FakeKnowledgeWorker(sessions, options.e2e.scenario)
    : new KnowledgeWorkerClient({
        entrypoint: path.join(appPath, 'dist', 'knowledge-worker', 'index.js'),
        databasePath,
        modelDirectory: path.join(userDataPath, 'models', 'embeddings'),
        model: process.env['LECTA_EMBEDDING_MODEL'] ?? 'Xenova/multilingual-e5-small',
        logger,
      });
  const indexKnowledge = {
    execute: (signal?: AbortSignal) => knowledgeWorker.index(signal),
  };
  const askKnowledge = new AskKnowledge(
    {
      retrieve: (query, limit, signal) => knowledgeWorker.query(query, limit, signal),
    },
    knowledgeStore,
    aiProvider,
  );

  return {
    e2e: options.e2e,
    sessions,
    recordings,
    preferences,
    transcriptionStore,
    transcriptionQueue,
    structuredNotes,
    generateStructuredNotes,
    knowledgeStore,
    knowledgeWorker,
    logger,
    indexKnowledge,
    askKnowledge,
    useCases: {
      createSession: new CreateSession({ ...shared, ids: new CryptoIdGenerator() }),
      getSession: new GetSession(sessions),
      listSessions: new ListSessions(sessions),
      startRecording: new StartRecording(shared),
      pauseRecording: new PauseRecording(shared),
      resumeRecording: new ResumeRecording(shared),
      finishSession: new FinishSession(shared),
      failInterruptedSession: new FailInterruptedSession(shared),
      searchLibrary: new SearchLibrary(sessions),
      listLibrarySubjects: new ListLibrarySubjects(sessions),
    },
  };
}

function createAIProvider(): AIProvider {
  const apiKey = process.env['LECTA_AI_API_KEY'];
  if (!apiKey) {
    return {
      generateJson: () =>
        Promise.reject(
          new Error(
            'Configura LECTA_AI_API_KEY antes de generar apuntes con inteligencia artificial.',
          ),
        ),
    };
  }
  return new OpenAICompatibleAIProvider({
    apiKey,
    baseUrl: process.env['LECTA_AI_BASE_URL'] ?? 'https://api.openai.com/v1',
    model: process.env['LECTA_AI_MODEL'] ?? 'gpt-4.1-mini',
    timeoutMs: 60_000,
    maxRetries: 2,
  });
}

export type ApplicationContainer = ReturnType<typeof createContainer>;
