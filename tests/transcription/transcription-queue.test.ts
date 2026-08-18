import { describe, expect, it, vi } from 'vitest';
import type { Transcript } from '@lecta/domain';
import {
  TranscriptionQueue,
  type TranscriptStore,
  type TranscriptionJob,
  type TranscriptionJobRepository,
  type TranscriptionProvider,
} from '@lecta/transcription';

class MemoryJobs implements TranscriptionJobRepository {
  readonly values = new Map<string, TranscriptionJob>();
  save(job: TranscriptionJob): Promise<void> {
    this.values.set(job.id, { ...job });
    return Promise.resolve();
  }
  getById(id: string): Promise<TranscriptionJob | null> {
    return Promise.resolve(this.values.get(id) ?? null);
  }
  getBySessionId(sessionId: string): Promise<TranscriptionJob | null> {
    return Promise.resolve(
      [...this.values.values()].find((job) => job.sessionId === sessionId) ?? null,
    );
  }
  list(): Promise<readonly TranscriptionJob[]> {
    return Promise.resolve([...this.values.values()]);
  }
  markActiveAsInterrupted(now: Date): Promise<void> {
    for (const [id, job] of this.values) {
      if (['QUEUED', 'PREPARING', 'TRANSCRIBING', 'SAVING'].includes(job.status)) {
        this.values.set(id, { ...job, status: 'FAILED', error: 'interrupted', updatedAt: now });
      }
    }
    return Promise.resolve();
  }
}

class MemoryTranscripts implements TranscriptStore {
  readonly values = new Map<string, Transcript>();
  saveTranscript(transcript: Transcript): Promise<void> {
    this.values.set(transcript.sessionId, transcript);
    return Promise.resolve();
  }
  getTranscriptBySessionId(sessionId: string): Promise<Transcript | null> {
    return Promise.resolve(this.values.get(sessionId) ?? null);
  }
}

function createQueue(provider: TranscriptionProvider, jobs = new MemoryJobs()) {
  let id = 0;
  const transcripts = new MemoryTranscripts();
  const queue = new TranscriptionQueue({
    jobs,
    transcripts,
    provider,
    modelDirectory: 'models',
    generateId: () => `id-${++id}`,
    now: () => new Date('2026-08-07T12:00:00Z'),
  });
  return { queue, jobs, transcripts };
}

const successfulProvider: TranscriptionProvider = {
  transcribe(_path, options) {
    options.onProgress({ stage: 'TRANSCRIBING', percent: 40 });
    return Promise.resolve({
      language: 'es',
      segments: [{ startTime: 272, endTime: 287, text: 'Arquitectura hexagonal.' }],
    });
  },
};

describe('TranscriptionQueue', () => {
  it('moves through the queue and persists segments', async () => {
    const { queue, jobs, transcripts } = createQueue(successfulProvider);
    const states: string[] = [];
    queue.subscribe((job) => states.push(job.status));
    const queued = await queue.enqueue({
      sessionId: 'session-1',
      recordingPath: 'audio.webm',
      model: 'small',
      resourceMode: 'LIGHT',
    });
    await vi.waitFor(async () => expect((await jobs.getById(queued.id))?.status).toBe('COMPLETED'));
    expect(states).toEqual(
      expect.arrayContaining(['QUEUED', 'PREPARING', 'TRANSCRIBING', 'SAVING', 'COMPLETED']),
    );
    const transcript = await transcripts.getTranscriptBySessionId('session-1');
    expect(transcript?.segments[0]).toMatchObject({
      sessionId: 'session-1',
      startTime: 272,
      endTime: 287,
      text: 'Arquitectura hexagonal.',
    });
  });

  it('never runs more than one provider concurrently', async () => {
    let active = 0;
    let maximum = 0;
    const provider: TranscriptionProvider = {
      async transcribe() {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return { language: 'es', segments: [] };
      },
    };
    const { queue, jobs } = createQueue(provider);
    const first = await queue.enqueue({
      sessionId: 'one',
      recordingPath: 'one.webm',
      model: 'small',
      resourceMode: 'LIGHT',
    });
    const second = await queue.enqueue({
      sessionId: 'two',
      recordingPath: 'two.webm',
      model: 'small',
      resourceMode: 'NORMAL',
    });
    await vi.waitFor(async () => expect((await jobs.getById(second.id))?.status).toBe('COMPLETED'));
    expect((await jobs.getById(first.id))?.status).toBe('COMPLETED');
    expect(maximum).toBe(1);
  });

  it('cancels an active job without deleting prior transcript data', async () => {
    const provider: TranscriptionProvider = {
      transcribe(_path, options) {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('cancelled')), {
            once: true,
          });
        });
      },
    };
    const { queue, jobs, transcripts } = createQueue(provider);
    transcripts.values.set('session-1', {
      id: 'old',
      sessionId: 'session-1',
      language: 'es',
      createdAt: new Date(),
      segments: [],
    });
    const job = await queue.enqueue({
      sessionId: 'session-1',
      recordingPath: 'audio.webm',
      model: 'small',
      resourceMode: 'LIGHT',
    });
    await vi.waitFor(async () => expect((await jobs.getById(job.id))?.status).toBe('PREPARING'));
    await queue.cancel(job.id);
    expect((await jobs.getById(job.id))?.status).toBe('CANCELLED');
    expect(await transcripts.getTranscriptBySessionId('session-1')).not.toBeNull();
  });

  it('persists provider errors and can restart', async () => {
    const provider: TranscriptionProvider = {
      transcribe: () => Promise.reject(new Error('model unavailable')),
    };
    const { queue, jobs } = createQueue(provider);
    const job = await queue.enqueue({
      sessionId: 'session-1',
      recordingPath: 'audio.webm',
      model: 'small',
      resourceMode: 'LIGHT',
    });
    await vi.waitFor(async () => expect((await jobs.getById(job.id))?.status).toBe('FAILED'));
    expect((await jobs.getById(job.id))?.error).toContain('model unavailable');
    const restarted = await queue.restart(job.id);
    expect(restarted.status).toBe('QUEUED');
  });

  it('marks unfinished persisted jobs as interrupted on startup', async () => {
    const jobs = new MemoryJobs();
    jobs.values.set('job-1', {
      id: 'job-1',
      sessionId: 'session-1',
      recordingPath: 'audio.webm',
      model: 'small',
      resourceMode: 'LIGHT',
      status: 'TRANSCRIBING',
      progress: 32,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { queue } = createQueue(successfulProvider, jobs);
    await queue.initialize();
    expect((await jobs.getById('job-1'))?.status).toBe('FAILED');
  });
});
