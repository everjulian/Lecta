import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type {
  ProviderTranscript,
  TranscriptionProgress,
  TranscriptionProvider,
} from '@lecta/transcription';

interface WorkerMessage {
  type: 'progress' | 'segment' | 'complete' | 'error';
  stage?: TranscriptionProgress['stage'];
  percent?: number;
  startTime?: number;
  endTime?: number;
  text?: string;
  language?: string | null;
  message?: string;
}

export class FasterWhisperProvider implements TranscriptionProvider {
  constructor(
    private readonly pythonExecutable: string,
    private readonly workerScript: string,
  ) {}

  transcribe(
    recordingPath: string,
    options: Parameters<TranscriptionProvider['transcribe']>[1],
  ): Promise<ProviderTranscript> {
    return new Promise((resolve, reject) => {
      const child = spawnWorker(this.pythonExecutable, this.workerScript, {
        recordingPath,
        model: options.model,
        resourceMode: options.resourceMode,
        modelDirectory: options.modelDirectory,
      });
      const segments: ProviderTranscript['segments'][number][] = [];
      let language: string | null = null;
      let stderr = '';
      let settled = false;
      let buffer = '';

      const abort = () => {
        child.kill();
        if (!settled) {
          settled = true;
          reject(new Error('Transcription cancelled'));
        }
      };
      options.signal.addEventListener('abort', abort, { once: true });
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf8');
      });
      child.stdout.on('data', (data: Buffer) => {
        buffer += data.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const message = JSON.parse(line) as WorkerMessage;
            if (message.type === 'progress' && message.stage && message.percent !== undefined) {
              options.onProgress({ stage: message.stage, percent: message.percent });
            } else if (
              message.type === 'segment' &&
              message.startTime !== undefined &&
              message.endTime !== undefined &&
              message.text !== undefined
            ) {
              segments.push({
                startTime: message.startTime,
                endTime: message.endTime,
                text: message.text,
              });
            } else if (message.type === 'complete') {
              language = message.language ?? null;
            } else if (message.type === 'error' && !settled) {
              settled = true;
              reject(new Error(message.message ?? 'faster-whisper failed'));
            }
          } catch {
            stderr += `\nInvalid worker output: ${line}`;
          }
        }
      });
      child.on('error', (cause) => {
        if (settled) return;
        settled = true;
        reject(
          new Error(
            `No se pudo iniciar Python. Instala el runtime de transcripción o configura LECTA_PYTHON_PATH. ${cause.message}`,
          ),
        );
      });
      child.on('close', (code) => {
        options.signal.removeEventListener('abort', abort);
        if (settled) return;
        settled = true;
        if (code === 0) resolve({ language, segments });
        else reject(new Error(stderr.trim() || `Transcription worker exited with code ${code}`));
      });
    });
  }
}

function spawnWorker(
  pythonExecutable: string,
  workerScript: string,
  input: {
    recordingPath: string;
    model: string;
    resourceMode: string;
    modelDirectory: string;
  },
): ChildProcessWithoutNullStreams {
  return spawn(
    pythonExecutable,
    [
      workerScript,
      '--recording',
      input.recordingPath,
      '--model',
      input.model,
      '--mode',
      input.resourceMode,
      '--models',
      input.modelDirectory,
    ],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    },
  );
}
