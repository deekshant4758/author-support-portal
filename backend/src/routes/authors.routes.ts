import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireAuthor } from '../middleware/auth';
import { authorSummary } from '../services/ticketService';
import { forbidden } from '../lib/errors';

export const authorsRouter = Router();

authorsRouter.get(
  '/me',
  authenticate,
  requireAuthor,
  asyncHandler(async (req, res) => {
    if (!req.user!.authorId) {
      throw forbidden('This account is not linked to an author profile.');
    }
    const summary = await authorSummary(req.user!.authorId);
    res.json({ data: summary });
  }),
);
