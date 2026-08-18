export const sessionChannels = {
  create: 'session:create',
  get: 'session:get',
  list: 'session:list',
  start: 'session:start',
  pause: 'session:pause',
  resume: 'session:resume',
  finish: 'session:finish',
  searchLibrary: 'session:search-library',
  listSubjects: 'session:list-subjects',
} as const;

export const recordingChannels = {
  initialize: 'recording:initialize',
  writeChunk: 'recording:write-chunk',
  updateStatus: 'recording:update-status',
  finalize: 'recording:finalize',
  listIncomplete: 'recording:list-incomplete',
  recover: 'recording:recover',
  discard: 'recording:discard',
  getMicrophonePreference: 'recording:get-microphone-preference',
  setMicrophonePreference: 'recording:set-microphone-preference',
  showInFolder: 'recording:show-in-folder',
} as const;

export const transcriptionChannels = {
  enqueue: 'transcription:enqueue',
  getJob: 'transcription:get-job',
  getTranscript: 'transcription:get-transcript',
  cancel: 'transcription:cancel',
  restart: 'transcription:restart',
  progress: 'transcription:progress',
} as const;

export const aiChannels = {
  generate: 'ai:generate-notes',
  getNotes: 'ai:get-notes',
  progress: 'ai:progress',
} as const;
export const knowledgeChannels = { ask: 'knowledge:ask' } as const;
export const runtimeChannels = { getMode: 'runtime:get-mode' } as const;

export const sessionTypes = ['CLASS', 'MEETING', 'OTHER'] as const;
export type SessionTypeDto = (typeof sessionTypes)[number];
export type SessionStatusDto =
  'IDLE' | 'RECORDING' | 'PAUSED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface CreateSessionInput {
  title: string;
  type: SessionTypeDto;
  subject?: string;
  tags?: readonly string[];
}

export interface SessionDto {
  id: string;
  title: string;
  type: SessionTypeDto;
  subject: string | null;
  status: SessionStatusDto;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
  tags: readonly string[];
}

export interface LibraryQueryDto {
  text?: string;
  type?: SessionTypeDto;
  subject?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
  sort: 'NEWEST' | 'OLDEST';
}
export interface LibraryPageDto {
  items: readonly SessionDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LectaApi {
  runtime: { readonly e2e: boolean };
  sessions: {
    create: (input: CreateSessionInput) => Promise<SessionDto>;
    get: (id: string) => Promise<SessionDto>;
    list: () => Promise<readonly SessionDto[]>;
    start: (id: string) => Promise<SessionDto>;
    pause: (id: string) => Promise<SessionDto>;
    resume: (id: string) => Promise<SessionDto>;
    finish: (id: string) => Promise<SessionDto>;
    searchLibrary: (query: LibraryQueryDto) => Promise<LibraryPageDto>;
    listSubjects: () => Promise<readonly string[]>;
  };
  recording: {
    initialize: (input: RecordingInitializeInput) => Promise<void>;
    writeChunk: (
      sessionId: string,
      index: number,
      data: ArrayBuffer,
      durationMs: number,
    ) => Promise<void>;
    updateStatus: (
      sessionId: string,
      status: 'RECORDING' | 'PAUSED',
      durationMs: number,
    ) => Promise<void>;
    finalize: (input: RecordingFinalizeInput) => Promise<{ filePath: string }>;
    listIncomplete: () => Promise<readonly IncompleteRecordingDto[]>;
    recover: (sessionId: string) => Promise<{ filePath: string }>;
    discard: (sessionId: string) => Promise<void>;
    getMicrophonePreference: () => Promise<string | null>;
    setMicrophonePreference: (deviceId: string | null) => Promise<void>;
    showInFolder: (sessionId: string) => Promise<void>;
  };
  transcription: {
    enqueue: (input: TranscriptionRequestDto) => Promise<TranscriptionJobDto>;
    getJob: (sessionId: string) => Promise<TranscriptionJobDto | null>;
    getTranscript: (sessionId: string) => Promise<TranscriptDto | null>;
    cancel: (jobId: string) => Promise<void>;
    restart: (jobId: string) => Promise<TranscriptionJobDto>;
    onProgress: (listener: (job: TranscriptionJobDto) => void) => () => void;
  };
  ai: {
    generate: (sessionId: string) => Promise<StructuredNotesDto>;
    getNotes: (sessionId: string) => Promise<StructuredNotesDto | null>;
    onProgress: (listener: (progress: AIGenerationProgressDto) => void) => () => void;
  };
  knowledge: { ask: (question: string) => Promise<KnowledgeAnswerDto> };
}

export interface RecordingInitializeInput {
  sessionId: string;
  startedAt: string;
  audioFormat: string;
  sampleRate: number;
  microphone: { deviceId: string | null; label: string };
}

export interface RecordingFinalizeInput {
  sessionId: string;
  endedAt: string;
  durationMs: number;
  status: 'COMPLETED' | 'FAILED';
}

export interface IncompleteRecordingDto {
  sessionId: string;
  startedAt: string;
  duration: number;
  microphoneLabel: string;
}

export type TranscriptionJobStatusDto =
  'QUEUED' | 'PREPARING' | 'TRANSCRIBING' | 'SAVING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type TranscriptionModel = 'small' | 'medium';
export type TranscriptionResourceMode = 'LIGHT' | 'NORMAL';
export interface TranscriptionRequestDto {
  sessionId: string;
  model: TranscriptionModel;
  resourceMode: TranscriptionResourceMode;
}
export interface TranscriptionJobDto extends TranscriptionRequestDto {
  id: string;
  status: TranscriptionJobStatusDto;
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TranscriptSegmentDto {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  text: string;
}
export interface TranscriptDto {
  id: string;
  sessionId: string;
  language: string | null;
  createdAt: string;
  audioUrl: string;
  segments: readonly TranscriptSegmentDto[];
}

export interface StructuredTopicDto {
  title: string;
  notes: readonly string[];
}
export interface ImportantMomentDto {
  timestamp: number;
  title: string;
  description: string;
}
export interface StructuredNotesDto {
  id: string;
  sessionId: string;
  transcriptId: string;
  summary: string;
  topics: readonly StructuredTopicDto[];
  keyConcepts: readonly string[];
  tasks: readonly string[];
  studyQuestions: readonly string[];
  importantMoments: readonly ImportantMomentDto[];
  examMentions: readonly string[];
  createdAt: string;
  updatedAt: string;
}
export type AIGenerationStageDto = 'CHUNKING' | 'SUMMARIZING' | 'SYNTHESIZING' | 'SAVING';
export interface AIGenerationProgressDto {
  sessionId: string;
  stage: AIGenerationStageDto;
  progress: number;
}
export interface KnowledgeSourceDto {
  id: string;
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  startTime: number;
  endTime: number;
  text: string;
  score: number;
}
export interface KnowledgeAnswerDto {
  answer: string;
  sources: readonly KnowledgeSourceDto[];
  insufficient: boolean;
}
