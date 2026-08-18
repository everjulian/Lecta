import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileRecordingStore } from '@lecta/infrastructure';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('FileRecordingStore', () => {
  it('writes chunks incrementally and leaves an incomplete recording recoverable', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lecta-recordings-'));
    directories.push(root);
    const store = new FileRecordingStore(root);
    await store.initialize({
      sessionId: 'session-1',
      startedAt: '2026-08-07T12:00:00.000Z',
      audioFormat: 'audio/webm;codecs=opus',
      sampleRate: 48_000,
      microphone: { deviceId: 'mic-1', label: 'USB Mic' },
    });
    await store.writeChunk('session-1', 0, new Uint8Array([1, 2]), 5_000);
    await store.writeChunk('session-1', 1, new Uint8Array([3, 4]), 10_000);
    expect([...readFileSync(join(root, 'session-1', 'recording.webm'))]).toEqual([1, 2, 3, 4]);
    expect(await store.listIncomplete()).toHaveLength(1);
    expect(await store.recover('session-1')).toEqual({
      filePath: join(root, 'session-1', 'recording.webm'),
    });
    expect(await store.listIncomplete()).toHaveLength(0);
  });

  it('discards only the validated session directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lecta-recordings-'));
    directories.push(root);
    const store = new FileRecordingStore(root);
    await expect(store.discard('../outside')).rejects.toThrow('Invalid recording session id');
  });
});
