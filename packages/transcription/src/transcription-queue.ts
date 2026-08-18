import type { Transcript } from '@lecta/domain';
import type {
  QueueDependencies,
  TranscriptionJob,
  TranscriptionModel,
  TranscriptionResourceMode,
} from './transcription-types';

type Listener = (job: TranscriptionJob) => void;

export class TranscriptionQueue {
  private readonly pending: string[] = [];
  private readonly listeners = new Set<Listener>();
  private active: { jobId: string; controller: AbortController } | null = null;
  private shuttingDown = false;

  constructor(private readonly deps: QueueDependencies) {}

  async initialize(): Promise<void> {
    await this.deps.jobs.markActiveAsInterrupted(this.deps.now());
  }

  async enqueue(input: {
    sessionId: string;
    recordingPath: string;
    model: TranscriptionModel;
    resourceMode: TranscriptionResourceMode;
  }): Promise<TranscriptionJob> {
    const existing = await this.deps.jobs.getBySessionId(input.sessionId);
    if (existing && !['FAILED', 'CANCELLED', 'COMPLETED'].includes(existing.status)) {
      return existing;
    }
    const now = this.deps.now();
    const job: TranscriptionJob = {
      id: existing?.id ?? this.deps.generateId(),
      ...input,
      status: 'QUEUED',
      progress: 0,
      error: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.deps.jobs.save(job);
    this.pending.push(job.id);
    this.emit(job);
    void this.drain();
    return job;
  }

  async restart(jobId: string): Promise<TranscriptionJob> {
    const job = await this.requireJob(jobId);
    if (!['FAILED', 'CANCELLED', 'COMPLETED'].includes(job.status)) {
      throw new Error('This transcription cannot be restarted in its current state');
    }
    return this.enqueue({
      sessionId: job.sessionId,
      recordingPath: job.recordingPath,
      model: job.model,
      resourceMode: job.resourceMode,
    });
  }

  async cancel(jobId: string): Promise<void> {
    const job = await this.requireJob(jobId);
    if (job.status === 'SAVING' || job.status === 'COMPLETED') {
      throw new Error('The transcription is already being saved');
    }
    if (this.active?.jobId === jobId) this.active.controller.abort();
    const index = this.pending.indexOf(jobId);
    if (index >= 0) this.pending.splice(index, 1);
    await this.update(job, { status: 'CANCELLED', error: null });
  }

  getJob(jobId: string): Promise<TranscriptionJob | null> {
    return this.deps.jobs.getById(jobId);
  }
  getJobForSession(sessionId: string): Promise<TranscriptionJob | null> {
    return this.deps.jobs.getBySessionId(sessionId);
  }
  listJobs(): Promise<readonly TranscriptionJob[]> {
    return this.deps.jobs.list();
  }
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  shutdown(): void {
    this.shuttingDown = true;
    this.pending.splice(0);
    this.active?.controller.abort();
  }

  private async drain(): Promise<void> {
    if (this.shuttingDown) return;
    if (this.active) return;
    const jobId = this.pending.shift();
    if (!jobId) return;
    const job = await this.requireJob(jobId);
    const controller = new AbortController();
    this.active = { jobId, controller };
    try {
      await this.update(job, { status: 'PREPARING', progress: 1, error: null });
      const result = await this.deps.provider.transcribe(job.recordingPath, {
        model: job.model,
        resourceMode: job.resourceMode,
        modelDirectory: this.deps.modelDirectory,
        signal: controller.signal,
        onProgress: (progress) => {
          void this.update(job, {
            status: progress.stage,
            progress: Math.max(1, Math.min(95, progress.percent)),
          });
        },
      });
      if (controller.signal.aborted) return;
      await this.update(job, { status: 'SAVING', progress: 97 });
      if (controller.signal.aborted) return;
      const transcript: Transcript = {
        id: this.deps.generateId(),
        sessionId: job.sessionId,
        language: result.language,
        createdAt: this.deps.now(),
        segments: result.segments.map((segment) => ({
          ...segment,
          id: this.deps.generateId(),
          sessionId: job.sessionId,
        })),
      };
      await this.deps.transcripts.saveTranscript(transcript);
      await this.update(job, { status: 'COMPLETED', progress: 100, error: null });
    } catch (cause) {
      if (!controller.signal.aborted) {
        await this.update(job, {
          status: 'FAILED',
          error: cause instanceof Error ? cause.message : 'Transcription failed',
        });
      }
    } finally {
      this.active = null;
      if (!this.shuttingDown) void this.drain();
    }
  }

  private async update(
    job: TranscriptionJob,
    changes: Partial<Pick<TranscriptionJob, 'status' | 'progress' | 'error'>>,
  ): Promise<void> {
    Object.assign(job, changes, { updatedAt: this.deps.now() });
    await this.deps.jobs.save(job);
    this.emit(job);
  }

  private async requireJob(id: string): Promise<TranscriptionJob> {
    const job = await this.deps.jobs.getById(id);
    if (!job) throw new Error('Transcription job not found');
    return job;
  }

  private emit(job: TranscriptionJob): void {
    for (const listener of this.listeners) listener({ ...job });
  }
}
