import { env } from '../../config/env';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export class AiError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.name = 'AiError';
    this.status = status;
    this.retryable = retryable;
  }
}

interface CallOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  jsonMode?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const stripCodeFence = (value: string): string =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

/**
 * Thin wrapper over Groq's OpenAI-compatible endpoint.
 *
 * Why raw fetch instead of an SDK? One less dependency, full control over
 * timeouts/retries, and the request shape is easy to audit. The API key is only
 * ever read from the server environment.
 */
export const callGroq = async (options: CallOptions): Promise<GroqResult> => {
  if (!env.aiConfigured) {
    throw new AiError('AI is not configured on this server.', undefined, false);
  }

  const attempt = async (allowJsonMode: boolean): Promise<GroqResult> => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          top_p: 1,
          stream: false,
          ...(options.jsonMode && allowJsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const raw = await response.text();
        let detail = raw.slice(0, 300);
        try {
          const parsed = JSON.parse(raw) as { error?: { message?: string } };
          if (parsed.error?.message) detail = parsed.error.message;
        } catch {
          /* keep raw text */
        }

        // Some models/regions do not accept response_format. Retry once without
        // it instead of failing the whole feature.
        if (response.status === 400 && allowJsonMode && /response_format|json/i.test(detail)) {
          return attempt(false);
        }

        throw new AiError(
          `Groq request failed (${response.status}): ${detail}`,
          response.status,
          response.status === 429 || response.status >= 500,
        );
      }

      const payload = (await response.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = payload.choices?.[0]?.message?.content ?? '';
      if (!content.trim()) throw new AiError('Groq returned an empty completion.', 502, true);

      return {
        content: stripCodeFence(content),
        model: payload.model ?? options.model,
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiError(`Groq request timed out after ${env.AI_TIMEOUT_MS}ms.`, 504, true);
      }
      throw new AiError(
        `Groq request failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  let lastError: unknown;
  for (let attemptIndex = 0; attemptIndex <= env.AI_MAX_RETRIES; attemptIndex += 1) {
    try {
      return await attempt(true);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof AiError && error.retryable;
      if (!retryable || attemptIndex === env.AI_MAX_RETRIES) break;
      // Small jittered backoff; keeps rate-limit retries predictable.
      await sleep(400 * (attemptIndex + 1) + Math.floor(Math.random() * 250));
    }
  }

  throw lastError instanceof AiError
    ? lastError
    : new AiError('Groq request failed for an unknown reason.');
};
