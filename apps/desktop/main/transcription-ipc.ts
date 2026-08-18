import { BrowserWindow, ipcMain } from 'electron';
import type { Transcript } from '@lecta/domain';
import type { TranscriptionJob } from '@lecta/transcription';
import {
  transcriptionChannels,
  type TranscriptDto,
  type TranscriptionJobDto,
  type TranscriptionRequestDto,
} from '../shared/session-contracts.js';
import type { ApplicationContainer } from './container.js';

const requireId = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value)) {
    throw new TypeError('A valid identifier is required');
  }
  return value;
};

const requireRequest = (value: unknown): TranscriptionRequestDto => {
  if (!value || typeof value !== 'object') throw new TypeError('Transcription request is required');
  const input = value as Readonly<Record<string, unknown>>;
  if (
    (input['model'] !== 'small' && input['model'] !== 'medium') ||
    (input['resourceMode'] !== 'LIGHT' && input['resourceMode'] !== 'NORMAL')
  ) {
    throw new TypeError('Invalid transcription options');
  }
  return {
    sessionId: requireId(input['sessionId']),
    model: input['model'],
    resourceMode: input['resourceMode'],
  };
};

const toJobDto = (job: TranscriptionJob): TranscriptionJobDto => ({
  id: job.id,
  sessionId: job.sessionId,
  model: job.model,
  resourceMode: job.resourceMode,
  status: job.status,
  progress: job.progress,
  error: job.error,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
});

const toTranscriptDto = (transcript: Transcript): TranscriptDto => ({
  ...transcript,
  createdAt: transcript.createdAt.toISOString(),
  audioUrl: `lecta-media://recording/${transcript.sessionId}`,
});

export function registerTranscriptionHandlers(container: ApplicationContainer): () => void {
  const { transcriptionQueue, transcriptionStore, recordings } = container;
  ipcMain.handle(transcriptionChannels.enqueue, (_event, input: unknown) => {
    const request = requireRequest(input);
    return transcriptionQueue
      .enqueue({
        ...request,
        recordingPath: recordings.getRecordingFilePath(request.sessionId),
      })
      .then(toJobDto);
  });
  ipcMain.handle(transcriptionChannels.getJob, (_event, sessionId: unknown) =>
    transcriptionQueue
      .getJobForSession(requireId(sessionId))
      .then((job) => (job ? toJobDto(job) : null)),
  );
  ipcMain.handle(transcriptionChannels.getTranscript, (_event, sessionId: unknown) =>
    transcriptionStore
      .getTranscriptBySessionId(requireId(sessionId))
      .then((transcript) => (transcript ? toTranscriptDto(transcript) : null)),
  );
  ipcMain.handle(transcriptionChannels.cancel, (_event, jobId: unknown) =>
    transcriptionQueue.cancel(requireId(jobId)),
  );
  ipcMain.handle(transcriptionChannels.restart, (_event, jobId: unknown) =>
    transcriptionQueue.restart(requireId(jobId)).then(toJobDto),
  );
  return transcriptionQueue.subscribe((job) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(transcriptionChannels.progress, toJobDto(job));
    }
  });
}
