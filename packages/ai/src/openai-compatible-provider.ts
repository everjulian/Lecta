import type { AIProvider } from './ai-types';

interface ProviderOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class OpenAICompatibleAIProvider implements AIProvider {
  private readonly request: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(private readonly options: ProviderOptions) {
    if (!options.apiKey.trim()) throw new Error('LECTA_AI_API_KEY is not configured');
    this.request = options.fetch ?? fetch;
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async generateJson(input: {
    systemPrompt: string;
    userPrompt: string;
    signal: AbortSignal;
  }): Promise<unknown> {
    const retries = this.options.maxRetries ?? 2;
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 60_000);
      const signal = AbortSignal.any([input.signal, timeout]);
      try {
        const response = await this.request(
          `${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.options.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.options.model,
              temperature: 0.2,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: input.systemPrompt },
                { role: 'user', content: input.userPrompt },
              ],
            }),
            signal,
          },
        );
        if (!response.ok) {
          const message = `AI provider returned ${response.status}`;
          if (!isRetryable(response.status)) throw new Error(message);
          throw new RetryableAIError(message);
        }
        const payload = (await response.json()) as unknown;
        return parseProviderPayload(payload);
      } catch (cause) {
        if (input.signal.aborted) throw new Error('AI generation cancelled', { cause });
        lastError = cause;
        if (attempt === retries || !isRetryableError(cause)) break;
        await this.sleep(250 * 2 ** attempt);
      }
    }
    if (lastError instanceof DOMException && lastError.name === 'TimeoutError') {
      throw new Error('AI request timed out', { cause: lastError });
    }
    throw lastError instanceof Error ? lastError : new Error('AI request failed');
  }
}

class RetryableAIError extends Error {}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  return (
    error instanceof RetryableAIError ||
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === 'TimeoutError')
  );
}

function parseProviderPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object') throw new Error('AI provider returned invalid JSON');
  const choices = (value as Readonly<Record<string, unknown>>)['choices'];
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
    throw new Error('AI provider response has no choices');
  }
  const message = (choices[0] as Readonly<Record<string, unknown>>)['message'];
  if (!message || typeof message !== 'object')
    throw new Error('AI provider response has no message');
  const content = (message as Readonly<Record<string, unknown>>)['content'];
  if (typeof content !== 'string') throw new Error('AI provider response content is invalid');
  const normalized = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(normalized) as unknown;
  } catch (cause) {
    throw new Error('AI provider returned malformed structured output', { cause });
  }
}
