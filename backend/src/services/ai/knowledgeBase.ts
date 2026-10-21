import type { TicketCategory } from '../../lib/constants';

export interface KnowledgeSection {
  id: string;
  title: string;
  categories: TicketCategory[];
  keywords: string[];
  /** Kept deliberately compact: only retrieved sections are sent to the LLM. */
  content: string;
}

/**
 * The BookLeaf knowledge base from the brief, split into small, tagged sections.
 *
 * Cost/quality rationale: instead of sending the whole KB on every call (~2.5k
 * tokens), we retrieve the 2-3 sections that match the ticket's category and
 * keywords (~500-800 tokens). The tone rules are a short static block that is
 * always included because they shape every reply.
 */
export const KNOWLEDGE_SECTIONS: KnowledgeSection[] = [
  {
    id: 'company-overview',
    title: 'Company Overview',
    categories: [
      'GENERAL_INQUIRY',
      'ROYALTY_PAYMENTS',
      'ISBN_METADATA',
      'PRINTING_QUALITY',
      'DISTRIBUTION_AVAILABILITY',
      'BOOK_STATUS_PRODUCTION',
    ],
    keywords: ['bookleaf', 'publishing', 'package', 'imprint', 'company', 'service'],
    content:
      'BookLeaf Publishing is a self-publishing company operating in India and the US. ' +
      'Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium paid package with marketing and distribution add-ons). ' +
      'BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management. ' +
      'The in-house printing facility and warehouse are in Delhi; print partners include Repro India and Epitome Books.',
  },
  {
    id: 'royalty-policy',
    title: 'Royalty Policy & Net Profit Calculation',
    categories: ['ROYALTY_PAYMENTS'],
    keywords: [
      'royalty',
      'royalties',
      'payment',
      'payout',
      'net profit',
      '80/20',
      'commission',
      'sales',
      'earning',
      'low',
      'deduction',
      'statement',
    ],
    content:
      'BookLeaf uses an 80/20 royalty split: 80% of net profit per book goes to the author, 20% to BookLeaf. ' +
      'Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges. ' +
      'Royalties are calculated quarterly and paid within 45 days of the quarter ending. ' +
      'Minimum payout threshold is INR 1,000; below that the balance rolls over to the next quarter. ' +
      'Payouts are made by bank transfer to the account linked in the author dashboard. ' +
      'Authors can view a detailed per-platform royalty breakdown in their dashboard.',
  },
  {
    id: 'royalty-timing',
    title: 'Royalty Reconciliation & Payout Timeline',
    categories: ['ROYALTY_PAYMENTS'],
    keywords: [
      'not received',
      'haven t received',
      'haven\'t received',
      'delay',
      'delayed',
      'months',
      'quarter',
      'q1',
      'q2',
      'q3',
      'q4',
      'pending',
      'bank',
      'neft',
      'rtgs',
      'overdue',
      'missing',
    ],
    content:
      'Marketplace sales are reconciled in billing cycles, so the last days of a month may land in the next cycle. ' +
      'Quarterly statements are generated after the quarter closes and payouts are released within 45 days. ' +
      'If the INR 1,000 threshold is not met, the amount rolls into the next cycle. ' +
      'If a payout is genuinely overdue, the author support team escalates to Finance with a 48-hour resolution commitment. ' +
      'The author should confirm their bank account is linked and up to date in the dashboard.',
  },
  {
    id: 'isbn-policy',
    title: 'ISBN Policy',
    categories: ['ISBN_METADATA'],
    keywords: [
      'isbn',
      'barcode',
      'duplicate',
      'wrong book',
      'imprint',
      'metadata',
      'listing',
      'amazon page',
      'title',
      'author name',
      'description',
      'cover',
    ],
    content:
      'Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf. ' +
      'ISBNs are registered under the BookLeaf publisher imprint. Authors who want an ISBN under their own imprint must obtain it independently. ' +
      'An ISBN error (duplicate, wrong book linked, mismatch between physical copy and marketplace listing) is a high-priority issue escalated to the production team with a 48-hour resolution target. ' +
      'Metadata updates (description, author bio, categories) can be submitted through the dashboard or by email and typically reflect on platforms within 3-5 business days.',
  },
  {
    id: 'printing-quality',
    title: 'Printing & Quality',
    categories: ['PRINTING_QUALITY'],
    keywords: [
      'print',
      'printing',
      'quality',
      'misprint',
      'blurry',
      'blurred',
      'binding',
      'bent',
      'spine',
      'color',
      'colour',
      'pages',
      'misaligned',
      'defect',
      'damaged',
      'author copies',
      'reprint',
    ],
    content:
      'In-house printing handles most orders; overflow or specific format requirements go to Repro India or Epitome Books. ' +
      'Standard print turnaround is 5-7 business days from order confirmation, including reprints. ' +
      'For quality issues (misprints, binding defects, colour inconsistency), BookLeaf arranges a free reprint after verification. ' +
      'The author should share clear photos of the defective copy and the order/consignment details. ' +
      'The support team owns the verification and reprint request; the author does not pay for a verified defect.',
  },
  {
    id: 'distribution-availability',
    title: 'Distribution & Availability',
    categories: ['DISTRIBUTION_AVAILABILITY'],
    keywords: [
      'amazon',
      'flipkart',
      'amazon us',
      'amazon uk',
      'unavailable',
      'currently unavailable',
      'out of stock',
      'listing',
      'distribution',
      'channel',
      'stock',
      'buy box',
      'kindle',
      'ingram',
      'store',
    ],
    content:
      'Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store. ' +
      'New listings typically go live within 7-10 business days after publication is complete. ' +
      'If a book shows as unavailable on a platform it usually indicates a stock-sync issue. ' +
      'BookLeaf can trigger a re-sync with the distribution team; the listing typically returns within 24-48 hours. ' +
      'The team tracks the sync reference and follows up if the platform feed has not recovered in that window.',
  },
  {
    id: 'production-stages',
    title: 'Production Stages & Timelines',
    categories: ['BOOK_STATUS_PRODUCTION'],
    keywords: [
      'status',
      'production',
      'stage',
      'manuscript',
      'editing',
      'cover design',
      'typesetting',
      'proofreading',
      'proof',
      'isbn assignment',
      'printing',
      'distribution setup',
      'delay',
      'when will',
      'how long',
      'timeline',
      'in production',
    ],
    content:
      'Production stages: Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live. ' +
      'Authors are updated by email at each stage. Delays typically occur at Cover Design (waiting for author approval) and Proofreading (revision rounds). ' +
      'If a book is delayed, the support team checks the live production record and gives a specific revised date rather than a vague assurance. ' +
      'The team never blames the author, even when a revision is pending on the author side; it frames the next step collaboratively.',
  },
  {
    id: 'communication-tone',
    title: 'Communication Tone Guidelines',
    categories: [
      'GENERAL_INQUIRY',
      'ROYALTY_PAYMENTS',
      'ISBN_METADATA',
      'PRINTING_QUALITY',
      'DISTRIBUTION_AVAILABILITY',
      'BOOK_STATUS_PRODUCTION',
    ],
    keywords: ['tone', 'reply', 'response', 'communication', 'representative'],
    content:
      'Always empathetic and professional. Authors are partners, not customers to be managed. ' +
      'Acknowledge the concern before jumping to solutions. ' +
      'Be specific: use actual numbers, dates and statuses from the ticket context instead of vague reassurance. ' +
      'If something is BookLeaf\'s fault (delayed royalties, ISBN error), own it directly with no corporate deflection. ' +
      'If escalation or investigation is needed, give a clear timeline (for example: "Our team will look into this and get back to you within 48 hours"), never an open-ended promise. ' +
      'Always close with a clear next step for the author and/or the BookLeaf team.',
  },
  {
    id: 'escalation-matrix',
    title: 'Escalation Matrix',
    categories: [
      'ROYALTY_PAYMENTS',
      'ISBN_METADATA',
      'PRINTING_QUALITY',
      'DISTRIBUTION_AVAILABILITY',
      'BOOK_STATUS_PRODUCTION',
    ],
    keywords: ['escalate', 'urgent', 'critical', 'overdue', 'complaint', 'legal', 'manager'],
    content:
      'Royalty payouts overdue beyond the 45-day window: escalate to Finance Operations, 48-hour resolution target. ' +
      'ISBN mismatch or duplicate: escalate to Production (metadata desk) immediately, 48-hour resolution target. ' +
      'Print defects: verify with photos, then raise a free reprint with the print partner, 5-7 business-day turnaround. ' +
      'Distribution outage: trigger a platform re-sync with Distribution Ops, 24-48 hours. ' +
      'Production delay: confirm the live stage with the production editor and provide a revised date.',
  },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string): string[] => {
  const stop = new Set([
    'the', 'and', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'for', 'my', 'me', 'i',
    'it', 'on', 'in', 'at', 'this', 'that', 'with', 'have', 'has', 'not', 'but', 'book', 'please',
    'can', 'you', 'we', 'our', 'your', 'about', 'from', 'been', 'still', 'any', 'all',
  ]);
  return normalize(value)
    .split(' ')
    .filter((word) => word.length > 2 && !stop.has(word));
};

