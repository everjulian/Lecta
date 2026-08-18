import { BrowserWindow } from 'electron';
import type { Transcript } from '@lecta/domain';
import type { TranscriptionJob } from '@lecta/transcription';
import {
  transcriptionChannels,
  type TranscriptDto,
  type TranscriptionJobDto,
  type TranscriptionRequestDto,
} from '../shared/session-contracts.js';
import type { ApplicationContainer } from './container.js';
import { registerIpcHandler } from './ipc-result.js';
import { createIpcError } from './ipc-result.js';
import { existsSync } from 'node:fs';

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
  error: job.status === 'FAILED' ? createIpcError('TRANSCRIPTION_FAILED', job.id) : null,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
});

const toTranscriptDto = (transcript: Transcript): TranscriptDto => ({
  ...transcript,
  createdAt: transcript.createdAt.toISOString(),
  audioUrl: `lecta-media://recording/${transcript.sessionId}`,
});

export function registerTranscriptionHandlers(container: ApplicationContainer): () => void {
  const { transcriptionQueue, transcriptionStore, recordings, logger } = container;
  registerIpcHandler(transcriptionChannels.enqueue, logger, (_event, input: unknown) => {
    const request = requireRequest(input);
    const recordingPath = recordings.getRecordingFilePath(request.sessionId);
    if (container.e2e?.scenario === 'missing-recording' || !existsSync(recordingPath)) {
      throw Object.assign(new Error('Recording file is missing'), { code: 'ENOENT' });
    }
    return transcriptionQueue
      .enqueue({
        ...request,
        recordingPath,
      })
      .then(toJobDto);
  });
  registerIpcHandler(transcriptionChannels.getJob, logger, (_event, sessionId: unknown) =>
    transcriptionQueue
      .getJobForSession(requireId(sessionId))
      .then((job) => (job ? toJobDto(job) : null)),
  );
  registerIpcHandler(transcriptionChannels.getTranscript, logger, (_event, sessionId: unknown) =>
    transcriptionStore
      .getTranscriptBySessionId(requireId(sessionId))
      .then((transcript) => (transcript ? toTranscriptDto(transcript) : null)),
  );
  registerIpcHandler(transcriptionChannels.cancel, logger, (_event, jobId: unknown) =>
    transcriptionQueue.cancel(requireId(jobId)),
  );
  registerIpcHandler(transcriptionChannels.restart, logger, (_event, jobId: unknown) =>
    transcriptionQueue.restart(requireId(jobId)).then(toJobDto),
  );
  return transcriptionQueue.subscribe((job) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(transcriptionChannels.progress, toJobDto(job));
    }
  });
}
