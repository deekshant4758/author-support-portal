import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { prisma } from '../lib/prisma';
import { badRequest, forbidden, notFound } from '../lib/errors';
import {
  PRIORITY_WEIGHT,
  SLA_HOURS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '../lib/constants';
import { serializeBook, serializeTicket } from '../lib/serialize';
import type { TicketQueryInput } from '../validation/schemas';

export const ticketInclude = {
  book: true,
  author: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  _count: { select: { messages: { where: { isInternal: false } } } },
} satisfies Prisma.TicketInclude;

export const ticketDetailInclude = (isAdmin: boolean) =>
  ({
    book: true,
    author: true,
    assignedTo: { select: { id: true, name: true, email: true } },
    messages: {
      where: isAdmin ? {} : { isInternal: false },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    },
    events: {
      where: isAdmin ? {} : { type: { in: ['CREATED', 'STATUS_CHANGED', 'PUBLIC_REPLY', 'CLOSED', 'REOPENED'] } },
      orderBy: { createdAt: 'asc' },
    },
    _count: { select: { messages: { where: { isInternal: false } } } },
  }) satisfies Prisma.TicketInclude;

// Generate references independently so simultaneous submissions cannot share a counter value.
export const generatePublicId = (): string => `TKT-${randomBytes(8).toString('hex').toUpperCase()}`;

const splitFilter = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.toUpperCase() !== 'ALL');

const parseEnumList = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  label: string,
): T[] => {
  const values = splitFilter(raw).map((value) => value.toUpperCase());
  const invalid = values.filter((value) => !allowed.includes(value as T));
  if (invalid.length > 0) {
    throw badRequest(`Unknown ${label}: ${invalid.join(', ')}.`, { allowed });
  }
  return values as T[];
};