export interface RetrievedSections {
  sections: KnowledgeSection[];
  /** Compact, human-readable list used in the admin UI ("Matched KB: ..."). */
  references: string[];
}

/**
 * Lightweight lexical retrieval. Good enough for ~10 curated sections, is free,
 * is deterministic, and keeps prompt tokens low. In a larger KB this would be
 * replaced by embeddings/pgvector behind the same function signature.
 */
export const retrieveKnowledge = (
  text: string,
  category: TicketCategory,
  limit = 3,
): RetrievedSections => {
  const tokens = new Set(tokenize(text));
  const normalized = normalize(text);

  const scored = KNOWLEDGE_SECTIONS.map((section) => {
    let score = 0;
    if (section.categories.includes(category)) score += 4;
    if (section.id === 'communication-tone') score += 100; // always included
    for (const keyword of section.keywords) {
      if (normalized.includes(normalize(keyword))) score += 2;
    }
    for (const keywordToken of tokenize(section.keywords.join(' '))) {
      if (tokens.has(keywordToken)) score += 0.5;
    }
    return { section, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    sections: scored.map((entry) => entry.section),
    references: scored.map((entry) => `${entry.section.id} "${entry.section.title}"`),
  };
};

export const getSection = (id: string) => KNOWLEDGE_SECTIONS.find((section) => section.id === id);

/** Hard cap so a verbose KB can never blow up prompt cost. */
export const renderKnowledge = (sections: KnowledgeSection[], maxChars = 2400): string => {
  const blocks = sections.map((section) => `[${section.title}]\n${section.content}`);
  const joined = blocks.join('\n\n');
  return joined.length > maxChars ? `${joined.slice(0, maxChars)}...` : joined;
};
