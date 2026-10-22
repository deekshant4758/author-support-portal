import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Icon } from './Icon';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  PRIORITY_DOTS,
  PRIORITY_LABELS,
  STATUS_DOTS,
  STATUS_LABELS,
  STATUS_TONES,
  initials,
  number,
  slaText,
} from '../lib/format';
import type { TicketCategory, TicketPriority, TicketStatus, TriageSource } from '../lib/types';

/* ------------------------------------------------------------------ pills */

export const Pill = ({
  children,
  className,
  dot,
  icon,
}: {
  children: ReactNode;
  className?: string;
  dot?: string;
  icon?: string;
}) => (
  <span
    className={clsx(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-label-sm font-semibold',
      className,
    )}
  >
    {dot ? <span className={clsx('h-1.5 w-1.5 rounded-full', dot)} /> : null}
    {icon ? <Icon name={icon} className="text-[13px]" /> : null}
    {children}
  </span>
);

export const StatusPill = ({ status, className }: { status: TicketStatus; className?: string }) => (
  <Pill className={clsx(STATUS_TONES[status], className)} dot={STATUS_DOTS[status]}>
    {STATUS_LABELS[status]}
  </Pill>
);

// Secondary ticket metadata reads as text so status remains the primary badge.
const MetadataLabel = ({
  children,
  className,
  dot,
  icon,
}: {
  children: ReactNode;
  className?: string;
  dot?: string;
  icon?: string;
}) => (
  <span className={clsx('inline-flex items-center gap-1.5 text-label-sm text-[#64748b]', className)}>
    {dot ? <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', dot)} /> : null}
    {icon ? <Icon name={icon} className="shrink-0 text-[14px]" /> : null}
    {children}
  </span>
);

export const PriorityPill = ({
  priority,
  className,
  showDot = true,
}: {
  priority: TicketPriority;
  className?: string;
  showDot?: boolean;
}) => (
  <MetadataLabel
    className={clsx(
      priority === 'CRITICAL'
        ? '!text-danger-deep font-semibold'
        : priority === 'HIGH'
          ? '!text-[#C2410C] font-semibold'
          : '',
      className,
    )}
    dot={showDot ? PRIORITY_DOTS[priority] : undefined}
  >
    {PRIORITY_LABELS[priority]}
  </MetadataLabel>
);

export const CategoryPill = ({
  category,
  className,
  iconOnly = false,
}: {
  category: TicketCategory;
  className?: string;
  iconOnly?: boolean;
}) => (
  <MetadataLabel className={className} icon={CATEGORY_ICONS[category]}>
    {iconOnly ? null : CATEGORY_LABELS[category]}
  </MetadataLabel>
);

export const SourcePill = ({ source, confidence }: { source: TriageSource; confidence?: number | null }) => {
  const config: Record<TriageSource, { label: string; icon: string }> = {
    AI: { label: 'AI', icon: 'auto_awesome' },
    HEURISTIC: {
      label: 'Rule engine',
      icon: 'rule',
    },
    ADMIN: { label: 'Manual', icon: 'edit' },
    AUTHOR: { label: 'Author pick', icon: 'person' },
  };
  const item = config[source] ?? config.HEURISTIC;
  return (
    <MetadataLabel icon={item.icon}>
      {item.label}
      {confidence != null ? ` · ${Math.round(confidence * 100)}%` : ''}
    </MetadataLabel>
  );
};

export const SlaPill = ({ minutes, breached }: { minutes: number; breached: boolean }) => (
  <MetadataLabel
    className={clsx(breached ? '!text-danger-deep font-semibold' : minutes < 120 ? '!text-[#B45309]' : '')}
    icon={breached ? 'alarm' : 'schedule'}
  >
    {slaText(minutes, breached)}
  </MetadataLabel>
);

/* ------------------------------------------------------------------ layout */

export const Pagination = ({
  page,
  pages,
  total,
  disabled,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] p-4 text-body-sm text-[#64748b]">
    <span>
      {total} {total === 1 ? 'ticket' : 'tickets'}
      {pages > 1 ? ` · Page ${page} of ${pages}` : ''}
    </span>
    {pages > 1 ? (
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    ) : null}
  </div>
);

export const Avatar = ({
  name,
  size = 'md',
  tone = 'primary',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'primary' | 'ai' | 'neutral';
}) => {
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-[11px]', lg: 'h-12 w-12 text-sm' };
  const tones = {
    primary: 'bg-[#006948] text-white',
    ai: 'bg-ai text-white',
    neutral: 'bg-[#E5EEFF] text-[#0B1C30]',
  };
  return (
    <span
      className={clsx(
        'inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold tracking-wide',
        sizes[size],
        tones[tone],
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
};

export const Card = ({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) => <div className={clsx('card', hover && 'card-hover', className)}>{children}</div>;

export const SectionHeading = ({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={clsx('flex flex-wrap items-end justify-between gap-3', className)}>
    <div>
      <h2 className="text-headline-md text-ink">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-body-sm text-[#64748b]">{subtitle}</p> : null}
    </div>
    {action}
  </div>
);

export const MetricCard = ({
  label,
  value,
  hint,
  icon,
  accent = 'text-ink',
  trailing,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: string;
  accent?: string;
  trailing?: ReactNode;
}) => (
  <div className="card card-hover flex flex-col justify-between p-5">
    <div className="flex items-start justify-between gap-2">
      <span className="micro-label">{label}</span>
      {trailing ?? (icon ? <Icon name={icon} className="text-[19px] text-[#94a3b8]" /> : null)}
    </div>
    <div className="mt-4">
      <div className={clsx('text-[1.65rem] font-bold leading-none tracking-tight tabular', accent)}>
        {value}
      </div>
      {hint ? <p className="mt-2 text-body-sm text-[#64748b]">{hint}</p> : null}
    </div>
  </div>
);

export const ProgressBar = ({
  value,
  max,
  className,
  barClassName = 'bg-primary',
}: {
  value: number;
  max: number;
  className?: string;
  barClassName?: string;
}) => {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-[#E5EEFF]', className)}>
      <div
        className={clsx('h-full rounded-full transition-all', barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

export const Divider = ({ label }: { label?: string }) =>
  label ? (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-[#E2E8F0]" />
      <span className="text-label-sm uppercase tracking-wider text-[#94a3b8]">{label}</span>
      <span className="h-px flex-1 bg-[#E2E8F0]" />
    </div>
  ) : (
    <div className="divider" />
  );

/* ------------------------------------------------------------------ states */

export const Spinner = ({ className }: { className?: string }) => (
  <span
    className={clsx(
      'inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#cbd5e1] border-t-primary',
      className,
    )}
    aria-label="Loading"
  />
);

export const PageLoader = ({ label = 'Loading workspace…' }: { label?: string }) => (
  <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3" role="status">
    <Spinner className="h-7 w-7" />
    <p className="text-body-sm text-[#64748b]">{label}</p>
  </div>
);

export const ErrorState = ({
  title = 'We could not load this right now',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) => (
  <div className="card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
      <Icon name="cloud_off" className="text-[24px]" />
    </span>
    <div>
      <h3 className="text-headline-sm text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-body-sm text-[#64748b]">
        {message ?? 'Check your connection and try again. Your data is safe.'}
      </p>
    </div>
    {onRetry ? (
      <button type="button" className="btn-secondary mt-1" onClick={onRetry}>
        <Icon name="refresh" className="text-[18px]" /> Try again
      </button>
    ) : null}
  </div>
);

export const EmptyState = ({
  icon = 'inbox',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#CBD5E1] bg-white/60 px-6 py-14 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-low text-primary">
      <Icon name={icon} className="text-[24px]" />
    </span>
    <div>
      <h3 className="text-headline-sm text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-body-sm text-[#64748b]">{message}</p>
    </div>
    {action ? <div className="mt-1">{action}</div> : null}
  </div>
);

/* ------------------------------------------------------------------ modal */

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lift animate-fade-up',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] px-6 py-5">
          <div>
            <h2 className="text-headline-md text-ink">{title}</h2>
            {description ? <p className="mt-1 text-body-sm text-[#64748b]">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost -mr-2 -mt-1 p-2" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};

/* ------------------------------------------------------------------ misc */

export const CopyButton = ({ value, label = 'Copy' }: { value: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={`${label} ${value}`}
      aria-label={`${label} ${value}`}
      className="rounded p-1 text-[#64748b] transition-colors hover:bg-[#F1F5F9] hover:text-ink"
    >
      <Icon name={copied ? 'check' : 'content_copy'} className="text-[15px]" />
    </button>
  );
};

export const Tabs = <T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) => (
  <div
    className={clsx('flex gap-1 overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white p-1', className)}
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        aria-pressed={value === option.value}
        className={clsx(
          'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-label-md transition-colors',
          value === option.value
            ? 'bg-primary text-white shadow-sm'
            : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-ink',
        )}
      >
        {option.label}
        {option.count != null ? (
          <span
            className={clsx(
              'rounded px-1.5 text-[10px] font-bold tabular',
              value === option.value ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748b]',
            )}
          >
            {number(option.count)}
          </span>
        ) : null}
      </button>
    ))}
  </div>
);

export const ConfidenceMeter = ({ value }: { value: number }) => {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E5EEFF]">
        <div className="h-full rounded-full bg-ai" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-label-sm font-semibold text-ai-deep tabular">{pct}%</span>
    </div>
  );
};
