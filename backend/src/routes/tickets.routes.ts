import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Prisma, TicketEvent } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireAdmin, requireAuthor } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  assignSchema,
  createMessageSchema,
  createTicketSchema,
  draftSchema,
  idParamSchema,
  ticketQuerySchema,
  updateTicketSchema,
  type CreateMessageInput,
  type CreateTicketInput,
  type DraftInput,
  type TicketQueryInput,
  type UpdateTicketInput,
} from '../validation/schemas';
import { generatePublicId, getTicketForUser, listTickets, ticketInclude } from '../services/ticketService';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { serializeBook, serializeEvent, serializeMessage, serializeTicket } from '../lib/serialize';
import { classifyTicket } from '../services/ai/classifier';
import { generateDraft, type DraftTone } from '../services/ai/drafter';
import { publishTicketEvent } from '../services/eventBus';
import { CATEGORY_LABELS, type TicketCategory } from '../lib/constants';

export const ticketsRouter = Router();

ticketsRouter.use(authenticate);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many AI requests. Please pause for a minute and try again.',
    },
  },
});

const publicMessageInclude = {
  include: { user: { select: { id: true, name: true, role: true } } },
} satisfies Prisma.MessageDefaultArgs;

/** Create a ticket. AI runs before insert but can never block creation. */
ticketsRouter.post(
  '/',
  requireAuthor,
  validate(createTicketSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.authorId) throw forbidden('This account is not linked to an author profile.');

    const input = req.body as CreateTicketInput;
    const author = await prisma.author.findUnique({ where: { id: user.authorId } });
    if (!author) throw notFound('Author profile not found.');

    let book = null;
    if (input.bookId) {
      book = await prisma.book.findUnique({ where: { id: input.bookId } });
      if (!book) throw notFound('The selected book does not exist.');
      if (book.authorId !== author.id) {
        throw forbidden('You can only raise queries about your own books.');
      }
    }

    const classification = await classifyTicket(
      {
        subject: input.subject,
        description: input.description,
        book,
        authorTier: author.tier,
        hasAttachment: Boolean(input.attachmentName),
      },
      undefined,
    );

    const manualCategory =
      input.category && input.category !== 'AUTO' ? (input.category as TicketCategory) : null;

    const publicId = generatePublicId();
    const aiLabel = classification.source === 'AI' ? 'AI' : 'Rule engine';

    const ticket = await prisma.ticket.create({
      data: {
        publicId,
        authorId: author.id,
        bookId: book?.id ?? null,
        subject: input.subject,
        description: input.description,
        category: manualCategory ?? classification.category,
        categorySource: manualCategory ? 'AUTHOR' : classification.source,
        aiCategory: classification.category,
        aiConfidence: classification.confidence,
        priority: classification.priority,
        prioritySource: classification.source,
        aiPriority: classification.priority,
        aiPriorityReason: classification.priorityReason,
        status: 'OPEN',
        attachmentName: input.attachmentName ?? null,
        attachmentSize: input.attachmentSize ?? null,
        messages: {
          create: [
            {
              userId: user.id,
              authorName: author.name,
              role: 'AUTHOR',
              body: input.description,
              isInternal: false,
            },
            {
              authorName: 'BookLeaf Support',
              role: 'SYSTEM',
              body:
                `Thanks for reaching out, ${author.name.split(' ')[0]}. Your ticket ${publicId} is in the queue ` +
                'and is waiting for our support team. You can follow the conversation here.',
              isInternal: false,
            },
          ],
        },
        events: {
          create: [
            {
              actorId: user.id,
              actorName: author.name,
              type: 'CREATED',
              description: `${author.name} submitted this ticket via the author portal.`,
            },
            {
              actorName: 'BookLeaf Triage',
              type: 'AI_TRIAGE',
              description:
                `${aiLabel} classified this ticket as ${CATEGORY_LABELS[classification.category]} ` +
                `(${Math.round(classification.confidence * 100)}% confidence) and set priority ${classification.priority}.`,
              metadata: JSON.stringify({
                source: classification.source,
                confidence: classification.confidence,
                priorityReason: classification.priorityReason,
              }),
            },
          ],
        },
      },
      include: ticketInclude,
    });

    const payload = serializeTicket(ticket);
    publishTicketEvent({
      type: 'ticket.created',
      ticketId: ticket.id,
      ticketPublicId: ticket.publicId,
      authorId: ticket.authorId,
      data: payload,
    });

    res.status(201).json({
      data: payload,
      meta: {
        triage: {
          source: classification.source,
          model: classification.model,
          cached: classification.cached,
          confidence: classification.confidence,
          priorityReason: classification.priorityReason,
        },
      },
    });
  }),
);

