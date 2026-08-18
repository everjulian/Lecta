import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const { classifyError, executeWithRecovery, mapIpcError } =
  await import('../../apps/desktop/main/ipc-result');
const { SafeStderrLogger } = await import('../../apps/desktop/main/safe-stderr-logger');

describe('IPC error model', () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each([
    [{ code: 'ENODEV' }, 'recording:initialize', 'RECORDING_DEVICE_UNAVAILABLE', true],
    [{ code: 'ENOENT' }, 'recording:recover', 'RECORDING_FILE_MISSING', false],
    [new Error('provider detail'), 'transcription:enqueue', 'TRANSCRIPTION_FAILED', true],
    [new Error('provider detail'), 'ai:generate-notes', 'AI_UNAVAILABLE', true],
    [new Error('worker detail'), 'knowledge:ask', 'KNOWLEDGE_INDEX_FAILED', true],
    [{ code: 'SQLITE_BUSY' }, 'session:list', 'DATABASE_BUSY', true],
    [{ code: 'ENOSPC' }, 'recording:write-chunk', 'STORAGE_FULL', false],
    [new Error('private detail'), 'session:create', 'UNKNOWN_ERROR', true],
  ])('maps %s on %s to %s', (cause, operation, code, retryable) => {
    expect(classifyError(cause, operation)).toBe(code);
    const result = mapIpcError(cause, operation);
    expect(result).toMatchObject({ code, retryable });
    expect(result.userMessage).not.toContain('detail');
    expect(result.safeStateMessage.length).toBeGreaterThan(10);
    expect(result.technicalDetailsId).toBeTruthy();
  });

  it('backs off database reads and then succeeds', async () => {
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ code: 'SQLITE_BUSY' })
      .mockRejectedValueOnce({ code: 'SQLITE_LOCKED' })
      .mockResolvedValue('ready');
    await expect(executeWithRecovery('session:list', action)).resolves.toBe('ready');
    expect(action).toHaveBeenCalledTimes(3);
  });

  it('does not retry a database write automatically', async () => {
    const action = vi.fn<() => Promise<void>>().mockRejectedValue({ code: 'SQLITE_BUSY' });
    await expect(executeWithRecovery('session:create', action)).rejects.toMatchObject({
      code: 'SQLITE_BUSY',
    });
    expect(action).toHaveBeenCalledOnce();
  });

  it('logs only allowlisted diagnostic metadata', () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    new SafeStderrLogger().error('IPC operation failed', new Error('secret transcript'), {
      technicalDetailsId: 'detail-1',
      operation: 'ai:generate-notes',
      apiKey: 'secret-key',
      transcript: 'private content',
    });
    const output = String(write.mock.calls[0]?.[0]);
    expect(output).toContain('detail-1');
    expect(output).not.toContain('secret-key');
    expect(output).not.toContain('private content');
    expect(output).not.toContain('secret transcript');
  });
});
