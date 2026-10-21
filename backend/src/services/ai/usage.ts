import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

export const estimateCostUsd = (promptTokens: number, completionTokens: number): number => {
  const input = (promptTokens / 1_000_000) * env.AI_INPUT_PRICE_PER_M;
  const output = (completionTokens / 1_000_000) * env.AI_OUTPUT_PRICE_PER_M;
  return Number((input + output).toFixed(6));
};

export interface UsageInput {
  ticketId?: string | null;
  operation: 'CLASSIFY' | 'DRAFT';
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  success: boolean;
  fallback?: boolean;
  cached?: boolean;
  error?: string;
}

/** Usage logging is best-effort: telemetry must never break the ticket flow. */
export const recordAiUsage = async (input: UsageInput): Promise<void> => {
  try {
    const promptTokens = input.promptTokens ?? 0;
    const completionTokens = input.completionTokens ?? 0;
    await prisma.aiUsage.create({
      data: {
        ticketId: input.ticketId ?? null,
        operation: input.operation,
        model: input.model,
        promptTokens,
        completionTokens,
        latencyMs: input.latencyMs ?? 0,
        estimatedCostUsd: estimateCostUsd(promptTokens, completionTokens),
        success: input.success,
        fallback: input.fallback ?? false,
        cached: input.cached ?? false,
        error: input.error?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[ai] Failed to record usage:', error);
  }
};
