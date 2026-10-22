import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireAdmin } from '../middleware/auth';
import { buildAdminStats } from '../services/ticketService';
import { serializeAuthor } from '../lib/serialize';
import { validationFailed } from '../lib/errors';
import { z } from 'zod';
import { validate } from '../middleware/validate';

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

adminRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const parse = (value: unknown, label: string) => {
      if (typeof value !== 'string' || value.length === 0) return undefined;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw validationFailed({ [label]: ['Must be a valid ISO date.'] });
      }
      return date;
    };

    const from = parse(req.query.from, 'from');
    const to = parse(req.query.to, 'to');
    if (from && to && from > to) {
      throw validationFailed({ from: ['Must be before or equal to to.'] });
    }
    const stats = await buildAdminStats({ from, to });
    res.json({ data: stats });
  }),
);

adminRouter.get(
  '/team',
  asyncHandler(async (_req, res) => {
    const team = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, name: true, email: true, _count: { select: { assigned: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({
      data: team.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        assignedCount: member._count.assigned,
      })),
    });
  }),
);

adminRouter.get(
  '/authors',
  asyncHandler(async (_req, res) => {
    const authors = await prisma.author.findMany({
      include: { _count: { select: { books: true, tickets: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({
      data: authors.map((author) => ({
        ...serializeAuthor(author),
        bookCount: author._count.books,
        ticketCount: author._count.tickets,
      })),
    });
  }),
);

adminRouter.get(
  '/ai/usage',
  validate(z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }), 'query'),
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit);
    const usage = await prisma.aiUsage.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { ticket: { select: { publicId: true, subject: true } } },
    });

    const totals = usage.reduce(
      (acc, entry) => ({
        promptTokens: acc.promptTokens + entry.promptTokens,
        completionTokens: acc.completionTokens + entry.completionTokens,
        cost: acc.cost + entry.estimatedCostUsd,
      }),
      { promptTokens: 0, completionTokens: 0, cost: 0 },
    );

    res.json({
      data: usage.map((entry) => ({
        id: entry.id,
        operation: entry.operation,
        model: entry.model,
        promptTokens: entry.promptTokens,
        completionTokens: entry.completionTokens,
        latencyMs: entry.latencyMs,
        estimatedCostUsd: entry.estimatedCostUsd,
        success: entry.success,
        fallback: entry.fallback,
        cached: entry.cached,
        createdAt: entry.createdAt,
        ticket: entry.ticket,
      })),
      meta: {
        limit,
        promptTokens: totals.promptTokens,
        completionTokens: totals.completionTokens,
        estimatedCostUsd: Number(totals.cost.toFixed(5)),
      },
    });
  }),
);
