/**
 * AI layer tests. These run without a Groq key and without a live database:
 * `fetch` is stubbed, and usage logging is best-effort (it swallows DB errors).
 *
 * Run from backend/: npm test
 */
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';

// Usage logging is stubbed below, so this URL only has to pass env validation.
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:5432/unused';
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'test-key';
process.env.AI_ENABLED = 'true';
process.env.AI_MAX_RETRIES = '0';

const { heuristicClassify, heuristicPriority, templateDraft } = await import('../src/services/ai/fallback');
const { classifyTicket } = await import('../src/services/ai/classifier');
const { generateDraft } = await import('../src/services/ai/drafter');
const { buildDraftMessages } = await import('../src/services/ai/prompts');
const { prisma } = await import('../src/lib/prisma');
prisma.aiUsage.create = async () => ({}) as never;

after(async () => {
  await prisma.$disconnect();
});

const realFetch = global.fetch;

const mockCompletion = (content: string) => {
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        model: 'mock/model',
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 120, completion_tokens: 80 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;
};

afterEach(() => {
  global.fetch = realFetch;
});

test('royalty delay is classified as royalty and prioritised above a bio request', () => {
  const royalty = heuristicClassify(
    "I published my book 4 months ago and still haven't received any royalty. What's going on?",
  );
  assert.equal(royalty.category, 'ROYALTY_PAYMENTS');

  const royaltyPriority = heuristicPriority(
    "I haven't received any royalty for 6 months and the payout is still pending.",
    royalty.category,
    { royaltyPending: 8000 },
  );
  assert.ok(['HIGH', 'CRITICAL'].includes(royaltyPriority.priority));

  const bio = heuristicClassify('Can I update my author bio?');
  assert.equal(bio.category, 'GENERAL_INQUIRY');
  const bioPriority = heuristicPriority('Can I update my author bio?', bio.category);
  assert.equal(bioPriority.priority, 'LOW');
});

test('ISBN mismatch is treated as a high-priority metadata issue', () => {
  const result = heuristicClassify(
    'My book is showing a different ISBN on Amazon than what is on the physical copy.',
  );
  assert.equal(result.category, 'ISBN_METADATA');
  const priority = heuristicPriority(
    'My book is showing a different ISBN on Amazon than what is on the physical copy.',
    result.category,
  );
  assert.ok(['HIGH', 'CRITICAL'].includes(priority.priority));
});

test('AI triage parses structured output and records the model', async () => {
  mockCompletion(
    JSON.stringify({
      category: 'DISTRIBUTION_AVAILABILITY',
      priority: 'HIGH',
      confidence: 92,
      priorityReason: 'Live listing unavailable, direct sales impact.',
    }),
  );

  const result = await classifyTicket({
    subject: 'Amazon listing unavailable for Midnight in Mysore',
    description: 'Readers say the paperback page shows Currently Unavailable.',
    book: { isbn: '978-93-0000-01-1', status: 'Published & Live' } as never,
    authorName: 'Test Author',
  });

  assert.equal(result.source, 'AI');
  assert.equal(result.category, 'DISTRIBUTION_AVAILABILITY');
  assert.equal(result.priority, 'HIGH');
  assert.equal(result.confidence, 0.92);
  assert.equal(result.model, 'mock/model');
});

test('invalid AI triage degrades to the rule engine instead of failing', async () => {
  mockCompletion(JSON.stringify({ category: 'NOT_A_CATEGORY', priority: 'URGENT' }));

  const result = await classifyTicket({
    subject: 'Printing looks blurry in my author copies',
    description: 'The images are blurry and the pages are misaligned in the copies I received.',
    book: null,
    authorName: 'Test Author',
  });

  assert.equal(result.source, 'HEURISTIC');
  assert.equal(result.category, 'PRINTING_QUALITY');
  assert.ok(result.confidence > 0 && result.confidence <= 0.99);
});

test('AI draft is returned with token cost and grounded knowledge sections', async () => {
  mockCompletion(
    'Hi Priya,\n\nThank you for flagging the ISBN mismatch. This is a data-integrity issue and I have escalated it to our production metadata team with a 48-hour resolution target.\n\nNext step: we will confirm the corrected ISBN feed and update you on this thread.\n\nWarmly,\nBookLeaf Author Support',
  );

  const result = await generateDraft(
    { ...ticketFixture('ISBN mismatch on Amazon'), authorName: 'Priya Sharma' },
    { tone: 'EMPATHETIC', includeHistory: true },
  );

  assert.equal(result.source, 'AI');
  assert.ok(result.body.includes('48-hour'));
  assert.ok(result.promptTokens > 0);
  assert.ok(result.estimatedCostUsd > 0);
  assert.ok(result.sections.length > 0);
});

