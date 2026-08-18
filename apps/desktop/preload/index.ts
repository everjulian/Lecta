import { contextBridge, ipcRenderer } from 'electron';
import {
  aiChannels,
  knowledgeChannels,
  recordingChannels,
  runtimeChannels,
  sessionChannels,
  transcriptionChannels,
  type LectaApi,
  type IpcErrorDto,
  type IpcResult,
} from '../shared/session-contracts.js';

const invoke = async <T>(channel: string, ...argumentsList: unknown[]): Promise<T> => {
  const result = (await ipcRenderer.invoke(channel, ...argumentsList)) as IpcResult<T>;
  if (!result || typeof result !== 'object' || typeof result.success !== 'boolean') {
    return rejectStructuredError({
      code: 'UNKNOWN_ERROR',
      userMessage: 'Lecta recibió una respuesta inesperada.',
      safeStateMessage: 'Tus datos existentes permanecen sin cambios.',
      retryable: true,
      technicalDetailsId: 'IPC-CONTRACT',
    });
  }
  if (!result.success) return rejectStructuredError(result.error);
  return result.data;
};

const rejectStructuredError = <T>(error: IpcErrorDto): Promise<T> => {
  // A plain DTO is intentional: contextBridge preserves its typed fields, while Error subclasses
  // are reduced to message/name and would discard code, retryability and the diagnostic id.
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
  return Promise.reject(error);
};

const api: LectaApi = {
  runtime: {
    e2e: ipcRenderer.sendSync(runtimeChannels.getMode) === 'E2E',
  },
  sessions: {
    create: (input) => invoke(sessionChannels.create, input),
    get: (id) => invoke(sessionChannels.get, id),
    list: () => invoke(sessionChannels.list),
    start: (id) => invoke(sessionChannels.start, id),
    pause: (id) => invoke(sessionChannels.pause, id),
    resume: (id) => invoke(sessionChannels.resume, id),
    finish: (id) => invoke(sessionChannels.finish, id),
    searchLibrary: (query) => invoke(sessionChannels.searchLibrary, query),
    listSubjects: () => invoke(sessionChannels.listSubjects),
  },
  recording: {
    initialize: (input) => invoke(recordingChannels.initialize, input),
    writeChunk: (sessionId, index, data, durationMs) =>
      invoke(recordingChannels.writeChunk, sessionId, index, data, durationMs),
    updateStatus: (sessionId, status, durationMs) =>
      invoke(recordingChannels.updateStatus, sessionId, status, durationMs),
    finalize: (input) => invoke(recordingChannels.finalize, input),
    listIncomplete: () => invoke(recordingChannels.listIncomplete),
    recover: (sessionId) => invoke(recordingChannels.recover, sessionId),
    discard: (sessionId) => invoke(recordingChannels.discard, sessionId),
    getMicrophonePreference: () => invoke(recordingChannels.getMicrophonePreference),
    setMicrophonePreference: (deviceId) =>
      invoke(recordingChannels.setMicrophonePreference, deviceId),
    showInFolder: (sessionId) => invoke(recordingChannels.showInFolder, sessionId),
  },
  transcription: {
    enqueue: (input) => invoke(transcriptionChannels.enqueue, input),
    getJob: (sessionId) => invoke(transcriptionChannels.getJob, sessionId),
    getTranscript: (sessionId) => invoke(transcriptionChannels.getTranscript, sessionId),
    cancel: (jobId) => invoke(transcriptionChannels.cancel, jobId),
    restart: (jobId) => invoke(transcriptionChannels.restart, jobId),
    onProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, job: Parameters<typeof listener>[0]) =>
        listener(job);
      ipcRenderer.on(transcriptionChannels.progress, handler);
      return () => ipcRenderer.removeListener(transcriptionChannels.progress, handler);
    },
  },
  ai: {
    generate: (sessionId) => invoke(aiChannels.generate, sessionId),
    getNotes: (sessionId) => invoke(aiChannels.getNotes, sessionId),
    onProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, value: Parameters<typeof listener>[0]) =>
        listener(value);
      ipcRenderer.on(aiChannels.progress, handler);
      return () => ipcRenderer.removeListener(aiChannels.progress, handler);
    },
  },
  knowledge: {
    ask: (question) => invoke(knowledgeChannels.ask, question),
  },
};

contextBridge.exposeInMainWorld('lecta', api);
