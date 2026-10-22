import type { Book, Message, Ticket } from '@prisma/client';
import type { TicketCategory, TicketPriority } from '../../lib/constants';
import { CATEGORY_LABELS } from '../../lib/constants';

export interface HeuristicCategoryResult {
  category: TicketCategory;
  confidence: number;
  scores: Record<TicketCategory, number>;
}

/**
 * Deterministic rules used when the LLM is unavailable. This is intentionally
 * more than a naive keyword map: it weights phrases, respects book state and
 * always produces a usable category/priority so ticket creation never fails.
 */
const CATEGORY_RULES: Array<{ category: TicketCategory; patterns: Array<[RegExp, number]> }> = [
  {
    category: 'ROYALTY_PAYMENTS',
    patterns: [
      [/\broyalt(y|ies)\b/i, 5],
      [/\b(payout|payment|paid|remittance|transfer|bank)\b/i, 3],
      [/\b(net profit|80\s*\/\s*20|commission|deduction)\b/i, 3],
      [/\b(statement|ledger|reconcil|settlement)\b/i, 2],
      [/\b(earn|earning|income|money|amount|invoice|cheque)\b/i, 2],
      [/\b(q[1-4]|quarter|quarterly)\b/i, 2],
      [/\b(sold|copies)\b/i, 1],
    ],
  },
  {
    category: 'ISBN_METADATA',
    patterns: [
      [/\bisbn\b/i, 6],
      [/\b(barcode|imprint|metadata)\b/i, 4],
      [/\b(wrong|different|duplicate|mismatch)\b.*\b(isbn|title|author|book)\b/i, 4],
      [/\b(amazon|flipkart)\b.*\b(title|author|description|listing|page)\b/i, 2],
      [/\b(update|change|edit)\b.*\b(description|metadata|category|title|listing)\b/i, 3],
    ],
  },
  {
    category: 'PRINTING_QUALITY',
    patterns: [
      [/\b(print|printing|misprint)\b/i, 4],
      [/\b(blurry|blurred|misalign|faded|smudg|colour|color)\b/i, 3],
      [/\b(binding|spine|bent|damaged|defect|torn|quality)\b/i, 4],
      [/\b(author copies|reprint|pages? (are|were))\b/i, 3],
      [/\b(paper|cover)\b.*\b(quality|damaged|defect|bent)\b/i, 2],
    ],
  },
  {
    category: 'DISTRIBUTION_AVAILABILITY',
    patterns: [
      [/\b(currently unavailable|out of stock|unavailable|not available)\b/i, 6],
      [/\b(amazon us|amazon uk|amazon india|flipkart|bookleaf store|kindle|ingram)\b/i, 3],
      [/\b(stock|sync|distribut|listing|buy box|availability)\b/i, 3],
      [/\b(can't find|cannot find|not showing|missing|delisted)\b/i, 3],
    ],
  },
  {
    category: 'BOOK_STATUS_PRODUCTION',
    patterns: [
      [/\b(typesetting|proofread|proof|cover design|editing|manuscript|production stage)\b/i, 5],
      [/\b(in production|production status|status of my book|publishing stage)\b/i, 4],
      [/\b(delay|delayed|how long|when will|timeline|eta|still in)\b/i, 2],
      [/\b(pre-?order|release date|publication date|launch)\b/i, 2],
    ],
  },
  {
    category: 'GENERAL_INQUIRY',
    patterns: [
      [/\b(author bio|bio|profile|account|password|login|dashboard)\b/i, 4],
      [/\b(package|pricing|plan|bestseller breakthrough|standard free)\b/i, 3],
      [/\b(thank|great|appreciate|help|question|how do i)\b/i, 1],
    ],
  },
];

export const heuristicClassify = (text: string): HeuristicCategoryResult => {
  const scores = Object.fromEntries(CATEGORY_RULES.map((rule) => [rule.category, 0])) as Record<
    TicketCategory,
    number
  >;

  for (const rule of CATEGORY_RULES) {
    for (const [pattern, weight] of rule.patterns) {
      if (pattern.test(text)) scores[rule.category] += weight;
    }
  }

  const ranked = (Object.entries(scores) as Array<[TicketCategory, number]>).sort((a, b) => b[1] - a[1]);
  const [topCategory, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;

  if (topScore === 0) {
    return { category: 'GENERAL_INQUIRY', confidence: 0.45, scores };
  }

  // Confidence reflects both absolute signal and separation from runner-up.
  const separation = topScore === 0 ? 0 : (topScore - secondScore) / topScore;
  const confidence = Math.min(0.86, 0.48 + topScore * 0.03 + separation * 0.12);

  return { category: topCategory, confidence: Number(confidence.toFixed(2)), scores };
};

export interface HeuristicPriorityResult {
  priority: TicketPriority;
  reason: string;
}

export const heuristicPriority = (
  text: string,
  category: TicketCategory,
  book?: { status?: string | null; royaltyPending?: number | null } | null,
): HeuristicPriorityResult => {
  const lower = text.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  const financial = /(royalt|payout|payment|paid|money|amount|earning|bank|₹|rs\.?|inr)/.test(lower);
  const overdue = /(month|year|quarter|since|haven'?t|not received|still waiting|overdue)/.test(lower);
  const explicitUrgent = /(urgent|immediately|asap|critical|escalat|legal|complaint)/.test(lower);
  const isbnFault = /(duplicate|wrong|different|mismatch)/.test(lower) && /isbn|barcode/.test(lower);
  const unavailable = /(unavailable|not available|out of stock|delisted|missing)/.test(lower);
  const qualityDefect = /(misprint|blurry|misalign|binding|bent|damaged|defect)/.test(lower);
  const longDelay = /(weeks?|months?)/.test(lower);
  const lowEffort = /(bio|profile|thank|question|how do i|can i update)/.test(lower);

  if (financial && overdue) {
    score += 5;
    reasons.push('financial delay signal');
  }
  if (/(6|six|5|five|4|four|3|three)\s*months?/.test(lower) && financial) {
    score += 4;
    reasons.push('multi-month royalty delay');
  }
  if (explicitUrgent) {
    score += 3;
    reasons.push('explicit urgency language');
  }
  if (isbnFault) {
    score += 5;
    reasons.push('ISBN data-integrity issue on a live title');
  }
  if (category === 'ROYALTY_PAYMENTS') score += 2;
  if (category === 'ISBN_METADATA' && isbnFault) score += 1;
  if (category === 'PRINTING_QUALITY' && qualityDefect) score += 2;
  if (category === 'DISTRIBUTION_AVAILABILITY' && unavailable) {
    score += 3;
    reasons.push('live listing unavailable (sales impact)');
  }
  if (category === 'BOOK_STATUS_PRODUCTION' && longDelay) score += 1;
  if (category === 'GENERAL_INQUIRY') score -= 1;
  if (lowEffort && !financial && !isbnFault && !qualityDefect) {
    score -= 2;
    reasons.push('low-impact account/metadata request');
  }
  if (book?.status && /in production/i.test(book.status)) score += 1;
  if ((book?.royaltyPending ?? 0) >= 5000) {
    score += 1;
    reasons.push('high pending royalty balance');
  }

  let priority: TicketPriority = 'MEDIUM';
  if (score >= 10) priority = 'CRITICAL';
  else if (score >= 6) priority = 'HIGH';
  else if (score >= 2) priority = 'MEDIUM';
  else priority = 'LOW';

  // Guardrails that mirror the brief's examples.
  if (category === 'GENERAL_INQUIRY' && priority !== 'HIGH') priority = 'LOW';
  if (category === 'ROYALTY_PAYMENTS' && financial && priority === 'LOW') priority = 'MEDIUM';

  return {
    priority,
    reason:
      reasons.length > 0
        ? `Heuristic triage: ${[...new Set(reasons)].join(', ')}.`
        : 'Heuristic triage: no critical revenue or integrity signals detected.',
  };
};

export interface DraftContext {
  ticket: Pick<Ticket, 'publicId' | 'subject' | 'description' | 'priority' | 'category'>;
  book?: Book | null;
  authorName: string;
  authorTier?: string | null;
  messages?: Pick<Message, 'role' | 'body'>[];
}

const money = (value: number | null | undefined) =>
  value == null ? null : `₹${value.toLocaleString('en-IN')}`;

const bookLine = (book?: Book | null) => {
  if (!book) return 'This is a general / account-level query, not tied to a specific title.';
  const bits = [`Title: ${book.title}`, `ISBN: ${book.isbn}`, `Status: ${book.status}`];
  if (book.mrp != null) bits.push(`MRP ${money(book.mrp)}`);
  if (book.totalCopiesSold > 0) bits.push(`${book.totalCopiesSold} copies sold`);
  if (book.totalRoyaltyEarned > 0) bits.push(`lifetime royalty ${money(book.totalRoyaltyEarned)}`);
  if (book.royaltyPending > 0) bits.push(`pending royalty ${money(book.royaltyPending)}`);
  if (book.lastRoyaltyPayoutDate) bits.push(`last payout ${book.lastRoyaltyPayoutDate}`);
  if (book.printPartner) bits.push(`print partner ${book.printPartner}`);
  return bits.join(' · ');
};

const bookLabel = (book?: Book | null) => (book ? `"${book.title}"` : 'your account');

/**
 * Grounded, policy-accurate draft used when the LLM cannot be reached. It only
 * references data from the database, and mirrors the tone guidelines.
 */
export const templateDraft = (context: DraftContext): string => {
  const { ticket, book } = context;
  const firstName = context.authorName.split(' ')[0] || 'there';
  const label = bookLabel(book);
  const category = ticket.category as TicketCategory;
  const facts = book ? bookLine(book) : null;
  const record = facts
    ? `Current record: ${facts}.`
    : 'This is an account-level query, so no single title is linked.';
  const metadataUpdate =
    /\b(update|change|edit)\b/i.test(`${ticket.subject} ${ticket.description}`) &&
    /\b(bio|description|categor(?:y|ies)|metadata)\b/i.test(`${ticket.subject} ${ticket.description}`) &&
    !/\b(wrong|duplicate|mismatch|different isbn)\b/i.test(`${ticket.subject} ${ticket.description}`);
  const metadataReply = `You can request a change to the book description, author bio or categories through this support ticket. Please reply with the exact replacement text and the listing link. Metadata changes typically appear on platforms within 3–5 business days after submission. Our team will confirm when the update has been submitted.`;

  const openings: Record<TicketCategory, string> = {
    ROYALTY_PAYMENTS: `Thank you for reaching out about the royalty position for ${label}. I understand how important it is to have clarity on earnings you have worked hard for, and I am sorry for the uncertainty this has caused.`,
    ISBN_METADATA: `Thank you for flagging the metadata concern for ${label}. A mismatch between our records and a live listing is something we treat seriously, and I am sorry you had to chase this.`,
    PRINTING_QUALITY: `I am sorry to hear about the print quality issue with ${label}. That is not the standard we want an author to receive, and I understand your frustration.`,
    DISTRIBUTION_AVAILABILITY: `Thank you for letting us know that ${label} is showing as unavailable. I understand the impact a missing listing has on sales, and we will treat this as a priority.`,
    BOOK_STATUS_PRODUCTION: `Thank you for checking in on the production status of ${label}. I understand that waiting without a firm date is frustrating, so I have pulled the current record for you.`,
    GENERAL_INQUIRY: `Thank you for getting in touch about ${label}. I am happy to help and want to give you a clear answer rather than a generic one.`,
  };

  const bodies: Record<TicketCategory, string> = {
    ROYALTY_PAYMENTS: `${
      facts
        ? `Here is what I can confirm from your account: ${facts}.`
        : 'No individual book is linked to this request; our finance team will need to verify your account totals.'
    } Authors receive 80% of net profit: MRP minus printing cost, platform commission and shipping. Royalties are calculated quarterly and released within 45 days of the quarter ending, with a minimum payout threshold of ₹1,000. If a balance is below the threshold it rolls into the next cycle.\n\nI will ask our finance team to check the settlement and provide an update within 48 hours. If your bank details have changed, please tell support so we can arrange verification. Please do not send full bank details in this chat.`,
    ISBN_METADATA: metadataUpdate
      ? metadataReply
      : `${record} Every BookLeaf title is assigned a unique ISBN under the BookLeaf imprint, and a duplicate or mismatched ISBN on a live listing is treated as a high-priority data issue.\n\nI will escalate this to our production metadata team with a 48-hour resolution target. Please reply with the affected listing link and the ISBN printed on your copy so the team can verify the discrepancy.`,
    PRINTING_QUALITY: `${record} For verified print defects, BookLeaf arranges a free reprint — you should not pay for a defective copy. Standard reprint turnaround is 5–7 business days after verification.\n\nCould you please reply with clear photos of the affected copies (cover, spine, and the misprinted pages) plus the delivery details? Once we have those, I will raise the reprint with our print team and confirm the dispatch timeline. You will not be asked to cover the cost of a verified defect.`,
    DISTRIBUTION_AVAILABILITY: `${record} A listing showing as unavailable is usually a stock-sync issue between our feed and the platform rather than a problem with the book itself.\n\nI am triggering a re-sync with our distribution team now. In most cases the listing is live again within 24–48 hours. I will keep this ticket open and confirm once the feed shows the title as available; if it is still down after 48 hours, we will escalate it to the platform account manager.`,
    BOOK_STATUS_PRODUCTION: `${book ? `The current status recorded for "${book.title}" is ${book.status}.` : 'Please confirm the book title so we can check its production status.'}\n\nA confirmed completion date is not available in this record. I will ask our production editor to check the next milestone and update this ticket within 48 hours. If we need an approval or a revision from you, we will explain the specific next step.`,
    GENERAL_INQUIRY: metadataUpdate
      ? metadataReply
      : `I have received your request about ${label}. I will review the details with the relevant team and update this ticket within 48 hours. If there is a specific change you need, please reply with the details so we can confirm what is possible.`,
  };

  return [
    `Hi ${firstName},`,
    '',
    openings[category],
    '',
    bodies[category],
    'You can reply directly on this ticket to continue the conversation.',
    '',
    'Warmly,',
    'BookLeaf Author Support',
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const categoryLabel = (category: string) => CATEGORY_LABELS[category as TicketCategory] ?? category;