test('AI draft falls back to a grounded template when Groq fails', async () => {
  global.fetch = (async () =>
    new Response(JSON.stringify({ error: { message: 'upstream exploded' } }), {
      status: 500,
    })) as typeof fetch;

  const result = await generateDraft(
    { ...ticketFixture('Royalty payout still pending'), authorName: 'Priya Sharma' },
    { tone: 'EMPATHETIC', includeHistory: false },
  );

  assert.equal(result.source, 'TEMPLATE');
  assert.ok(result.body.includes('Hi Priya,'));
  assert.ok(result.body.includes('₹'));
  assert.ok(result.body.includes('45 days'));
  assert.equal(result.estimatedCostUsd, 0);
});

test('template draft references real ticket data and the BookLeaf policy', () => {
  const body = templateDraft({
    ticket: ticketFixture('Royalty pending').ticket,
    book: ticketFixture('Royalty pending').book,
    authorName: 'Priya Sharma',
    authorTier: 'Standard Free',
  });

  assert.match(body, /Hi Priya,/);
  assert.match(body, /₹3,570/);
  assert.match(body, /45 days/);
  assert.match(body, /bookleaf author support/i);
  assert.doesNotMatch(body, /update them in your dashboard|confirmed payout date/i);
});

test('metadata fallback gives the actual update timeline instead of an ISBN escalation', () => {
  const fixture = ticketFixture('Can I update my author bio?');
  const body = templateDraft({
    ticket: { ...fixture.ticket, category: 'GENERAL_INQUIRY' },
    authorName: 'Priya Sharma',
  });
  assert.match(body, /3–5 business days/);
  assert.match(body, /exact replacement text/);
  assert.doesNotMatch(body, /48 hours|high-priority|in-house printing/);
});

test('draft prompt treats an ongoing thread as a follow-up to the latest author message', () => {
  const fixture = ticketFixture('Royalty pending');
  const [, user] = buildDraftMessages({
    ...fixture,
    authorName: 'Priya Sharma',
    messages: [
      { role: 'ADMIN', body: 'Finance is checking the Q3 settlement.', createdAt: new Date() },
      { role: 'AUTHOR', body: 'Any update? It has been a week.', createdAt: new Date() },
    ],
    sections: [],
    tone: 'EMPATHETIC',
    includeHistory: true,
  });
  assert.match(user.content, /\[BOOKLEAF SUPPORT\] Finance is checking/);
  assert.match(user.content, /\[AUTHOR\] Any update\?/);
  assert.match(user.content, /FOLLOW-UP/);
});

test('draft prompt carries the real author name and AI placeholders are replaced', async () => {
  const fixture = ticketFixture('Royalty pending');
  const [, user] = buildDraftMessages({
    ...fixture,
    authorName: 'Priya Sharma',
    sections: [],
    tone: 'CONCISE',
    includeHistory: false,
    instructions: 'Mention the Q3 settlement date.',
  });
  assert.match(user.content, /GREETING .*: Hi Priya,/);
  assert.match(user.content, /Author full name: Priya Sharma/);
  assert.match(user.content, /ADMIN GUIDANCE .*Mention the Q3 settlement date\./);

  mockCompletion(
    'Hi [first name],\n\nThank you for your patience while finance checks the settlement for your title. We will update you within 48 hours.\n\nWarmly,\nBookLeaf Author Support',
  );
  const result = await generateDraft(
    { ...fixture, authorName: 'Priya Sharma' },
    { tone: 'CONCISE', includeHistory: false, instructions: 'placeholder-check' },
  );
  assert.match(result.body, /^Hi Priya,/);
  assert.doesNotMatch(result.body, /\[first name\]/i);
});

test('template draft continues an existing conversation instead of restarting it', () => {
  const fixture = ticketFixture('Royalty pending');
  const body = templateDraft({
    ...fixture,
    authorName: 'Priya Sharma',
    messages: [
      { role: 'ADMIN', body: 'Finance is checking the settlement.' },
      { role: 'AUTHOR', body: 'Any update?' },
    ],
  });
  assert.match(body, /Thank you for the update/);
  assert.doesNotMatch(body, /80% of net profit|Thank you for reaching out/);
});

function ticketFixture(subject: string) {
  return {
    ticket: {
      id: 'ticket-test-1',
      publicId: 'TKT-TEST-1',
      subject,
      description: subject,
      priority: 'HIGH' as const,
      category: 'ROYALTY_PAYMENTS' as const,
      status: 'IN_PROGRESS' as const,
      createdAt: new Date('2026-10-01T10:00:00Z'),
      lastMessageAt: new Date('2026-10-01T10:00:00Z'),
    },
    book: {
      id: 'book-test-1',
      authorId: 'author-test-1',
      title: 'Whispers of the Ganges',
      isbn: '978-93-0000-01-1',
      genre: 'Literary Fiction',
      publicationDate: new Date('2026-03-15T00:00:00Z'),
      status: 'Published & Live',
      productionStage: null,
      mrp: 299,
      totalCopiesSold: 342,
      totalRoyaltyEarned: 11970,
      royaltyPaid: 8400,
      royaltyPending: 3570,
      lastRoyaltyPayoutDate: new Date('2025-10-15T00:00:00Z'),
      availableOn: ['Amazon India'],
      printPartner: 'Repro India',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
  };
}
