import type { TicketCategory, TicketPriority, TicketStatus } from './types';

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: 'Royalty & Payments',
  ISBN_METADATA: 'ISBN & Metadata',
  PRINTING_QUALITY: 'Printing & Quality',
  DISTRIBUTION_AVAILABILITY: 'Distribution & Availability',
  BOOK_STATUS_PRODUCTION: 'Book Status & Production',
  GENERAL_INQUIRY: 'General Inquiry',
};

export const CATEGORY_ICONS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: 'payments',
  ISBN_METADATA: 'qr_code_2',
  PRINTING_QUALITY: 'print',
  DISTRIBUTION_AVAILABILITY: 'local_shipping',
  BOOK_STATUS_PRODUCTION: 'published_with_changes',
  GENERAL_INQUIRY: 'help_center',
};

export const CATEGORY_TONES: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  ISBN_METADATA: 'bg-ai-soft text-ai-deep border-ai-border',
  PRINTING_QUALITY: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  DISTRIBUTION_AVAILABILITY: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  BOOK_STATUS_PRODUCTION: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]',
  GENERAL_INQUIRY: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const STATUS_TONES: Record<TicketStatus, string> = {
  OPEN: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  IN_PROGRESS: 'bg-ai-soft text-ai-deep border-ai-border',
  RESOLVED: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  CLOSED: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
};

export const STATUS_DOTS: Record<TicketStatus, string> = {
  OPEN: 'bg-[#F59E0B]',
  IN_PROGRESS: 'bg-ai',
  RESOLVED: 'bg-[#059669]',
  CLOSED: 'bg-[#94A3B8]',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const PRIORITY_TONES: Record<TicketPriority, string> = {
  CRITICAL: 'bg-danger-soft text-danger-deep border-danger-border',
  HIGH: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
  MEDIUM: 'bg-[#F1F5F9] text-[#334155] border-[#E2E8F0]',
  LOW: 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]',
};

export const PRIORITY_DOTS: Record<TicketPriority, string> = {
  CRITICAL: 'bg-danger',
  HIGH: 'bg-[#F97316]',
  MEDIUM: 'bg-[#64748B]',
  LOW: 'bg-[#CBD5E1]',
};

export const money = (value: number | null | undefined): string => {
  if (value == null) return '—';
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
};

export const compactMoney = (value: number): string => {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return money(value);
};

export const number = (value: number | null | undefined): string =>
  value == null ? '—' : new Intl.NumberFormat('en-IN').format(value);

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const timeAgo = (value: string | null | undefined): string => {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMinutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
};

export const formatDuration = (minutes: number): string => {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs}m`;
  const hours = Math.floor(abs / 60);
  const remainder = abs % 60;
  if (hours < 24) return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours === 0 ? `${days}d` : `${days}d ${remainingHours}h`;
};

export const slaText = (minutes: number, breached: boolean): string => {
  if (breached) return `Overdue ${formatDuration(minutes)}`;
  return `${formatDuration(minutes)} left`;
};

export const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const firstName = (name: string): string => name.split(' ')[0] ?? name;

export const pluralize = (count: number, singular: string, plural?: string): string =>
  `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;

export const PRODUCTION_STAGES = [
  'Manuscript',
  'Editing',
  'Cover Design',
  'Typesetting',
  'Proofreading',
  'ISBN Assignment',
  'Printing',
  'Distribution Setup',
  'Published & Live',
] as const;

/** Deterministic cover palette so each title has a stable, editorial look. */
export const coverPalette = (seed: string) => {
  const palettes = [
    { from: '#064E3B', via: '#047857', to: '#0F172A', accent: '#A7F3D0' },
    { from: '#1E1B4B', via: '#4338CA', to: '#0F172A', accent: '#C7D2FE' },
    { from: '#7C2D12', via: '#B45309', to: '#0F172A', accent: '#FDE68A' },
    { from: '#0C4A6E', via: '#0369A1', to: '#0F172A', accent: '#BAE6FD' },
    { from: '#4C1D95', via: '#6D28D9', to: '#0F172A', accent: '#DDD6FE' },
    { from: '#831843', via: '#BE185D', to: '#0F172A', accent: '#FBCFE8' },
  ];
  const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return palettes[index];
};

export const statusLabel = (status: string) => STATUS_LABELS[status as TicketStatus] ?? status;
export const categoryLabel = (category: string) =>
  CATEGORY_LABELS[category as TicketCategory] ?? category;
export const priorityLabel = (priority: string) =>
  PRIORITY_LABELS[priority as TicketPriority] ?? priority;
