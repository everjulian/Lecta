import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectronRecordingAdapter,
  RecordingEngineError,
  type RecordingChunkSink,
} from '@lecta/recording';

class FakeTrack {
  stopped = false;
  stop(): void {
    this.stopped = true;
  }
}

class FakeStream {
  readonly audio = [new FakeTrack()];
  readonly video = [new FakeTrack()];
  getAudioTracks(): MediaStreamTrack[] {
    return this.audio as unknown as MediaStreamTrack[];
  }
  getVideoTracks(): MediaStreamTrack[] {
    return this.video as unknown as MediaStreamTrack[];
  }
  getTracks(): MediaStreamTrack[] {
    return [...this.audio, ...this.video] as unknown as MediaStreamTrack[];
  }
}

class FakeRecorder extends EventTarget {
  state: RecordingState = 'inactive';
  start(): void {
    this.state = 'recording';
  }
  pause(): void {
    this.state = 'paused';
  }
  resume(): void {
    this.state = 'recording';
  }
  requestData(): void {
    this.emitData();
  }
  stop(): void {
    this.emitData();
    this.state = 'inactive';
    this.dispatchEvent(new Event('stop'));
  }
  private emitData(): void {
    const event = new Event('dataavailable');
    Object.defineProperty(event, 'data', { value: new Blob(['audio']) });
    this.dispatchEvent(event);
  }
}

describe('ElectronRecordingAdapter', () => {
  let now: number;
  let recorder: FakeRecorder;
  let sink: {
    initialize: ReturnType<typeof vi.fn>;
    writeChunk: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    finalize: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    now = 1_000;
    recorder = new FakeRecorder();
    sink = {
      initialize: vi.fn().mockResolvedValue(undefined),
      writeChunk: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      finalize: vi.fn().mockResolvedValue({ filePath: 'recording.webm' }),
    };
  });

  const createEngine = (systemStream = new FakeStream()) =>
    new ElectronRecordingAdapter({
      getSystemStream: () => Promise.resolve(systemStream as unknown as MediaStream),
      getMicrophoneStream: () => Promise.resolve(new FakeStream() as unknown as MediaStream),
      createAudioContext: () => fakeAudioContext(),
      createMediaRecorder: () => recorder as unknown as MediaRecorder,
      chunkSink: sink as unknown as RecordingChunkSink,
      now: () => now,
      isTypeSupported: () => true,
    });

  it('starts, pauses, resumes and stops while tracking active duration', async () => {
    const system = new FakeStream();
    const engine = createEngine(system);
    await engine.start({ sessionId: 'session-1', microphoneLabel: 'USB Mic' });
    expect(engine.getState()).toBe('RECORDING');
    expect(system.video[0]?.stopped).toBe(true);
    now = 6_000;
    await engine.pause();
    expect(engine.getDuration()).toBe(5_000);
    now = 10_000;
    await engine.resume();
    now = 13_000;
    const result = await engine.stop();
    expect(result.durationMs).toBe(8_000);
    expect(engine.getState()).toBe('STOPPED');
    expect(sink.writeChunk).toHaveBeenCalled();
    expect(sink.finalize).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
  });

  it('rejects double start', async () => {
    const engine = createEngine();
    await engine.start({ sessionId: 'session-1', microphoneLabel: 'Mic' });
    await expect(
      engine.start({ sessionId: 'session-1', microphoneLabel: 'Mic' }),
    ).rejects.toMatchObject({ code: 'ALREADY_STARTED' });
  });

  it('rejects stop without start', async () => {
    await expect(createEngine().stop()).rejects.toBeInstanceOf(RecordingEngineError);
  });

  it('enters failed state when capture cannot start', async () => {
    const engine = new ElectronRecordingAdapter({
      getSystemStream: () => Promise.reject(new Error('capture denied')),
      getMicrophoneStream: () => Promise.resolve(new FakeStream() as unknown as MediaStream),
      createAudioContext: () => fakeAudioContext(),
      createMediaRecorder: () => recorder as unknown as MediaRecorder,
      chunkSink: sink as unknown as RecordingChunkSink,
      now: () => now,
      isTypeSupported: () => true,
    });
    await expect(
      engine.start({ sessionId: 'session-1', microphoneLabel: 'Mic' }),
    ).rejects.toMatchObject({ code: 'START_FAILED' });
    expect(engine.getState()).toBe('FAILED');
  });
});

function fakeAudioContext(): AudioContext {
  const destination = { stream: new FakeStream() as unknown as MediaStream };
  const connected = { connect: () => destination };
  return {
    sampleRate: 48_000,
    state: 'running',
    createMediaStreamDestination: () => destination,
    createMediaStreamSource: () => ({ connect: () => connected }),
    createGain: () => ({ gain: { value: 1 }, connect: () => destination }),
    close: () => Promise.resolve(),
  } as unknown as AudioContext;
}
