import { app, shell } from 'electron';
import type { ResourceSample } from '@lecta/infrastructure';
import {
  recordingChannels,
  type RecordingFinalizeInput,
  type RecordingInitializeInput,
} from '../shared/session-contracts.js';
import type { ApplicationContainer } from './container.js';
import { registerIpcHandler } from './ipc-result.js';
import { existsSync } from 'node:fs';

const requireSessionId = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value)) {
    throw new TypeError('A valid session id is required');
  }
  return value;
};

const requireDate = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.length > 40 || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${name} is invalid`);
  }
  return value;
};

const requireFiniteNumber = (value: unknown, name: string, minimum: number, maximum: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} is invalid`);
  }
  return value;
};

const requireBoundedString = (value: unknown, name: string, maximum: number): string => {
  if (typeof value !== 'string' || value.length > maximum)
    throw new TypeError(`${name} is invalid`);
  return value;
};

const requireInitializeInput = (value: unknown): RecordingInitializeInput => {
  if (!value || typeof value !== 'object') throw new TypeError('Recording metadata is required');
  const input = value as Readonly<Record<string, unknown>>;
  const microphone = input['microphone'];
  if (
    typeof input['startedAt'] !== 'string' ||
    typeof input['audioFormat'] !== 'string' ||
    typeof input['sampleRate'] !== 'number' ||
    !microphone ||
    typeof microphone !== 'object'
  ) {
    throw new TypeError('Recording metadata is invalid');
  }
  const microphoneValue = microphone as Readonly<Record<string, unknown>>;
  if (
    (microphoneValue['deviceId'] !== null && typeof microphoneValue['deviceId'] !== 'string') ||
    typeof microphoneValue['label'] !== 'string'
  ) {
    throw new TypeError('Microphone metadata is invalid');
  }
  return {
    sessionId: requireSessionId(input['sessionId']),
    startedAt: requireDate(input['startedAt'], 'Recording start date'),
    audioFormat: requireBoundedString(input['audioFormat'], 'Audio format', 100),
    sampleRate: requireFiniteNumber(input['sampleRate'], 'Sample rate', 8_000, 384_000),
    microphone: {
      deviceId:
        microphoneValue['deviceId'] === null
          ? null
          : requireBoundedString(microphoneValue['deviceId'], 'Microphone device id', 500),
      label: requireBoundedString(microphoneValue['label'], 'Microphone label', 300),
    },
  };
};

const requireFinalizeInput = (value: unknown): RecordingFinalizeInput => {
  if (!value || typeof value !== 'object')
    throw new TypeError('Final recording metadata is required');
  const input = value as Readonly<Record<string, unknown>>;
  if (
    typeof input['endedAt'] !== 'string' ||
    typeof input['durationMs'] !== 'number' ||
    (input['status'] !== 'COMPLETED' && input['status'] !== 'FAILED')
  ) {
    throw new TypeError('Final recording metadata is invalid');
  }
  return {
    sessionId: requireSessionId(input['sessionId']),
    endedAt: requireDate(input['endedAt'], 'Recording end date'),
    durationMs: requireFiniteNumber(input['durationMs'], 'Recording duration', 0, 604_800_000),
    status: input['status'],
  };
};

export function registerRecordingHandlers(container: ApplicationContainer): void {
  const { recordings, preferences, useCases, logger } = container;
  registerIpcHandler(recordingChannels.initialize, logger, (_event, input: unknown) =>
    recordings.initialize(requireInitializeInput(input)),
  );
  registerIpcHandler(
    recordingChannels.writeChunk,
    logger,
    async (_event, sessionId: unknown, index: unknown, data: unknown, duration: unknown) => {
      if (!Number.isInteger(index) || (index as number) < 0)
        throw new TypeError('Invalid chunk index');
      if (!(data instanceof ArrayBuffer) || data.byteLength === 0 || data.byteLength > 16_000_000) {
        throw new TypeError('Invalid audio chunk');
      }
      const validDuration = requireFiniteNumber(duration, 'Recording duration', 0, 604_800_000);
      await recordings.writeChunk(
        requireSessionId(sessionId),
        index as number,
        new Uint8Array(data),
        validDuration,
        resourceSample(),
      );
    },
  );
  registerIpcHandler(
    recordingChannels.updateStatus,
    logger,
    (_event, sessionId: unknown, status: unknown, duration: unknown) => {
      if (status !== 'RECORDING' && status !== 'PAUSED') {
        throw new TypeError('Invalid recording state');
      }
      return recordings.updateStatus(
        requireSessionId(sessionId),
        status,
        requireFiniteNumber(duration, 'Recording duration', 0, 604_800_000),
      );
    },
  );
  registerIpcHandler(recordingChannels.finalize, logger, (_event, input: unknown) =>
    recordings.finalize(requireFinalizeInput(input)),
  );
  registerIpcHandler(recordingChannels.listIncomplete, logger, () => recordings.listIncomplete());
  registerIpcHandler(recordingChannels.recover, logger, async (_event, sessionId: unknown) => {
    const id = requireSessionId(sessionId);
    const result = await recordings.recover(id);
    await useCases.finishSession.execute(id);
    return result;
  });
  registerIpcHandler(recordingChannels.discard, logger, async (_event, sessionId: unknown) => {
    const id = requireSessionId(sessionId);
    await recordings.discard(id);
    await useCases.failInterruptedSession.execute(id);
  });
  registerIpcHandler(recordingChannels.getMicrophonePreference, logger, () =>
    preferences.getMicrophoneDeviceId(),
  );
  registerIpcHandler(
    recordingChannels.setMicrophonePreference,
    logger,
    (_event, deviceId: unknown) => {
      if (deviceId !== null && (typeof deviceId !== 'string' || deviceId.length > 500)) {
        throw new TypeError('Invalid microphone device id');
      }
      return preferences.setMicrophoneDeviceId(deviceId);
    },
  );
  registerIpcHandler(recordingChannels.showInFolder, logger, (_event, sessionId: unknown) => {
    const recordingPath = recordings.getRecordingFilePath(requireSessionId(sessionId));
    if (!existsSync(recordingPath))
      throw Object.assign(new Error('Recording file is missing'), { code: 'ENOENT' });
    shell.showItemInFolder(recordingPath);
  });
}

function resourceSample(): ResourceSample {
  const metrics = app.getAppMetrics();
  return {
    capturedAt: new Date().toISOString(),
    cpuPercent:
      Math.round(metrics.reduce((total, metric) => total + metric.cpu.percentCPUUsage, 0) * 10) /
      10,
    workingSetMb:
      Math.round(
        (metrics.reduce((total, metric) => total + metric.memory.workingSetSize, 0) / 1024) * 10,
      ) / 10,
  };
}