ticketsRouter.get(
  '/',
  validate(ticketQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as TicketQueryInput;
    const result = await listTickets(req, query);
    res.json({
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        pages: Math.max(1, Math.ceil(result.total / result.pageSize)),
      },
    });
  }),
);

ticketsRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const ticket = await getTicketForUser(req, req.params.id, { includeInternal: true });
    res.json({
      data: {
        ...serializeTicket(ticket),
        messages: ticket.messages.map(serializeMessage),
        events: serializeEventList(ticket.events),
        book: ticket.book ? serializeBook(ticket.book) : null,
      },
    });
  }),
);

ticketsRouter.patch(
  '/:id',
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(updateTicketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id: req.params.id }, { publicId: req.params.id }] },
    });
    if (!ticket) throw notFound('That support ticket does not exist.');

    const input = req.body as UpdateTicketInput;
    const updates: Prisma.TicketUpdateInput = {};
    const events: Prisma.TicketEventUncheckedCreateWithoutTicketInput[] = [];

    if (input.status && input.status !== ticket.status) {
      updates.status = input.status;
      if (input.status === 'RESOLVED') {
        updates.resolvedAt = new Date();
        updates.closedAt = null;
      } else if (input.status === 'CLOSED') {
        updates.closedAt = new Date();
      } else {
        updates.resolvedAt = null;
        updates.closedAt = null;
      }
      events.push({
        actorId: req.user!.id,
        actorName: req.user!.name,
        type: 'STATUS_CHANGED',
        description: `Status changed from ${ticket.status} to ${input.status}.`,
        metadata: JSON.stringify({ from: ticket.status, to: input.status }),
      });
    }

    if (input.category && input.category !== ticket.category) {
      updates.category = input.category;
      updates.categorySource = 'ADMIN';
      events.push({
        actorId: req.user!.id,
        actorName: req.user!.name,
        type: 'CATEGORY_OVERRIDE',
        description:
          `Category overridden from ${CATEGORY_LABELS[ticket.category as TicketCategory] ?? ticket.category} ` +
          `to ${CATEGORY_LABELS[input.category]}.`,
        metadata: JSON.stringify({
          from: ticket.category,
          to: input.category,
          aiCategory: ticket.aiCategory,
        }),
      });
    }

    if (input.priority && input.priority !== ticket.priority) {
      updates.priority = input.priority;
      updates.prioritySource = 'ADMIN';
      events.push({
        actorId: req.user!.id,
        actorName: req.user!.name,
        type: 'PRIORITY_OVERRIDE',
        description: `Priority overridden from ${ticket.priority} to ${input.priority}.`,
        metadata: JSON.stringify({ from: ticket.priority, to: input.priority }),
      });
    }

    if (input.assignedToId !== undefined) {
      let assigneeId = input.assignedToId;
      if (assigneeId === 'me') assigneeId = req.user!.id;

      if (assigneeId) {
        const assignee = await prisma.user.findUnique({
          where: { id: assigneeId },
          select: { id: true, name: true, role: true },
        });
        if (!assignee) throw badRequest('The selected assignee does not exist.');
        if (assignee.role !== 'ADMIN') throw badRequest('Tickets can only be assigned to operations staff.');
        updates.assignedTo = { connect: { id: assignee.id } };
        events.push({
          actorId: req.user!.id,
          actorName: req.user!.name,
          type: 'ASSIGNED',
          description: `Assigned to ${assignee.name}.`,
          metadata: JSON.stringify({ assigneeId: assignee.id }),
        });
      } else {
        updates.assignedTo = { disconnect: true };
        events.push({
          actorId: req.user!.id,
          actorName: req.user!.name,
          type: 'ASSIGNED',
          description: 'Moved back to the unassigned pool.',
        });
      }
    }

    if (Object.keys(updates).length === 0) {
      throw badRequest('No effective changes were supplied.');
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        ...updates,
        ...(events.length > 0 ? { events: { create: events } } : {}),
      },
      include: ticketInclude,
    });

    const payload = serializeTicket(updated);
    publishTicketEvent({
      type: 'ticket.updated',
      ticketId: updated.id,
      ticketPublicId: updated.publicId,
      authorId: updated.authorId,
      data: payload,
    });

    res.json({ data: payload });
  }),
);

