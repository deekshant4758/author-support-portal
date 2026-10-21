import type { Book, Message, Ticket } from '@prisma/client';
import { env } from '../../config/env';
import type { TicketCategory } from '../../lib/constants';
import { CATEGORY_LABELS } from '../../lib/constants';
import { AiError, callGroq } from './groqClient';
import { TtlCache, hashKey } from './cache';
import { templateDraft } from './fallback';
import { retrieveKnowledge } from './knowledgeBase';
import { buildDraftMessages } from './prompts';
import { estimateCostUsd, recordAiUsage } from './usage';

export type DraftTone = 'EMPATHETIC' | 'CONCISE' | 'ESCALATION';

export interface DraftContext {
  ticket: Pick<
    Ticket,
    'id' | 'publicId' | 'subject' | 'description' | 'priority' | 'category' | 'status' | 'createdAt' | 'lastMessageAt'
  >;
  book?: Book | null;
  authorName: string;
  authorTier?: string | null;
  authorCity?: string | null;
  messages?: Pick<Message, 'role' | 'body' | 'createdAt'>[];
}

export interface DraftResult {
  body: string;
  source: 'AI' | 'TEMPLATE';
  model: string;
  tone: DraftTone;
  cached: boolean;
  sections: string[];
  category: TicketCategory;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

/** Short TTL: regeneration reuses spend only while the ticket is unchanged. */
const draftCache = new TtlCache<DraftResult>(15 * 60 * 1000, 100);

const cleanDraft = (raw: string): string =>
  raw
    .replace(/^subject:.*\n/i, '')
    .replace(/\[(author|your)\s*name\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const generateDraft = async (
  context: DraftContext,
  options: {
    tone: DraftTone;
    includeHistory: boolean;
    instructions?: string;
  },
): Promise<DraftResult> => {
  const category = context.ticket.category as TicketCategory;
  const text = `${context.ticket.subject}\n${context.ticket.description}`;
  const retrieval = retrieveKnowledge(text, category, 3);

  const cacheKey = hashKey(
    [
      'draft',
      context.ticket.id,
      context.ticket.priority,
      context.ticket.category,
      context.ticket.lastMessageAt.toISOString(),
      options.tone,
      options.includeHistory ? 'history' : 'nohistory',
      options.instructions ?? '',
    ].join('|'),
  );

  const cached = draftCache.get(cacheKey);
  if (cached) {
    await recordAiUsage({
      ticketId: context.ticket.id,
      operation: 'DRAFT',
      model: cached.model,
      success: true,
      cached: true,
    });
    // A cache hit incurs no token spend for this request, so the editor shows
    // the honest marginal cost (zero) while the cached response is reused.
    return {
      ...cached,
      cached: true,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      estimatedCostUsd: 0,
    };
  }

  const fallbackDraft = (error?: string): DraftResult => {
    const body = templateDraft({
      ticket: context.ticket,
      book: context.book,
      authorName: context.authorName,
      authorTier: context.authorTier,
      messages: context.messages,
    });
    return {
      body,
      source: 'TEMPLATE',
      model: 'bookleaf-template-v1',
      tone: options.tone,
      cached: false,
      sections: retrieval.references,
      category,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      estimatedCostUsd: 0,
    };
  };

  if (!env.aiConfigured) {
    const result = fallbackDraft('AI not configured');
    await recordAiUsage({
      ticketId: context.ticket.id,
      operation: 'DRAFT',
      model: result.model,
      success: true,
      fallback: true,
    });
    return result;
  }

  try {
    const completion = await callGroq({
      model: env.GROQ_MODEL_DRAFT,
      messages: buildDraftMessages({
        ticket: context.ticket,
        book: context.book,
        authorName: context.authorName,
        authorTier: context.authorTier,
        authorCity: context.authorCity,
        messages: context.messages,
        sections: retrieval.sections,
        tone: options.tone,
        includeHistory: options.includeHistory,
        instructions: options.instructions,
      }),
      maxTokens: 700,
      temperature: 0.4,
    });

    const body = cleanDraft(completion.content);
    if (body.length < 40) throw new AiError('Draft was too short to be useful.', 502, true);

    const result: DraftResult = {
      body,
      source: 'AI',
      model: completion.model,
      tone: options.tone,
      cached: false,
      sections: retrieval.references,
      category,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      latencyMs: completion.latencyMs,
      estimatedCostUsd: estimateCostUsd(completion.promptTokens, completion.completionTokens),
    };

    draftCache.set(cacheKey, result);
    await recordAiUsage({
      ticketId: context.ticket.id,
      operation: 'DRAFT',
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
    console.warn(`[ai] Draft fell back to template: ${message}`);

    const result = fallbackDraft(message);
    await recordAiUsage({
      ticketId: context.ticket.id,
      operation: 'DRAFT',
      model: env.GROQ_MODEL_DRAFT,
      success: false,
      fallback: true,
      error: message,
    });
    return result;
  }
};

export const draftCacheStats = () => draftCache.stats();
export const categoryLabel = (category: string) =>
  CATEGORY_LABELS[category as TicketCategory] ?? category;
