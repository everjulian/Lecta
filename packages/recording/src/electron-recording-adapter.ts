import {
  RecordingEngineError,
  type RecordingEngine,
  type RecordingEngineState,
  type RecordingResult,
  type RecordingStartOptions,
} from './recording-engine';

export interface RecordingChunkSink {
  initialize(input: {
    sessionId: string;
    startedAt: string;
    audioFormat: string;
    sampleRate: number;
    microphone: { deviceId: string | null; label: string };
  }): Promise<void>;
  writeChunk(
    sessionId: string,
    index: number,
    data: ArrayBuffer,
    durationMs: number,
  ): Promise<void>;
  updateStatus(
    sessionId: string,
    status: 'RECORDING' | 'PAUSED',
    durationMs: number,
  ): Promise<void>;
  finalize(input: {
    sessionId: string;
    endedAt: string;
    durationMs: number;
    status: 'COMPLETED' | 'FAILED';
  }): Promise<{ filePath: string }>;
}

export interface ElectronRecordingDependencies {
  getSystemStream(): Promise<MediaStream>;
  getMicrophoneStream(deviceId?: string): Promise<MediaStream>;
  createAudioContext(): AudioContext;
  createMediaRecorder(stream: MediaStream, options: MediaRecorderOptions): MediaRecorder;
  chunkSink: RecordingChunkSink;
  now(): number;
  chunkIntervalMs?: number;
  isTypeSupported?(mimeType: string): boolean;
}

export class ElectronRecordingAdapter implements RecordingEngine {
  private state: RecordingEngineState = 'IDLE';
  private recorder: MediaRecorder | null = null;
  private context: AudioContext | null = null;
  private streams: MediaStream[] = [];
  private sessionId: string | null = null;
  private startedAt = 0;
  private activeSince = 0;
  private accumulatedMs = 0;
  private chunkIndex = 0;
  private pendingWrite: Promise<void> = Promise.resolve();
  private writeError: unknown = null;
  private audioFormat = 'audio/webm';
  private sampleRate = 0;

  constructor(private readonly deps: ElectronRecordingDependencies) {}

  async start(options: RecordingStartOptions): Promise<void> {
    if (this.state !== 'IDLE' && this.state !== 'STOPPED') {
      throw new RecordingEngineError('Recording has already started', 'ALREADY_STARTED');
    }
    try {
      const [systemStream, microphoneStream] = await Promise.all([
        this.deps.getSystemStream(),
        this.deps.getMicrophoneStream(options.microphoneDeviceId),
      ]);
      systemStream.getVideoTracks().forEach((track) => track.stop());
      this.streams = [systemStream, microphoneStream];
      this.context = this.deps.createAudioContext();
      const destination = this.context.createMediaStreamDestination();
      this.connectWithHeadroom(systemStream, destination);
      this.connectWithHeadroom(microphoneStream, destination);
      this.audioFormat = chooseAudioFormat((mimeType) =>
        this.deps.isTypeSupported
          ? this.deps.isTypeSupported(mimeType)
          : MediaRecorder.isTypeSupported(mimeType),
      );
      this.sampleRate = this.context.sampleRate;
      this.recorder = this.deps.createMediaRecorder(destination.stream, {
        mimeType: this.audioFormat,
        audioBitsPerSecond: 128_000,
      });
      this.sessionId = options.sessionId;
      this.startedAt = this.deps.now();
      this.activeSince = this.startedAt;
      this.accumulatedMs = 0;
      this.chunkIndex = 0;
      this.pendingWrite = Promise.resolve();
      this.writeError = null;
      await this.deps.chunkSink.initialize({
        sessionId: options.sessionId,
        startedAt: new Date(this.startedAt).toISOString(),
        audioFormat: this.audioFormat,
        sampleRate: this.sampleRate,
        microphone: {
          deviceId: options.microphoneDeviceId ?? null,
          label: options.microphoneLabel,
        },
      });
      this.bindRecorder(this.recorder, options.sessionId);
      this.recorder.start(this.deps.chunkIntervalMs ?? 5_000);
      this.state = 'RECORDING';
    } catch (cause) {
      this.state = 'FAILED';
      await this.releaseResources();
      throw new RecordingEngineError('Unable to start audio recording', 'START_FAILED', { cause });
    }
  }

