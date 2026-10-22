/** Shared domain constants. Statuses, categories and priorities are stored as
 * strings, so these are the single source of truth used by validation, services
 * and the OpenAPI spec. */

export const TICKET_CATEGORIES = [
  'ROYALTY_PAYMENTS',
  'ISBN_METADATA',
  'PRINTING_QUALITY',
  'DISTRIBUTION_AVAILABILITY',
  'BOOK_STATUS_PRODUCTION',
  'GENERAL_INQUIRY',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: 'Royalty & Payments',
  ISBN_METADATA: 'ISBN & Metadata',
  PRINTING_QUALITY: 'Printing & Quality',
  DISTRIBUTION_AVAILABILITY: 'Distribution & Availability',
  BOOK_STATUS_PRODUCTION: 'Book Status & Production',
  GENERAL_INQUIRY: 'General Inquiry',
};

/** Response-time targets in hours, used for queue urgency + SLA badges. */
export const SLA_HOURS: Record<TicketPriority, number> = {
  CRITICAL: 2,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 48,
};

/** Weight used when sorting the queue: higher = more urgent. */
export const PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const PRODUCTION_STAGES = [
  'Manuscript Received',
  'Editing',
  'Cover Design',
  'Typesetting',
  'Proofreading',
  'ISBN Assignment',
  'Printing',
  'Distribution Setup',
  'Published & Live',
] as const;
