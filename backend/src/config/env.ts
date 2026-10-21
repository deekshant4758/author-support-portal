import 'dotenv/config';
import { z } from 'zod';

/**
 * All configuration is read from environment variables exactly once, validated,
 * and then exported as a typed object. Nothing else in the codebase touches
 * `process.env` directly - this keeps secrets in one place and makes the
 * "no API keys in code / no keys in frontend" requirement easy to audit.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default('local-development-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  GROQ_MODEL_CLASSIFY: z.string().default('openai/gpt-oss-20b'),
  GROQ_MODEL_DRAFT: z.string().default('openai/gpt-oss-120b'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  AI_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() !== 'false'),
  AI_INPUT_PRICE_PER_M: z.coerce.number().nonnegative().default(0.15),
  AI_OUTPUT_PRICE_PER_M: z.coerce.number().nonnegative().default(0.6),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  allowedOrigins: raw.CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  aiConfigured: Boolean(raw.GROQ_API_KEY) && raw.AI_ENABLED,
};

if (!raw.GROQ_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[ai] GROQ_API_KEY is not set. The portal will run in deterministic heuristic mode ' +
      '(classification rules + grounded template drafts). Add a key to backend/.env to enable AI.',
  );
}
