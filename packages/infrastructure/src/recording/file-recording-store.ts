import { appendFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { InfrastructureError } from '../errors';

export type StoredRecordingStatus = 'RECORDING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'RECOVERED';

export interface RecordingMetadata {
  sessionId: string;
  createdAt: string;
  startedAt: string;
  endedAt: string | null;
  duration: number;
  audioFormat: string;
  sampleRate: number;
  microphone: { deviceId: string | null; label: string };
  status: StoredRecordingStatus;
  chunkCount: number;
  resourceSamples: readonly ResourceSample[];
}

export interface ResourceSample {
  capturedAt: string;
  cpuPercent: number;
  workingSetMb: number;
}

export interface IncompleteRecording {
  sessionId: string;
  startedAt: string;
  duration: number;
  microphoneLabel: string;
}

export class FileRecordingStore {
  constructor(private readonly root: string) {}

  async initialize(input: {
    sessionId: string;
    startedAt: string;
    audioFormat: string;
    sampleRate: number;
    microphone: { deviceId: string | null; label: string };
  }): Promise<void> {
    const directory = this.sessionDirectory(input.sessionId);
    await mkdir(path.join(directory, 'chunks'), { recursive: true });
    await this.writeMetadata(directory, {
      sessionId: input.sessionId,
      createdAt: input.startedAt,
      startedAt: input.startedAt,
      endedAt: null,
      duration: 0,
      audioFormat: input.audioFormat,
      sampleRate: input.sampleRate,
      microphone: input.microphone,
      status: 'RECORDING',
      chunkCount: 0,
      resourceSamples: [],
    });
  }

  async writeChunk(
    sessionId: string,
    index: number,
    data: Uint8Array,
    duration: number,
    sample?: ResourceSample,
  ): Promise<void> {
    const directory = this.sessionDirectory(sessionId);
    const name = `${index.toString().padStart(8, '0')}.webm`;
    try {
      await writeFile(path.join(directory, 'chunks', name), data, { flag: 'wx' });
      await appendFile(path.join(directory, 'recording.webm'), data);
      const metadata = await this.readMetadata(directory);
      await this.writeMetadata(directory, {
        ...metadata,
        duration,
        chunkCount: Math.max(metadata.chunkCount, index + 1),
        ...(sample ? { resourceSamples: [...metadata.resourceSamples.slice(-119), sample] } : {}),
      });
    } catch (cause) {
      throw new InfrastructureError('Unable to persist an audio chunk', { cause });
    }
  }

  async updateStatus(
    sessionId: string,
    status: 'RECORDING' | 'PAUSED',
    duration: number,
  ): Promise<void> {
    const directory = this.sessionDirectory(sessionId);
    const metadata = await this.readMetadata(directory);
    await this.writeMetadata(directory, { ...metadata, status, duration });
  }

  async finalize(input: {
    sessionId: string;
    endedAt: string;
    durationMs: number;
    status: 'COMPLETED' | 'FAILED';
  }): Promise<{ filePath: string }> {
    const directory = this.sessionDirectory(input.sessionId);
    const metadata = await this.readMetadata(directory);
    await this.writeMetadata(directory, {
      ...metadata,
      endedAt: input.endedAt,
      duration: input.durationMs,
      status: input.status,
    });
    return { filePath: path.join(directory, 'recording.webm') };
  }

  async listIncomplete(): Promise<readonly IncompleteRecording[]> {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root, { withFileTypes: true });
    const incomplete: IncompleteRecording[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const metadata = await this.readMetadata(path.join(this.root, entry.name));
        if (metadata.status === 'RECORDING' || metadata.status === 'PAUSED') {
          incomplete.push({
            sessionId: metadata.sessionId,
            startedAt: metadata.startedAt,
            duration: metadata.duration,
            microphoneLabel: metadata.microphone.label,
          });
        }
      } catch (cause) {
        throw new InfrastructureError(`Unable to inspect recording directory: ${entry.name}`, {
          cause,
        });
      }
    }
    return incomplete;
  }

  async recover(sessionId: string): Promise<{ filePath: string }> {
    const directory = this.sessionDirectory(sessionId);
    const metadata = await this.readMetadata(directory);
    await this.writeMetadata(directory, {
      ...metadata,
      endedAt: new Date().toISOString(),
      status: 'RECOVERED',
    });
    return { filePath: path.join(directory, 'recording.webm') };
  }

  async discard(sessionId: string): Promise<void> {
    await rm(this.sessionDirectory(sessionId), { recursive: true, force: true });
  }

  getRecordingFilePath(sessionId: string): string {
    return path.join(this.sessionDirectory(sessionId), 'recording.webm');
  }

  private sessionDirectory(sessionId: string): string {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(sessionId)) {
      throw new InfrastructureError('Invalid recording session id');
    }
    return path.join(this.root, sessionId);
  }

  private async readMetadata(directory: string): Promise<RecordingMetadata> {
    return JSON.parse(
      await readFile(path.join(directory, 'metadata.json'), 'utf8'),
    ) as RecordingMetadata;
  }

  private async writeMetadata(directory: string, metadata: RecordingMetadata): Promise<void> {
    const temporary = path.join(directory, 'metadata.json.tmp');
    await writeFile(temporary, JSON.stringify(metadata, null, 2), 'utf8');
    await rename(temporary, path.join(directory, 'metadata.json'));
  }
}
