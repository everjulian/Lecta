import type {
  RecordingEngine,
  RecordingEngineState,
  RecordingResult,
  RecordingStartOptions,
} from '@lecta/recording';

export class FakeRecordingEngine implements RecordingEngine {
  private state: RecordingEngineState = 'IDLE';
  private sessionId: string | null = null;
  private durationMs = 0;

  async start(options: RecordingStartOptions): Promise<void> {
    if (this.state !== 'IDLE' && this.state !== 'STOPPED')
      throw new Error('Fixture recording already started');
    this.sessionId = options.sessionId;
    this.durationMs = 1_000;
    await window.lecta.recording.initialize({
      sessionId: options.sessionId,
      startedAt: new Date('2026-08-18T12:00:00.000Z').toISOString(),
      audioFormat: 'audio/webm;codecs=opus',
      sampleRate: 48_000,
      microphone: {
        deviceId: options.microphoneDeviceId ?? null,
        label: options.microphoneLabel,
      },
    });
    await window.lecta.recording.writeChunk(
      options.sessionId,
      0,
      new Uint8Array([26, 69, 223, 163]).buffer,
      this.durationMs,
    );
    this.state = 'RECORDING';
  }

  async pause(): Promise<void> {
    const sessionId = this.requireSession();
    if (this.state !== 'RECORDING') throw new Error('Fixture recording is not active');
    this.durationMs += 1_000;
    await window.lecta.recording.updateStatus(sessionId, 'PAUSED', this.durationMs);
    this.state = 'PAUSED';
  }

  async resume(): Promise<void> {
    const sessionId = this.requireSession();
    if (this.state !== 'PAUSED') throw new Error('Fixture recording is not paused');
    await window.lecta.recording.updateStatus(sessionId, 'RECORDING', this.durationMs);
    this.state = 'RECORDING';
  }

  async stop(): Promise<RecordingResult> {
    const sessionId = this.requireSession();
    if (this.state !== 'RECORDING' && this.state !== 'PAUSED')
      throw new Error('Fixture recording is not active');
    this.durationMs += 1_000;
    const result = await window.lecta.recording.finalize({
      sessionId,
      endedAt: new Date('2026-08-18T12:00:03.000Z').toISOString(),
      durationMs: this.durationMs,
      status: 'COMPLETED',
    });
    this.state = 'STOPPED';
    return {
      sessionId,
      filePath: result.filePath,
      durationMs: this.durationMs,
      audioFormat: 'audio/webm;codecs=opus',
      sampleRate: 48_000,
    };
  }

  getState(): RecordingEngineState {
    return this.state;
  }

  getDuration(): number {
    return this.durationMs;
  }

  private requireSession(): string {
    if (!this.sessionId) throw new Error('Fixture recording has no session');
    return this.sessionId;
  }
}
