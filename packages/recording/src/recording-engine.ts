export type RecordingEngineState = 'IDLE' | 'RECORDING' | 'PAUSED' | 'STOPPED' | 'FAILED';

export interface RecordingStartOptions {
  sessionId: string;
  microphoneDeviceId?: string;
  microphoneLabel: string;
}

export interface RecordingResult {
  sessionId: string;
  filePath: string;
  durationMs: number;
  audioFormat: string;
  sampleRate: number;
}

export interface RecordingEngine {
  start(options: RecordingStartOptions): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<RecordingResult>;
  getState(): RecordingEngineState;
  getDuration(): number;
}

export class RecordingEngineError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RecordingEngineError';
  }
}