const parseDate = (value: string | undefined, label: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${label} must be a valid ISO date.`);
  return date;
};

export const buildTicketWhere = (req: Request, query: TicketQueryInput): Prisma.TicketWhereInput => {
  const user = req.user!;
  const where: Prisma.TicketWhereInput = {};

  if (user.role === 'AUTHOR') {
    if (!user.authorId) throw forbidden('This account is not linked to an author profile.');
    where.authorId = user.authorId;
  }

  const statuses = parseEnumList(query.status, TICKET_STATUSES, 'status');
  const categories = parseEnumList(query.category, TICKET_CATEGORIES, 'category');
  const priorities = parseEnumList(query.priority, TICKET_PRIORITIES, 'priority');

  if (statuses.length > 0) where.status = { in: statuses };
  if (categories.length > 0) where.category = { in: categories };
  if (priorities.length > 0) where.priority = { in: priorities };

  const from = parseDate(query.dateFrom, 'dateFrom');
  const to = parseDate(query.dateTo, 'dateTo');
  if (from && to && from > to) throw badRequest('dateFrom must be before dateTo.');
  if (from || to) {
    where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  }

  if (query.assignee && user.role === 'ADMIN') {
    if (query.assignee === 'me') where.assignedToId = user.id;
    else if (query.assignee === 'unassigned') where.assignedToId = null;
    else where.assignedToId = query.assignee;
  }

  if (query.search) {
    // Postgres `contains` is case-sensitive unless the mode is set explicitly.
    const match = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [
      { subject: match },
      { description: match },
      { publicId: match },
      { author: { name: match } },
      { book: { title: match } },
    ];
  }

  return where;
};

export const listTickets = async (req: Request, query: TicketQueryInput) => {
  const where = buildTicketWhere(req, query);

  // Urgency needs priority-aware ordering, which Prisma cannot express on a
  // string column. The result set for a support queue is small, so we sort in
  // memory after filtering and then paginate.
  if (query.sort === 'urgency') {
    const all = await prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: 'asc' },
    });

    const sorted = all.sort((a, b) => {
      const resolvedA = a.status === 'RESOLVED' || a.status === 'CLOSED' ? 1 : 0;
      const resolvedB = b.status === 'RESOLVED' || b.status === 'CLOSED' ? 1 : 0;
      if (resolvedA !== resolvedB) return resolvedA - resolvedB;
      const weightDiff =
        (PRIORITY_WEIGHT[b.priority as TicketPriority] ?? 0) -
        (PRIORITY_WEIGHT[a.priority as TicketPriority] ?? 0);
      if (weightDiff !== 0) return weightDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const start = (query.page - 1) * query.pageSize;
    return {
      items: sorted.slice(start, start + query.pageSize).map(serializeTicket),
      total: sorted.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  const orderBy: Prisma.TicketOrderByWithRelationInput =
    query.sort === 'oldest'
      ? { createdAt: 'asc' }
      : query.sort === 'updated'
        ? { lastMessageAt: 'desc' }
        : { createdAt: 'desc' };
  // Tie-break on id so pagination is stable when tickets share a timestamp.
  const orderByWithTieBreak: Prisma.TicketOrderByWithRelationInput[] = [orderBy, { id: 'desc' }];

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: orderByWithTieBreak,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    items: items.map(serializeTicket),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
};

export const getTicketForUser = async (
  request: Request,
  id: string,
  options: { includeInternal: boolean },
) => {
  const isAdmin = request.user!.role === 'ADMIN';
  const ticket = await prisma.ticket.findFirst({
    where: { OR: [{ id }, { publicId: id }] },
    include: ticketDetailInclude(options.includeInternal && isAdmin),
  });

  if (!ticket) throw notFound('That support ticket does not exist.');
  if (!isAdmin) {
    if (!request.user!.authorId || ticket.authorId !== request.user!.authorId) {
      throw forbidden('You can only view your own support tickets.');
    }
    // Internal notes are filtered in the query, and this guard protects against
    // future include changes.
    ticket.messages = ticket.messages.filter((message) => !message.isInternal);
  }

  return ticket;
};

export const countBy = <T extends string>(values: T[], counts: Record<string, number>) =>
  Object.fromEntries(values.map((value) => [value, counts[value] ?? 0])) as Record<T, number>;

export const authorSummary = async (authorId: string) => {
  const [author, books, tickets] = await Promise.all([
    prisma.author.findUnique({ where: { id: authorId } }),
    prisma.book.findMany({ where: { authorId }, orderBy: { title: 'asc' } }),
    prisma.ticket.findMany({
      where: { authorId },
      include: ticketInclude,
      orderBy: { lastMessageAt: 'desc' },
      take: 5,
    }),
  ]);

  if (!author) throw notFound('Author profile not found.');

  const openStatuses = ['OPEN', 'IN_PROGRESS'];
  const openTickets = await prisma.ticket.count({
    where: { authorId, status: { in: openStatuses } },
  });

  const totals = books.reduce(
    (acc, book) => ({
      earned: acc.earned + book.totalRoyaltyEarned,
      paid: acc.paid + book.royaltyPaid,
      pending: acc.pending + book.royaltyPending,
      copies: acc.copies + book.totalCopiesSold,
    }),
    { earned: 0, paid: 0, pending: 0, copies: 0 },
  );

  return {
    author: {
      id: author.id,
      name: author.name,
      email: author.email,
      city: author.city,
      phone: author.phone,
      joinedDate: author.joinedDate,
      tier: author.tier,
      bankName: author.bankName,
      bankLast4: author.bankLast4,
    },
    metrics: {
      bookCount: books.length,
      publishedCount: books.filter((book) => book.status === 'Published & Live').length,
      productionCount: books.filter((book) => book.status !== 'Published & Live').length,
      openTickets,
      totalRoyaltyEarned: totals.earned,
      royaltyPaid: totals.paid,
      royaltyPending: totals.pending,
      totalCopiesSold: totals.copies,
    },
    books: books.map(serializeBook),
    recentTickets: tickets.map(serializeTicket),
  };
};

export interface StatsFilters {
  from?: Date;
  to?: Date;
}

export const buildAdminStats = async (filters: StatsFilters = {}) => {
  const dateWhere =
    filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {};

  const [
    total,
    open,
    inProgress,
    resolved,
    closed,
    criticalOpen,
    highOpen,
    unassignedOpen,
    resolvedToday,
    allForCategory,
    allForPriority,
    respondedTickets,
    overdueCount,
    aiUsage,
    aiClassified,
  ] = await Promise.all([
    prisma.ticket.count({ where: dateWhere }),
    prisma.ticket.count({ where: { ...dateWhere, status: 'OPEN' } }),
    prisma.ticket.count({ where: { ...dateWhere, status: 'IN_PROGRESS' } }),
    prisma.ticket.count({ where: { ...dateWhere, status: 'RESOLVED' } }),
    prisma.ticket.count({ where: { ...dateWhere, status: 'CLOSED' } }),
    prisma.ticket.count({
      where: { ...dateWhere, status: { in: ['OPEN', 'IN_PROGRESS'] }, priority: 'CRITICAL' },
    }),
    prisma.ticket.count({
      where: { ...dateWhere, status: { in: ['OPEN', 'IN_PROGRESS'] }, priority: 'HIGH' },
    }),
    prisma.ticket.count({
      where: { ...dateWhere, status: { in: ['OPEN', 'IN_PROGRESS'] }, assignedToId: null },
    }),
    prisma.ticket.count({
      where: {
        ...dateWhere,
        status: { in: ['RESOLVED', 'CLOSED'] },
        OR: [
          { resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
          { closedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        ],
      },
    }),
    prisma.ticket.groupBy({ by: ['category'], where: dateWhere, _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['priority'], where: dateWhere, _count: { _all: true } }),
    prisma.ticket.findMany({
      where: { ...dateWhere, firstResponseAt: { not: null } },
      select: { createdAt: true, firstResponseAt: true },
      take: 500,
    }),
    prisma.ticket.count({
      where: {
        ...dateWhere,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        OR: Object.entries(SLA_HOURS).map(([priority, hours]) => ({
          priority,
          createdAt: { lt: new Date(Date.now() - hours * 60 * 60 * 1000) },
        })),
      },
    }),
    prisma.aiUsage.findMany({ where: dateWhere, orderBy: { createdAt: 'desc' }, take: 1000 }),
    prisma.ticket.count({ where: { ...dateWhere, categorySource: 'AI' } }),
  ]);

  const categoryCounts = Object.fromEntries(allForCategory.map((row) => [row.category, row._count._all]));
  const priorityCounts = Object.fromEntries(allForPriority.map((row) => [row.priority, row._count._all]));

  const avgFirstResponseMinutes =
    respondedTickets.length === 0
      ? 0
      : Math.round(
          respondedTickets.reduce(
            (sum, ticket) => sum + (ticket.firstResponseAt!.getTime() - ticket.createdAt.getTime()),
            0,
          ) /
            respondedTickets.length /
            60000,
        );

  const totalCount = total || 1;
  const aiCalls = aiUsage.length;
  const fallbacks = aiUsage.filter((entry) => entry.fallback).length;
  const cacheHits = aiUsage.filter((entry) => entry.cached).length;
  const tokens = aiUsage.reduce((sum, entry) => sum + entry.promptTokens + entry.completionTokens, 0);
  const cost = aiUsage.reduce((sum, entry) => sum + entry.estimatedCostUsd, 0);
  const avgLatency =
    aiCalls === 0
      ? 0
      : Math.round(
          aiUsage.filter((entry) => entry.latencyMs > 0).reduce((sum, entry) => sum + entry.latencyMs, 0) /
            Math.max(1, aiUsage.filter((entry) => entry.latencyMs > 0).length),
        );

  return {
    totals: {
      total,
      open,
      inProgress,
      resolved,
      closed,
      unresolved: open + inProgress,
      criticalOpen,
      highOpen,
      unassignedOpen,
      resolvedToday,
      overdueCount,
    },
    percentages: {
      autoClassified: Number(((aiClassified / totalCount) * 100).toFixed(1)),
      resolvedRate: Number((((resolved + closed) / totalCount) * 100).toFixed(1)),
      fallbackRate: aiCalls === 0 ? 0 : Number(((fallbacks / aiCalls) * 100).toFixed(1)),
    },
    avgFirstResponseMinutes,
    categories: countBy([...TICKET_CATEGORIES], categoryCounts),
    priorities: countBy([...TICKET_PRIORITIES], priorityCounts),
    statuses: { OPEN: open, IN_PROGRESS: inProgress, RESOLVED: resolved, CLOSED: closed } as Record<
      TicketStatus,
      number
    >,
    ai: {
      calls: aiCalls,
      fallbacks,
      cacheHits,
      tokens,
      estimatedCostUsd: Number(cost.toFixed(5)),
      avgLatencyMs: avgLatency,
      byOperation: {
        CLASSIFY: aiUsage.filter((entry) => entry.operation === 'CLASSIFY').length,
        DRAFT: aiUsage.filter((entry) => entry.operation === 'DRAFT').length,
      },
      recent: aiUsage.slice(0, 8).map((entry) => ({
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
      })),
    },
  };
};
