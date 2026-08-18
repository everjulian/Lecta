import { contextBridge, ipcRenderer } from 'electron';
import {
  aiChannels,
  knowledgeChannels,
  recordingChannels,
  runtimeChannels,
  sessionChannels,
  transcriptionChannels,
  type LectaApi,
} from '../shared/session-contracts.js';

const api: LectaApi = {
  runtime: {
    e2e: ipcRenderer.sendSync(runtimeChannels.getMode) === 'E2E',
  },
  sessions: {
    create: (input) => ipcRenderer.invoke(sessionChannels.create, input),
    get: (id) => ipcRenderer.invoke(sessionChannels.get, id),
    list: () => ipcRenderer.invoke(sessionChannels.list),
    start: (id) => ipcRenderer.invoke(sessionChannels.start, id),
    pause: (id) => ipcRenderer.invoke(sessionChannels.pause, id),
    resume: (id) => ipcRenderer.invoke(sessionChannels.resume, id),
    finish: (id) => ipcRenderer.invoke(sessionChannels.finish, id),
    searchLibrary: (query) => ipcRenderer.invoke(sessionChannels.searchLibrary, query),
    listSubjects: () => ipcRenderer.invoke(sessionChannels.listSubjects),
  },
  recording: {
    initialize: (input) => ipcRenderer.invoke(recordingChannels.initialize, input),
    writeChunk: (sessionId, index, data, durationMs) =>
      ipcRenderer.invoke(recordingChannels.writeChunk, sessionId, index, data, durationMs),
    updateStatus: (sessionId, status, durationMs) =>
      ipcRenderer.invoke(recordingChannels.updateStatus, sessionId, status, durationMs),
    finalize: (input) => ipcRenderer.invoke(recordingChannels.finalize, input),
    listIncomplete: () => ipcRenderer.invoke(recordingChannels.listIncomplete),
    recover: (sessionId) => ipcRenderer.invoke(recordingChannels.recover, sessionId),
    discard: (sessionId) => ipcRenderer.invoke(recordingChannels.discard, sessionId),
    getMicrophonePreference: () => ipcRenderer.invoke(recordingChannels.getMicrophonePreference),
    setMicrophonePreference: (deviceId) =>
      ipcRenderer.invoke(recordingChannels.setMicrophonePreference, deviceId),
    showInFolder: (sessionId) => ipcRenderer.invoke(recordingChannels.showInFolder, sessionId),
  },
  transcription: {
    enqueue: (input) => ipcRenderer.invoke(transcriptionChannels.enqueue, input),
    getJob: (sessionId) => ipcRenderer.invoke(transcriptionChannels.getJob, sessionId),
    getTranscript: (sessionId) =>
      ipcRenderer.invoke(transcriptionChannels.getTranscript, sessionId),
    cancel: (jobId) => ipcRenderer.invoke(transcriptionChannels.cancel, jobId),
    restart: (jobId) => ipcRenderer.invoke(transcriptionChannels.restart, jobId),
    onProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, job: Parameters<typeof listener>[0]) =>
        listener(job);
      ipcRenderer.on(transcriptionChannels.progress, handler);
      return () => ipcRenderer.removeListener(transcriptionChannels.progress, handler);
    },
  },
  ai: {
    generate: (sessionId) => ipcRenderer.invoke(aiChannels.generate, sessionId),
    getNotes: (sessionId) => ipcRenderer.invoke(aiChannels.getNotes, sessionId),
    onProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, value: Parameters<typeof listener>[0]) =>
        listener(value);
      ipcRenderer.on(aiChannels.progress, handler);
      return () => ipcRenderer.removeListener(aiChannels.progress, handler);
    },
  },
  knowledge: {
    ask: (question) => ipcRenderer.invoke(knowledgeChannels.ask, question),
  },
};

contextBridge.exposeInMainWorld('lecta', api);
