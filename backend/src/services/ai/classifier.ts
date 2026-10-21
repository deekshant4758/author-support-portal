import { env } from '../../config/env';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from '../../lib/constants';
import { AiError, callGroq } from './groqClient';
import { TtlCache, hashKey } from './cache';
import { heuristicClassify, heuristicPriority } from './fallback';
import { buildTriageMessages, type TriageContext } from './prompts';
import { recordAiUsage } from './usage';

export interface ClassificationResult {
  category: TicketCategory;
  priority: TicketPriority;
  confidence: number;
  priorityReason: string;
  source: 'AI' | 'HEURISTIC';
  model: string;
  cached: boolean;
  sections?: string[];
}

/** Classification is stable for the same input, so caching removes repeat spend. */
const triageCache = new TtlCache<ClassificationResult>(30 * 60 * 1000, 300);

const parseTriageJson = (
  raw: string,
): { category: TicketCategory; priority: TicketPriority; confidence: number; reason: string } => {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new AiError('Triage response did not contain JSON.', 502, true);

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new AiError('Triage response JSON could not be parsed.', 502, true);
  }

  const candidate = parsed as Record<string, unknown>;
  const category = String(candidate.category ?? '').toUpperCase();
  const priority = String(candidate.priority ?? '').toUpperCase();
  const rawConfidence = Number(candidate.confidence);
  const reason = String(candidate.priorityReason ?? candidate.reason ?? '').trim();

  if (!TICKET_CATEGORIES.includes(category as TicketCategory)) {
    throw new AiError(`Triage returned an unknown category: ${category || 'empty'}`, 502, true);
  }
  if (!TICKET_PRIORITIES.includes(priority as TicketPriority)) {
    throw new AiError(`Triage returned an unknown priority: ${priority || 'empty'}`, 502, true);
  }

  // Accept both 0-1 and 0-100 confidence formats, then clamp.
  const normalizedConfidence = Number.isFinite(rawConfidence)
    ? rawConfidence > 1
      ? rawConfidence / 100
      : rawConfidence
    : 0.6;

  return {
    category: category as TicketCategory,
    priority: priority as TicketPriority,
    confidence: Math.min(0.99, Math.max(0.3, Number(normalizedConfidence.toFixed(2)))),
    reason:
      reason ||
      'AI triage: category and priority inferred from the ticket content and account context.',
  };
};

const heuristicResult = (context: TriageContext): ClassificationResult => {
  const text = `${context.subject}\n${context.description}`;
  const category = heuristicClassify(text);
  const { priority, reason } = heuristicPriority(text, category.category, {
    status: context.book?.status,
    royaltyPending: context.book?.royaltyPending,
  });
  return {
    category: category.category,
    priority,
    confidence: category.confidence,
    priorityReason: reason,
    source: 'HEURISTIC',
    model: 'bookleaf-rules-v1',
    cached: false,
  };
};

/**
 * Auto-triage a new ticket. This function never throws: if Groq is down, rate
 * limited or misconfigured, the rule engine returns a usable category/priority so
 * the author's ticket is still created and routed.
 */
export const classifyTicket = async (
  context: TriageContext,
  ticketId?: string,
): Promise<ClassificationResult> => {
  const cacheKey = hashKey(
    `triage|${context.subject}|${context.description}|${context.book?.isbn ?? 'general'}|${context.book?.status ?? ''}`,
  );
  const cached = triageCache.get(cacheKey);
  if (cached) {
    await recordAiUsage({
      ticketId,
      operation: 'CLASSIFY',
      model: cached.model,
      success: true,
      cached: true,
    });
    return { ...cached, cached: true };
  }

  if (!env.aiConfigured) {
    const result = heuristicResult(context);
    await recordAiUsage({
      ticketId,
      operation: 'CLASSIFY',
      model: result.model,
      success: true,
      fallback: true,
    });
    return result;
  }

  try {
    const completion = await callGroq({
      model: env.GROQ_MODEL_CLASSIFY,
      messages: buildTriageMessages(context),
      maxTokens: 300,
      temperature: 0,
      jsonMode: true,
    });

    const parsed = parseTriageJson(completion.content);
    const result: ClassificationResult = {
      category: parsed.category,
      priority: parsed.priority,
      confidence: parsed.confidence,
      priorityReason: parsed.reason,
      source: 'AI',
      model: completion.model,
      cached: false,
    };

    triageCache.set(cacheKey, result);
    await recordAiUsage({
      ticketId,
      operation: 'CLASSIFY',
      model: completion.model,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      latencyMs: completion.latencyMs,
      success: true,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn(`[ai] Classification fell back to rules: ${message}`);

    const result = heuristicResult(context);
    await recordAiUsage({
      ticketId,
      operation: 'CLASSIFY',
      model: env.GROQ_MODEL_CLASSIFY,
      success: false,
      fallback: true,
      error: message,
    });
    return result;
  }
};

export const triageCacheStats = () => triageCache.stats();
