import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { KNOWLEDGE_SECTIONS } from '../services/ai/knowledgeBase';

export const knowledgeRouter = Router();

knowledgeRouter.use(authenticate);

// Authors receive only answers to common support questions, not internal AI context.
knowledgeRouter.get('/answers', (_req, res) => {
  // Publish concise help text; keep operational instructions and full policy context private.
  const answers = [
    {
      id: 'royalty-timing',
      question: 'When is my next royalty payout?',
      answer:
        'Royalties are calculated quarterly and paid within 45 days of the quarter ending. ' +
        'Balances below ₹1,000 roll over to the next quarter. If your payment is overdue, ' +
        'submit a query so support can check your payout.',
    },
    {
      id: 'distribution-availability',
      question: 'My Amazon listing is unavailable',
      answer:
        'An unavailable listing often indicates a stock-sync issue. Submit a query with the ' +
        'affected listing link so support can request a re-sync. This typically takes 24–48 hours.',
    },
  ];
  res.json({ data: answers });
});

knowledgeRouter.get('/', requireAdmin, (_req, res) => {
  res.json({
    data: KNOWLEDGE_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      categories: section.categories,
      content: section.content,
    })),
    meta: { count: KNOWLEDGE_SECTIONS.length },
  });
});
