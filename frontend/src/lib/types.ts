export type Role = 'AUTHOR' | 'ADMIN';

export type TicketCategory =
  | 'ROYALTY_PAYMENTS'
  | 'ISBN_METADATA'
  | 'PRINTING_QUALITY'
  | 'DISTRIBUTION_AVAILABILITY'
  | 'BOOK_STATUS_PRODUCTION'
  | 'GENERAL_INQUIRY';

export type TicketPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TriageSource = 'AI' | 'HEURISTIC' | 'ADMIN' | 'AUTHOR';
export type Tone = 'EMPATHETIC' | 'CONCISE' | 'ESCALATION';

export interface AuthorLite {
  id: string;
  name: string;
  email: string;
  city?: string;
  tier?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  authorId: string | null;
  author?: { id: string; name: string; email: string; city?: string; tier?: string } | null;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface AuthorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joinedDate: string;
  tier: string;
  bankName: string | null;
  bankLast4: string | null;
}

export interface Book {
  id: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  status: string;
  mrp: number | null;
  royaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastRoyaltyPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
  productionStage: number | null;
  productionNote: string | null;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory;
  categorySource: TriageSource;
  aiCategory: TicketCategory | null;
  aiConfidence: number | null;
  priority: TicketPriority;
  prioritySource: TriageSource;
  aiPriority: TicketPriority | null;
  aiPriorityReason: string | null;
  attachmentName: string | null;
  attachmentSize: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  book: Book | null;
  author: AuthorLite | null;
  assignee: { id: string; name: string; email: string } | null;
  messageCount?: number;
  ageMinutes: number;
  slaHours: number;
  slaDueAt: string;
  slaRemainingMinutes: number;
  slaBreached: boolean;
}

export interface Message {
  id: string;
  ticketId: string;
  authorName: string;
  role: 'AUTHOR' | 'ADMIN' | 'SYSTEM';
  body: string;
  isInternal: boolean;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export interface TicketEvent {
  id: string;
  type: string;
  description: string;
  actorName: string;
  metadata: unknown;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  messages: Message[];
  events: TicketEvent[];
}

export interface AuthorSummary {
  author: AuthorProfile;
  metrics: {
    bookCount: number;
    publishedCount: number;
    productionCount: number;
    openTickets: number;
    totalRoyaltyEarned: number;
    royaltyPaid: number;
    royaltyPending: number;
    totalCopiesSold: number;
  };
  recentTickets: Ticket[];
}

export interface DraftMeta {
  source: 'AI' | 'TEMPLATE';
  model: string;
  tone: Tone;
  cached: boolean;
  sections: string[];
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

export interface AiUsageEntry {
  id: string;
  operation: 'CLASSIFY' | 'DRAFT';
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  success: boolean;
  fallback: boolean;
  cached: boolean;
  createdAt: string;
  ticket?: { publicId: string; subject: string } | null;
}

export interface AdminStats {
  totals: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    unresolved: number;
    criticalOpen: number;
    highOpen: number;
    unassignedOpen: number;
    resolvedToday: number;
    overdueCount: number;
  };
  percentages: {
    autoClassified: number;
    resolvedRate: number;
    fallbackRate: number;
  };
  avgFirstResponseMinutes: number;
  categories: Record<TicketCategory, number>;
  priorities: Record<TicketPriority, number>;
  statuses: Record<TicketStatus, number>;
  ai: {
    calls: number;
    fallbacks: number;
    cacheHits: number;
    tokens: number;
    estimatedCostUsd: number;
    avgLatencyMs: number;
    byOperation: { CLASSIFY: number; DRAFT: number };
    recent: AiUsageEntry[];
  };
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  assignedCount: number;
}

export interface KnowledgeSection {
  id: string;
  title: string;
  categories: TicketCategory[];
  content: string;
}

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface TicketFilters {
  status?: string;
  category?: string;
  priority?: string;
  assignee?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: 'urgency' | 'oldest' | 'newest' | 'updated';
  page?: number;
  pageSize?: number;
}

export interface CreateTicketPayload {
  bookId?: string | null;
  subject: string;
  description: string;
  category?: TicketCategory | 'AUTO';
  attachmentName?: string | null;
  attachmentSize?: string | null;
}

interface LiveEventBase {
  ticketId?: string;
  ticketPublicId?: string;
  authorId?: string;
  at?: string;
}

export type LiveEvent = LiveEventBase & (
  | {
      type: 'ticket.message';
      data: {
        message: Message;
        status: TicketStatus;
        firstResponseAt: string | null;
        lastMessageAt: string;
      };
    }
  | {
      type: 'connected' | 'ticket.created' | 'ticket.updated' | 'ticket.closed' | 'heartbeat';
      data?: unknown;
    }
);
