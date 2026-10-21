import type { Author, Book, Message, Ticket, TicketEvent, User } from '@prisma/client';
import { SLA_HOURS, type TicketPriority } from './constants';

/** Safely decode the JSON-encoded distribution channel list. */
export const decodeChannels = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export const serializeBook = (book: Book) => ({
  id: book.id,
  title: book.title,
  isbn: book.isbn,
  genre: book.genre,
  publicationDate: book.publicationDate,
  status: book.status,
  mrp: book.mrp,
  royaltyPerCopy: book.royaltyPerCopy,
  totalCopiesSold: book.totalCopiesSold,
  totalRoyaltyEarned: book.totalRoyaltyEarned,
  royaltyPaid: book.royaltyPaid,
  royaltyPending: book.royaltyPending,
  lastRoyaltyPayoutDate: book.lastRoyaltyPayoutDate,
  printPartner: book.printPartner,
  availableOn: decodeChannels(book.availableOn),
  productionStage: book.productionStage,
  productionNote: book.productionNote,
});

export const serializeAuthor = (author: Author) => ({
  id: author.id,
  name: author.name,
  email: author.email,
  phone: author.phone,
  city: author.city,
  joinedDate: author.joinedDate,
  tier: author.tier,
  bankName: author.bankName,
  bankLast4: author.bankLast4,
});

export const serializeUser = (user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'authorId'>) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  authorId: user.authorId,
});

export const serializeMessage = (
  message: Message & { user?: Pick<User, 'id' | 'name' | 'role'> | null },
) => ({
  id: message.id,
  ticketId: message.ticketId,
  authorName: message.authorName,
  role: message.role,
  body: message.body,
  isInternal: message.isInternal,
  createdAt: message.createdAt,
  user: message.user ? { id: message.user.id, name: message.user.name } : null,
});

type TicketWithRelations = Ticket & {
  book?: Book | null;
  author?: Author | null;
  assignedTo?: Pick<User, 'id' | 'name' | 'email'> | null;
  _count?: { messages: number };
};

const slaFor = (ticket: Ticket) => {
  const hours = SLA_HOURS[ticket.priority as TicketPriority] ?? 24;
  const dueAt = new Date(ticket.createdAt.getTime() + hours * 60 * 60 * 1000);
  const remainingMinutes = Math.round((dueAt.getTime() - Date.now()) / 60000);
  const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  return {
    slaHours: hours,
    slaDueAt: dueAt,
    slaRemainingMinutes: remainingMinutes,
    slaBreached: !isResolved && remainingMinutes < 0,
  };
};

export const serializeTicket = (ticket: TicketWithRelations) => ({
  ...slaFor(ticket),
  id: ticket.id,
  ticketNumber: ticket.publicId,
  subject: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  category: ticket.category,
  categorySource: ticket.categorySource,
  aiCategory: ticket.aiCategory,
  aiConfidence: ticket.aiConfidence,
  priority: ticket.priority,
  prioritySource: ticket.prioritySource,
  aiPriority: ticket.aiPriority,
  aiPriorityReason: ticket.aiPriorityReason,
  attachmentName: ticket.attachmentName,
  attachmentSize: ticket.attachmentSize,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  lastMessageAt: ticket.lastMessageAt,
  firstResponseAt: ticket.firstResponseAt,
  resolvedAt: ticket.resolvedAt,
  closedAt: ticket.closedAt,
  book: ticket.book ? serializeBook(ticket.book) : null,
  author: ticket.author
    ? {
        id: ticket.author.id,
        name: ticket.author.name,
        email: ticket.author.email,
        tier: ticket.author.tier,
        city: ticket.author.city,
      }
    : null,
  assignee: ticket.assignedTo
    ? { id: ticket.assignedTo.id, name: ticket.assignedTo.name, email: ticket.assignedTo.email }
    : null,
  messageCount: ticket._count?.messages,
  ageMinutes: Math.round((Date.now() - ticket.createdAt.getTime()) / 60000),
});

export const serializeEvent = (event: TicketEvent) => ({
  id: event.id,
  type: event.type,
  description: event.description,
  actorName: event.actorName,
  metadata: event.metadata ? safeParse(event.metadata) : null,
  createdAt: event.createdAt,
});

const safeParse = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
