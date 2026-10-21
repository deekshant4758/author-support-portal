import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../lib/constants';

const categorySchema = z.enum(TICKET_CATEGORIES);
const prioritySchema = z.enum(TICKET_PRIORITIES);
const statusSchema = z.enum(TICKET_STATUSES);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export const createTicketSchema = z.object({
  bookId: z.string().trim().min(1).nullable().optional(),
  subject: z
    .string()
    .trim()
    .min(5, 'Subject must be at least 5 characters.')
    .max(140, 'Subject must be 140 characters or fewer.'),
  description: z
    .string()
    .trim()
    .min(20, 'Please describe the issue in at least 20 characters.')
    .max(5000, 'Description must be 5000 characters or fewer.'),
  category: z.union([categorySchema, z.literal('AUTO')]).optional().default('AUTO'),
  attachmentName: z.string().trim().max(200).optional().nullable(),
  attachmentSize: z.string().trim().max(40).optional().nullable(),
});

export const createMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(5000, 'Message must be 5000 characters or fewer.'),
  isInternal: z.boolean().optional().default(false),
});

export const updateTicketSchema = z
  .object({
    status: statusSchema.optional(),
    category: categorySchema.optional(),
    priority: prioritySchema.optional(),
    assignedToId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const assignSchema = z.object({
  assignedToId: z.string().trim().min(1).nullable(),
});

export const draftSchema = z.object({
  tone: z.enum(['EMPATHETIC', 'CONCISE', 'ESCALATION']).optional().default('EMPATHETIC'),
  includeHistory: z.boolean().optional().default(true),
  instructions: z.string().trim().max(500).optional(),
});

export const ticketQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(['urgency', 'oldest', 'newest', 'updated']).optional().default('urgency'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const idParamSchema = z.object({
  id: z.string().trim().min(1, 'A ticket id is required.'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketQueryInput = z.infer<typeof ticketQuerySchema>;
export type DraftInput = z.infer<typeof draftSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
