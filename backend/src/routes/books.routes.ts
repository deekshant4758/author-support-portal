import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate } from '../middleware/auth';
import { forbidden, notFound } from '../lib/errors';
import { serializeBook } from '../lib/serialize';

export const booksRouter = Router();

booksRouter.use(authenticate);

/**
 * Authors always see their own catalogue. Admins can see everything and may
 * narrow to a specific author with ?authorId=AUTH001.
 */
booksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role === 'AUTHOR' && !user.authorId) {
      throw forbidden('This account is not linked to an author profile.');
    }
    const requestedAuthorId = typeof req.query.authorId === 'string' ? req.query.authorId : undefined;

    if (user.role === 'AUTHOR' && requestedAuthorId && requestedAuthorId !== user.authorId) {
      throw forbidden('You can only view your own books.');
    }

    const authorId = user.role === 'AUTHOR' ? user.authorId : (requestedAuthorId ?? undefined);

    const books = await prisma.book.findMany({
      where: authorId ? { authorId } : {},
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
    });

    res.json({
      data: books.map(serializeBook),
      meta: { count: books.length, authorId: authorId ?? null },
    });
  }),
);

booksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!book) throw notFound('That book does not exist.');

    if (req.user!.role === 'AUTHOR' && book.authorId !== req.user!.authorId) {
      throw forbidden('You can only view your own books.');
    }

    res.json({ data: serializeBook(book) });
  }),
);
