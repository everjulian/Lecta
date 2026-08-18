import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { InfrastructureError } from '../errors';

interface Preferences {
  microphoneDeviceId: string | null;
}

export class FilePreferenceStore {
  constructor(private readonly directory: string) {}

  async getMicrophoneDeviceId(): Promise<string | null> {
    try {
      return (JSON.parse(await readFile(this.filePath, 'utf8')) as Preferences).microphoneDeviceId;
    } catch (cause) {
      if (isMissingFile(cause)) return null;
      throw new InfrastructureError('Unable to read microphone preferences', { cause });
    }
  }

  async setMicrophoneDeviceId(deviceId: string | null): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify({ microphoneDeviceId: deviceId }, null, 2), 'utf8');
    await rename(temporary, this.filePath);
  }

  private get filePath(): string {
    return path.join(this.directory, 'preferences.json');
  }
}

function isMissingFile(cause: unknown): boolean {
  return cause instanceof Error && 'code' in cause && cause.code === 'ENOENT';
}
