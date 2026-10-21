import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useToast } from '../../store/toast';
import { Icon } from '../../components/Icon';
import {
  Avatar,
  Card,
  CategoryPill,
  EmptyState,
  ErrorState,
  MetricCard,
  PriorityPill,
  SlaPill,
  StatusPill,
} from '../../components/ui';
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  timeAgo,
} from '../../lib/format';
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from '../../lib/types';

type StatusFilter = 'UNRESOLVED' | 'ALL' | TicketStatus;
type SortOption = 'urgency' | 'oldest' | 'newest' | 'updated';

const csvEscape = (value: string | number | null | undefined) => {
  if (value == null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const AdminQueuePage = () => {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [status, setStatus] = useState<StatusFilter>('UNRESOLVED');
  const [category, setCategory] = useState<'ALL' | TicketCategory>('ALL');
  const [priority, setPriority] = useState<'ALL' | TicketPriority>('ALL');
  const [assignee, setAssignee] = useState<'ALL' | 'me' | 'unassigned'>('ALL');
  const [sort, setSort] = useState<SortOption>('urgency');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: api.admin.stats,
  });

  const filters = useMemo(
    () => ({
      status:
        status === 'UNRESOLVED' ? 'OPEN,IN_PROGRESS' : status === 'ALL' ? undefined : status,
      category: category === 'ALL' ? undefined : category,
      priority: priority === 'ALL' ? undefined : priority,
      assignee: assignee === 'ALL' ? undefined : assignee,
      search: search.trim() || undefined,
      sort,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
      pageSize: 100,
    }),
    [status, category, priority, assignee, search, sort, dateFrom, dateTo],
  );

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['tickets', 'admin', filters],
    queryFn: () => api.tickets.list(filters),
  });

  const tickets = data?.items ?? [];
  const activeFilterCount =
    (category !== 'ALL' ? 1 : 0) +
    (priority !== 'ALL' ? 1 : 0) +
    (assignee !== 'ALL' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (search ? 1 : 0);

  const clearFilters = () => {
    setStatus('UNRESOLVED');
    setCategory('ALL');
    setPriority('ALL');
    setAssignee('ALL');
    setSort('urgency');
    setSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const exportCsv = () => {
    if (!tickets.length) {
      push('There are no tickets in the current view to export.', 'info');
      return;
    }
    const headers = [
      'Ticket',
      'Subject',
      'Author',
      'Book',
      'Category',
      'Priority',
      'Status',
      'Assignee',
      'Created',
      'SLA due',
      'AI confidence',
    ];
    const rows = tickets.map((ticket) =>
      [
        ticket.ticketNumber,
        ticket.subject,
        ticket.author?.name,
        ticket.book?.title,
        CATEGORY_LABELS[ticket.category],
        PRIORITY_LABELS[ticket.priority],
        STATUS_LABELS[ticket.status],
        ticket.assignee?.name ?? 'Unassigned',
        ticket.createdAt,
        ticket.slaDueAt,
        ticket.aiConfidence,
      ]
        .map(csvEscape)
        .join(','),
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookleaf-ticket-queue-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    push(`Exported ${tickets.length} tickets as CSV.`, 'success');
  };

  const priorityBreakdown = stats
    ? [
        { label: 'Critical', value: stats.totals.criticalOpen, tone: 'bg-danger' },
        { label: 'High', value: stats.totals.highOpen, tone: 'bg-[#F97316]' },
        { label: 'Medium', value: stats.priorities.MEDIUM, tone: 'bg-[#94A3B8]' },
        { label: 'Low', value: stats.priorities.LOW, tone: 'bg-[#CBD5E1]' },
      ]
    : [];

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ai-deep">
              Mission control
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-[#64748b]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#059669]" />
              Live ingest · author portal
            </span>
          </div>
          <h1 className="mt-2 text-[2rem] font-bold leading-tight tracking-[-0.03em] text-ink">
            Operations Hub — Support Queue
          </h1>
          <p className="mt-1 max-w-2xl text-body-md text-[#64748b]">
            AI-triaged author support. Urgent, revenue-impacting tickets surface first; every override is audited.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportCsv} className="btn-secondary">
            <Icon name="download" className="text-[18px] text-primary" />
            Export queue
            <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#64748b]">CSV</span>
          </button>
          <Link to="/admin/analytics" className="btn-primary">
            <Icon name="insights" className="text-[18px]" />
            AI telemetry
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Unresolved queue"
          value={statsLoading ? '—' : stats?.totals.unresolved ?? 0}
          icon="pending_actions"
          hint={
            stats ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-danger-deep">{stats.totals.criticalOpen} critical</span>
                <span className="text-[#cbd5e1]">·</span>
                <span>{stats.totals.unassignedOpen} unassigned</span>
                <span className="text-[#cbd5e1]">·</span>
                <span>{stats.totals.overdueCount} SLA overdue</span>
              </span>
            ) : (
              'Across all categories'
            )
          }
        />
        <MetricCard
          label="Avg first response"
          value={statsLoading ? '—' : `${stats?.avgFirstResponseMinutes ?? 0}m`}
          trailing={
            <span className="text-[11px] text-[#64748b]">
              {stats?.percentages.resolvedRate ?? 0}% resolved
            </span>
          }
          icon="timer"
          hint={
            <span className="inline-flex items-center gap-1">
              <Icon name="trending_down" className="text-[14px] text-primary" />
              SLA target under 2 hours
            </span>
          }
        />
        <MetricCard
          label="AI auto-classified"
          value={statsLoading ? '—' : `${stats?.percentages.autoClassified ?? 0}%`}
          icon="auto_awesome"
          accent="text-ai-deep"
          hint="Share of tickets routed automatically"
          trailing={
            <span className="inline-flex items-center gap-1 text-[11px] text-ai-deep">
              <Icon name="auto_awesome" className="text-[11px]" /> AI
            </span>
          }
        />
        <MetricCard
          label="AI spend (recent)"
          value={statsLoading ? '—' : `$${(stats?.ai.estimatedCostUsd ?? 0).toFixed(4)}`}
          icon="data_usage"
          hint={
            stats ? `${stats.ai.calls} calls · ${stats.ai.tokens.toLocaleString('en-IN')} tokens` : 'Token telemetry'
          }
          trailing={
            <span className="text-[11px] text-[#64748b]">
              {stats?.percentages.fallbackRate ?? 0}% fallback
            </span>
          }
        />
      </div>

      {stats && stats.totals.unresolved > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Open by priority</span>
          <div className="flex h-2 w-40 overflow-hidden rounded-full bg-[#E5EEFF]">
            {priorityBreakdown.map((item) => (
              <div
                key={item.label}
                className={item.tone}
                style={{ width: `${(item.value / Math.max(stats.totals.total, 1)) * 100}%` }}
                title={`${item.label}: ${item.value}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5 text-[10px] text-[#64748b]">
            {priorityBreakdown.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${item.tone}`} />
                {item.label} <strong className="text-ink tabular">{item.value}</strong>
              </span>
            ))}
          </div>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-[#94a3b8]">
            <Icon name="sync" className="text-[13px]" /> Updated live
          </span>
        </div>
      ) : null}

      <Card className="mt-5 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[190px] flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[#94a3b8]"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subject, ticket, author or book…"
              className="input !py-2 pl-9"
              aria-label="Search queue"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="input !w-auto !py-2 text-[12px]"
            aria-label="Filter by status"
          >
            <option value="UNRESOLVED">Status: Unresolved</option>
            <option value="ALL">Status: All</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as 'ALL' | TicketCategory)}
            className="input !w-auto !py-2 text-[12px]"
            aria-label="Filter by category"
          >
            <option value="ALL">Category: All</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as 'ALL' | TicketPriority)}
            className="input !w-auto !py-2 text-[12px]"
            aria-label="Filter by priority"
          >
            <option value="ALL">Priority: All</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value as 'ALL' | 'me' | 'unassigned')}
            className="input !w-auto !py-2 text-[12px]"
            aria-label="Filter by assignee"
          >
            <option value="ALL">Assignee: All</option>
            <option value="me">My tickets</option>
            <option value="unassigned">Unassigned pool</option>
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="input !w-[132px] !py-2 text-[12px]"
              aria-label="Created from"
            />
            <span className="text-[10px] text-[#94a3b8]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="input !w-[132px] !py-2 text-[12px]"
              aria-label="Created to"
            />
          </div>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            className="input !w-auto !py-2 text-[12px]"
            aria-label="Sort queue"
          >
            <option value="urgency">Sort: SLA urgency</option>
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
            <option value="updated">Recently updated</option>
          </select>

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold text-[#475569] hover:bg-[#F1F5F9]"
            >
              <Icon name="filter_list_off" className="text-[15px]" />
              Clear ({activeFilterCount})
            </button>
          ) : null}
        </div>
      </Card>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} message="We could not load the support queue." />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No tickets match this view"
            message="Try widening the status, category or date filters. New author queries will appear here automatically."
            action={
              activeFilterCount > 0 ? (
                <button type="button" className="btn-secondary" onClick={clearFilters}>
                  Reset all filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
              <p className="text-[11px] text-[#64748b]">
                <span className="font-bold text-ink tabular">{tickets.length}</span> tickets in this view
                {isFetching ? <span className="ml-2 text-[#94a3b8]">refreshing…</span> : null}
              </p>
              <p className="inline-flex items-center gap-1 text-[10px] text-[#94a3b8]">
                <Icon name="sort" className="text-[13px]" />
                Sorted by {sort === 'urgency' ? 'priority then SLA age' : sort}
              </p>
            </div>

            <div className="table-shell hidden lg:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Priority', 'Ticket', 'Author / book', 'Category', 'SLA', 'Status', 'Assignee'].map((header) => (
                      <th
                        key={header}
                        className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#94a3b8]"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {tickets.map((ticket) => {
                    const unresolved = ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS';
                    const overdue = ticket.slaBreached && unresolved;
                    return (
                      <tr
                        key={ticket.id}
                        className={clsx(
                          'group cursor-pointer transition-colors hover:bg-[#F8FAFC]',
                          overdue && 'bg-[#FEF2F2]/35',
                        )}
                        onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                      >
                        <td className="px-4 py-3 align-top">
                          <PriorityPill priority={ticket.priority} />
                        </td>
                        <td className="max-w-[380px] px-4 py-3 align-top">
                          <Link
                            to={`/admin/tickets/${ticket.id}`}
                            className="block"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] tabular">
                                {ticket.ticketNumber}
                              </span>
                              <span className="text-[9px] text-[#cbd5e1]">·</span>
                              <span className="text-[10px] text-[#94a3b8]">{timeAgo(ticket.createdAt)}</span>
                            </span>
                            <span className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-ink group-hover:text-primary">
                              {ticket.subject}
                            </span>
                            <span className="mt-0.5 line-clamp-1 text-[10px] text-[#94a3b8]">
                              {ticket.description}
                            </span>
                          </Link>
                        </td>
                        <td className="max-w-[170px] px-4 py-3 align-top">
                          <span className="flex items-center gap-1.5">
                            <Avatar name={ticket.author?.name ?? '?'} size="sm" tone="neutral" />
                            <span className="min-w-0">
                              <span className="block truncate text-[11px] font-semibold text-ink">
                                {ticket.author?.name}
                              </span>
                              <span className="block truncate text-[10px] text-[#94a3b8]">
                                {ticket.book?.title ?? 'Account level'}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <CategoryPill category={ticket.category} className="!py-0.5 !text-[9px]" />
                          <span className="mt-1 flex items-center gap-1 text-[9px] text-[#94a3b8]">
                            {ticket.aiConfidence != null ? (
                              <>
                                <Icon name="auto_awesome" className="text-[11px] text-ai" />
                                {Math.round(ticket.aiConfidence * 100)}% AI
                              </>
                            ) : (
                              'Manual triage'
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {unresolved ? (
                            <SlaPill minutes={ticket.slaRemainingMinutes} breached={ticket.slaBreached} />
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#94a3b8]">
                              <Icon name="check" className="text-[13px]" /> Met
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusPill status={ticket.status} />
                        </td>
                        <td className="px-4 py-3 align-top">
                          {ticket.assignee ? (
                            <span className="flex items-center gap-1.5 text-[11px] text-[#475569]">
                              <Avatar name={ticket.assignee.name} size="sm" tone="ai" />
                              <span className="max-w-[80px] truncate">{ticket.assignee.name.split(' ')[0]}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[9px] font-semibold text-[#B45309]">
                              <Icon name="person_add" className="text-[11px]" />
                              Unassigned
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile queue cards */}
            <div className="space-y-2.5 lg:hidden">
              {tickets.map((ticket: Ticket) => (
                <Link key={ticket.id} to={`/admin/tickets/${ticket.id}`} className="block">
                  <Card
                    hover
                    className={clsx(
                      'p-4',
                      ticket.slaBreached &&
                        (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') &&
                        'border-l-[3px] border-l-danger',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] tabular">
                        {ticket.ticketNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <PriorityPill priority={ticket.priority} className="!py-0.5 !text-[9px]" />
                        <StatusPill status={ticket.status} className="!py-0.5 !text-[9px]" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[13px] font-semibold leading-snug text-ink">{ticket.subject}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#64748b]">
                      <span className="font-medium">{ticket.author?.name}</span>
                      <span>·</span>
                      <span>{ticket.book?.title ?? 'Account level'}</span>
                      <span>·</span>
                      <span>{timeAgo(ticket.createdAt)}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-2.5">
                      <CategoryPill category={ticket.category} className="!py-0.5 !text-[9px]" />
                      {ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS' ? (
                        <SlaPill minutes={ticket.slaRemainingMinutes} breached={ticket.slaBreached} />
                      ) : (
                        <span className="text-[10px] text-[#94a3b8]">SLA met</span>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {stats ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total tickets', value: stats.totals.total },
            { label: 'Resolved today', value: stats.totals.resolvedToday },
            { label: 'SLA overdue', value: stats.totals.overdueCount, danger: stats.totals.overdueCount > 0 },
            { label: 'Unassigned', value: stats.totals.unassignedOpen },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2.5"
            >
              <span className="text-[10px] uppercase tracking-wide text-[#94a3b8]">{item.label}</span>
              <span
                className={clsx(
                  'text-label-md font-bold tabular',
                  item.danger ? 'text-danger' : 'text-ink',
                )}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-[10px] text-[#64748b]">
        <Icon name="info" className="text-[14px]" />
        You are signed in as <strong className="text-ink">{user?.name}</strong>. Priority and category overrides are
        recorded in each ticket&apos;s audit log.
        <span className="ml-auto hidden items-center gap-1 text-[#94a3b8] sm:inline-flex">
          <Icon name="lock" className="text-[13px]" /> Internal console · not author-facing
        </span>
      </div>
    </div>
  );
};
