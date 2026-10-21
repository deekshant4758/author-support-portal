import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { KNOWLEDGE_SECTIONS } from '../services/ai/knowledgeBase';

export const knowledgeRouter = Router();

knowledgeRouter.get('/', authenticate, (_req, res) => {
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