  async pause(): Promise<void> {
    if (this.state !== 'RECORDING' || !this.recorder) {
      throw new RecordingEngineError('Recording is not active', 'NOT_RECORDING');
    }
    this.accumulatedMs += this.deps.now() - this.activeSince;
    this.recorder.pause();
    this.recorder.requestData();
    this.state = 'PAUSED';
    await this.deps.chunkSink.updateStatus(this.sessionId!, 'PAUSED', this.accumulatedMs);
  }

  async resume(): Promise<void> {
    if (this.state !== 'PAUSED' || !this.recorder) {
      throw new RecordingEngineError('Recording is not paused', 'NOT_PAUSED');
    }
    this.activeSince = this.deps.now();
    this.recorder.resume();
    this.state = 'RECORDING';
    await this.deps.chunkSink.updateStatus(this.sessionId!, 'RECORDING', this.accumulatedMs);
  }

  async stop(): Promise<RecordingResult> {
    if (
      (this.state !== 'RECORDING' && this.state !== 'PAUSED') ||
      !this.recorder ||
      !this.sessionId
    ) {
      throw new RecordingEngineError('Recording has not started', 'NOT_STARTED');
    }
    if (this.state === 'RECORDING') this.accumulatedMs += this.deps.now() - this.activeSince;
    const sessionId = this.sessionId;
    await new Promise<void>((resolve, reject) => {
      this.recorder?.addEventListener('stop', () => resolve(), { once: true });
      this.recorder?.addEventListener('error', () => reject(new Error('MediaRecorder failed')), {
        once: true,
      });
      this.recorder?.stop();
    });
    await this.pendingWrite;
    if (this.writeError) {
      await this.releaseResources();
      this.state = 'FAILED';
      throw new RecordingEngineError('An audio chunk could not be saved', 'CHUNK_WRITE_FAILED', {
        cause: this.writeError,
      });
    }
    const endedAt = this.deps.now();
    const stored = await this.deps.chunkSink.finalize({
      sessionId,
      endedAt: new Date(endedAt).toISOString(),
      durationMs: this.accumulatedMs,
      status: 'COMPLETED',
    });
    await this.releaseResources();
    this.state = 'STOPPED';
    return {
      sessionId,
      filePath: stored.filePath,
      durationMs: this.accumulatedMs,
      audioFormat: this.audioFormat,
      sampleRate: this.sampleRate,
    };
  }

  getState(): RecordingEngineState {
    return this.state;
  }

  getDuration(): number {
    return (
      this.accumulatedMs + (this.state === 'RECORDING' ? this.deps.now() - this.activeSince : 0)
    );
  }

  private connectWithHeadroom(
    stream: MediaStream,
    destination: MediaStreamAudioDestinationNode,
  ): void {
    if (!this.context || stream.getAudioTracks().length === 0) return;
    const source = this.context.createMediaStreamSource(stream);
    const gain = this.context.createGain();
    gain.gain.value = 0.7;
    source.connect(gain).connect(destination);
  }

  private bindRecorder(recorder: MediaRecorder, sessionId: string): void {
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size === 0) return;
      const index = this.chunkIndex++;
      this.pendingWrite = this.pendingWrite.then(async () => {
        if (this.writeError) return;
        const data = await event.data.arrayBuffer();
        try {
          await this.deps.chunkSink.writeChunk(sessionId, index, data, this.getDuration());
        } catch (cause) {
          this.writeError = cause;
        }
      });
    });
  }

  private async releaseResources(): Promise<void> {
    this.streams.flatMap((stream) => stream.getTracks()).forEach((track) => track.stop());
    this.streams = [];
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
    this.recorder = null;
  }
}

function chooseAudioFormat(isTypeSupported: (mimeType: string) => boolean): string {
  const preferred = 'audio/webm;codecs=opus';
  return isTypeSupported(preferred) ? preferred : 'audio/webm';
}