ticketsRouter.post(
  '/:id/assign',
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(assignSchema),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id: req.params.id }, { publicId: req.params.id }] },
    });
    if (!ticket) throw notFound('That support ticket does not exist.');

    const requested = (req.body as { assignedToId: string | null }).assignedToId;
    const assigneeId = requested === 'me' ? req.user!.id : requested;

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee || assignee.role !== 'ADMIN') {
        throw badRequest('Tickets can only be assigned to operations staff.');
      }
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedToId: assigneeId,
        events: {
          create: {
            actorId: req.user!.id,
            actorName: req.user!.name,
            type: 'ASSIGNED',
            description: assigneeId ? `Assigned to ${req.user!.name}.` : 'Moved back to the unassigned pool.',
          },
        },
      },
      include: ticketInclude,
    });

    const payload = serializeTicket(updated);
    publishTicketEvent({
      type: 'ticket.updated',
      ticketId: updated.id,
      ticketPublicId: updated.publicId,
      authorId: updated.authorId,
      data: payload,
    });
    res.json({ data: payload });
  }),
);

ticketsRouter.post(
  '/:id/messages',
  validate(idParamSchema, 'params'),
  validate(createMessageSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id: req.params.id }, { publicId: req.params.id }] },
    });
    if (!ticket) throw notFound('That support ticket does not exist.');

    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin && ticket.authorId !== user.authorId) {
      throw forbidden('You can only reply to your own support tickets.');
    }

    const input = req.body as CreateMessageInput;
    const isInternal = Boolean(input.isInternal);

    if (isInternal && !isAdmin) {
      throw forbidden('Internal notes are restricted to operations staff.');
    }
    if (!isAdmin && ticket.status === 'CLOSED') {
      throw conflict('This ticket is closed. Please raise a new ticket if you need further help.');
    }

    const now = new Date();
    const ticketUpdates: Prisma.TicketUpdateInput = isInternal ? {} : { lastMessageAt: now };

    if (isAdmin && !isInternal) {
      if (!ticket.firstResponseAt) ticketUpdates.firstResponseAt = now;
      if (ticket.status === 'OPEN') ticketUpdates.status = 'IN_PROGRESS';
      if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
        ticketUpdates.status = 'IN_PROGRESS';
        ticketUpdates.resolvedAt = null;
        ticketUpdates.closedAt = null;
      }
    }

    if (!isAdmin && ticket.status === 'RESOLVED') {
      // An author reply on a resolved ticket reopens it automatically.
      ticketUpdates.status = 'OPEN';
      ticketUpdates.resolvedAt = null;
    }

    const [message, updated] = await prisma.$transaction([
      prisma.message.create({
        data: {
          ticketId: ticket.id,
          userId: user.id,
          authorName: user.name,
          role: isAdmin ? 'ADMIN' : 'AUTHOR',
          body: input.body,
          isInternal,
        },
        ...publicMessageInclude,
      }),
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          ...ticketUpdates,
          events: {
            create: {
              actorId: user.id,
              actorName: user.name,
              type: isInternal ? 'INTERNAL_NOTE' : 'PUBLIC_REPLY',
              description: isInternal
                ? `${user.name} added an internal note (not visible to the author).`
                : isAdmin
                  ? `${user.name} replied to the author.`
                  : `${user.name} replied to the support team.`,
            },
          },
        },
      }),
    ]);

    const serialized = serializeMessage(message);

    // Internal notes must never reach the author's event stream.
    if (!isInternal) {
      publishTicketEvent({
        type: 'ticket.message',
        ticketId: ticket.id,
        ticketPublicId: ticket.publicId,
        authorId: ticket.authorId,
        data: {
          message: serialized,
          status: updated.status,
          firstResponseAt: updated.firstResponseAt,
          lastMessageAt: updated.lastMessageAt,
        },
      });
    }
    publishTicketEvent({
      type: 'ticket.updated',
      adminOnly: isInternal,
      ticketId: ticket.id,
      ticketPublicId: ticket.publicId,
      authorId: ticket.authorId,
      data: {
        id: ticket.id,
        status: updated.status,
        priority: updated.priority,
        category: updated.category,
        assignedTo: updated.assignedToId,
      },
    });

    res.status(201).json({ data: serialized });
  }),
);

