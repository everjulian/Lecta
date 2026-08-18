import { describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleAIProvider } from '@lecta/ai';

const input = { systemPrompt: 'system', userPrompt: 'user', signal: new AbortController().signal };
describe('OpenAICompatibleAIProvider', () => {
  it('retries transient errors and parses structured output', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '```json\n{"ok":true}\n```' } }] }),
          { status: 200 },
        ),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const provider = new OpenAICompatibleAIProvider({
      apiKey: 'secret',
      baseUrl: 'https://example.test',
      model: 'model',
      fetch: request,
      sleep,
      maxRetries: 2,
    });
    await expect(provider.generateJson(input)).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it('reports malformed responses and timeout failures', async () => {
    const malformed = new OpenAICompatibleAIProvider({
      apiKey: 'secret',
      baseUrl: 'https://example.test',
      model: 'model',
      fetch: vi.fn().mockResolvedValue(new Response('{"choices":[]}', { status: 200 })),
    });
    await expect(malformed.generateJson(input)).rejects.toThrow('no choices');
    const timeout = new OpenAICompatibleAIProvider({
      apiKey: 'secret',
      baseUrl: 'https://example.test',
      model: 'model',
      maxRetries: 0,
      fetch: vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')),
    });
    await expect(timeout.generateJson(input)).rejects.toThrow('timed out');
  });
});