ticketsRouter.post(
  '/:id/close',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id: req.params.id }, { publicId: req.params.id }] },
    });
    if (!ticket) throw notFound('That support ticket does not exist.');

    if (req.user!.role !== 'ADMIN' && ticket.authorId !== req.user!.authorId) {
      throw forbidden('You can only close your own support tickets.');
    }
    if (ticket.status === 'CLOSED') throw conflict('This ticket is already closed.');

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        events: {
          create: {
            actorId: req.user!.id,
            actorName: req.user!.name,
            type: 'CLOSED',
            description: `Ticket closed by ${req.user!.role === 'ADMIN' ? 'operations' : 'the author'}.`,
          },
        },
      },
      include: ticketInclude,
    });

    const payload = serializeTicket(updated);
    publishTicketEvent({
      type: 'ticket.closed',
      ticketId: updated.id,
      ticketPublicId: updated.publicId,
      authorId: updated.authorId,
      data: payload,
    });
    res.json({ data: payload });
  }),
);

/** Admin-only: generate a grounded, editable draft. Never sends anything. */
ticketsRouter.post(
  '/:id/ai/draft',
  requireAdmin,
  aiLimiter,
  validate(idParamSchema, 'params'),
  validate(draftSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as DraftInput;

    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id: req.params.id }, { publicId: req.params.id }] },
      include: {
        book: true,
        author: true,
        messages: {
          where: { isInternal: false, role: { in: ['AUTHOR', 'ADMIN'] } },
          orderBy: { createdAt: 'desc' },
          take: 2,
        },
      },
    });
    if (!ticket) throw notFound('That support ticket does not exist.');

    const messages = [...ticket.messages].reverse();

    const draft = await generateDraft(
      {
        ticket,
        book: ticket.book,
        authorName: ticket.author.name,
        authorTier: ticket.author.tier,
        authorCity: ticket.author.city,
        messages,
      },
      {
        tone: input.tone as DraftTone,
        includeHistory: input.includeHistory,
        instructions: input.instructions,
      },
    );

    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: req.user!.id,
        actorName: req.user!.name,
        type: 'DRAFT_GENERATED',
        description: `${draft.source === 'AI' ? 'AI' : 'Template'} draft generated (${input.tone.toLowerCase()} tone, ${draft.model}).`,
        metadata: JSON.stringify({
          model: draft.model,
          source: draft.source,
          sections: draft.sections,
          promptTokens: draft.promptTokens,
          completionTokens: draft.completionTokens,
        }),
      },
    });

    res.json({
      data: {
        draft: draft.body,
        meta: {
          source: draft.source,
          model: draft.model,
          tone: draft.tone,
          cached: draft.cached,
          sections: draft.sections,
          promptTokens: draft.promptTokens,
          completionTokens: draft.completionTokens,
          latencyMs: draft.latencyMs,
          estimatedCostUsd: draft.estimatedCostUsd,
        },
      },
    });
  }),
);

/** Admin-only: re-run classification and priority, discarding manual overrides. */
ticketsRouter.post(
  '/:id/ai/reclassify',
  requireAdmin,
  aiLimiter,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id: req.params.id }, { publicId: req.params.id }] },
      include: { book: true, author: true },
    });
    if (!ticket) throw notFound('That support ticket does not exist.');

    const classification = await classifyTicket(
      {
        subject: ticket.subject,
        description: ticket.description,
        book: ticket.book,
        authorTier: ticket.author.tier,
        hasAttachment: Boolean(ticket.attachmentName),
      },
      ticket.id,
    );

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        category: classification.category,
        categorySource: classification.source,
        aiCategory: classification.category,
        aiConfidence: classification.confidence,
        priority: classification.priority,
        prioritySource: classification.source,
        aiPriority: classification.priority,
        aiPriorityReason: classification.priorityReason,
        events: {
          create: {
            actorId: req.user!.id,
            actorName: req.user!.name,
            type: 'AI_TRIAGE',
            description:
              `Re-ran ${classification.source === 'AI' ? 'AI' : 'rule-engine'} triage: ` +
              `${CATEGORY_LABELS[classification.category]}, priority ${classification.priority}.`,
            metadata: JSON.stringify({
              source: classification.source,
              confidence: classification.confidence,
              cached: classification.cached,
              model: classification.model,
            }),
          },
        },
      },
      include: ticketInclude,
    });

    const payload = serializeTicket(updated);
    publishTicketEvent({
      type: 'ticket.updated',
      ticketId: updated.id,
      ticketPublicId: updated.publicId,
      authorId: updated.authorId,
      data: payload,
    });

    res.json({
      data: payload,
      meta: {
        triage: {
          source: classification.source,
          confidence: classification.confidence,
          cached: classification.cached,
          model: classification.model,
          priorityReason: classification.priorityReason,
        },
      },
    });
  }),
);

const serializeEventList = (events: TicketEvent[]) => events.map(serializeEvent);
