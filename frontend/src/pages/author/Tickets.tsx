import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { Icon } from '../../components/Icon';
import {
  Card,
  EmptyState,
  ErrorState,
  PriorityPill,
  StatusPill,
} from '../../components/ui';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  formatDuration,
  timeAgo,
} from '../../lib/format';
import type { TicketStatus } from '../../lib/types';

type Tab = 'ALL' | TicketStatus;

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export const TicketsPage = () => {
  const [tab, setTab] = useState<Tab>('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'author'],
    queryFn: () => api.tickets.list({ pageSize: 100, sort: 'updated' }),
  });

  const tickets = data?.items ?? [];

  const counts = useMemo(
    () =>
      tickets.reduce(
        (acc, ticket) => {
          acc[ticket.status] = (acc[ticket.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [tickets],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesTab = tab === 'ALL' || ticket.status === tab;
      const matchesSearch =
        !query ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.ticketNumber.toLowerCase().includes(query) ||
        CATEGORY_LABELS[ticket.category].toLowerCase().includes(query) ||
        (ticket.book?.title.toLowerCase().includes(query) ?? false);
      return matchesTab && matchesSearch;
    });
  }, [tickets, tab, search]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-9 w-56" />
        <div className="skeleton h-10 w-full max-w-xl" />
        {[0, 1, 2].map((index) => (
          <div key={index} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) return <ErrorState onRetry={() => void refetch()} message="We could not load your tickets." />;

  const openCount = (counts.OPEN ?? 0) + (counts.IN_PROGRESS ?? 0);

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm font-semibold uppercase tracking-[0.14em] text-primary">Support history</p>
          <h1 className="mt-1.5 text-[2rem] font-bold leading-tight tracking-[-0.03em] text-ink">My Tickets</h1>
          <p className="mt-1 text-body-md text-[#64748b]">
            Every query, response and status change in one thread. Replies appear live.
          </p>
        </div>
        <Link to="/app/tickets/new" className="btn-primary self-start sm:self-auto">
          <Icon name="add_comment" className="text-[18px]" />
          Submit a query
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Needs attention',
            value: openCount,
            hint: 'Open or being worked on',
            icon: 'pending_actions',
            tone: 'text-[#B45309]',
            bg: 'bg-[#FFFBEB]',
          },
          {
            label: 'Resolved',
            value: counts.RESOLVED ?? 0,
            hint: 'Awaiting your confirmation',
            icon: 'task_alt',
            tone: 'text-[#047857]',
            bg: 'bg-[#ECFDF5]',
          },
          {
            label: 'Closed',
            value: counts.CLOSED ?? 0,
            hint: 'Archived threads',
            icon: 'done_all',
            tone: 'text-[#475569]',
            bg: 'bg-[#F1F5F9]',
          },
        ].map((item) => (
          <Card key={item.label} className="flex items-center gap-3 p-4">
            <span className={clsx('flex h-10 w-10 items-center justify-center rounded-lg', item.bg, item.tone)}>
              <Icon name={item.icon} className="text-[20px]" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">{item.label}</p>
              <p className={clsx('text-headline-md font-bold tabular', item.tone)}>{item.value}</p>
              <p className="text-[10px] text-[#94a3b8]">{item.hint}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white p-1">
          {TABS.map((option) => {
            const count = option.value === 'ALL' ? tickets.length : counts[option.value] ?? 0;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTab(option.value)}
                aria-pressed={tab === option.value}
                className={clsx(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-label-md font-medium transition-colors',
                  tab === option.value
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-ink',
                )}
              >
                {option.label}
                <span
                  className={clsx(
                    'rounded px-1.5 text-[10px] font-bold tabular',
                    tab === option.value ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748b]',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#94a3b8]"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tickets…"
            className="input pl-9"
            aria-label="Search tickets"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={tickets.length === 0 ? 'forum' : 'search_off'}
            title={tickets.length === 0 ? 'No support threads yet' : 'No tickets in this view'}
            message={
              tickets.length === 0
                ? 'Raise a query about royalties, ISBNs, printing, distribution or production. You will see every reply here.'
                : 'Try another status or clear your search to see the rest of your threads.'
            }
            action={
              tickets.length === 0 ? (
                <Link to="/app/tickets/new" className="btn-primary">
                  <Icon name="add_comment" className="text-[18px]" /> Submit your first query
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setTab('ALL');
                    setSearch('');
                  }}
                >
                  Clear filters
                </button>
              )
            }
          />
        ) : (
          filtered.map((ticket) => (
            <Link key={ticket.id} to={`/app/tickets/${ticket.id}`} className="block group">
              <Card hover className="relative overflow-hidden p-4 sm:p-5">
                {ticket.slaBreached && (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') ? (
                  <span className="absolute inset-y-0 left-0 w-[3px] bg-danger" />
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <span
                    className={clsx(
                      'mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                      ticket.slaBreached && (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS')
                        ? 'bg-danger-soft text-danger'
                        : 'bg-[#E5EEFF] text-primary',
                    )}
                  >
                    <Icon name={CATEGORY_ICONS[ticket.category]} className="text-[20px]" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] tabular">
                        {ticket.ticketNumber}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-[#cbd5e1]" />
                      <span className="text-[10px] text-[#94a3b8]">{CATEGORY_LABELS[ticket.category]}</span>
                      {ticket.book ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-[#cbd5e1]" />
                          <span className="truncate text-[10px] text-[#94a3b8]">{ticket.book.title}</span>
                        </>
                      ) : null}
                    </div>
                    <h2 className="mt-1 text-headline-sm text-ink transition-colors group-hover:text-primary">
                      {ticket.subject}
                    </h2>
                    <p className="mt-1 line-clamp-2 max-w-3xl text-body-sm text-[#64748b]">{ticket.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#94a3b8]">
                      <span className="inline-flex items-center gap-1">
                        <Icon name="chat_bubble" className="text-[13px]" />
                        {ticket.messageCount ?? 0} replies
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="update" className="text-[13px]" />
                        Updated {timeAgo(ticket.lastMessageAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="schedule" className="text-[13px]" />
                        Raised {formatDuration(ticket.ageMinutes)} ago
                      </span>
                      {ticket.slaBreached && (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-danger">
                          <Icon name="alarm" className="text-[13px]" />
                          SLA overdue
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
                    <StatusPill status={ticket.status} />
                    {ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH' ? (
                      <PriorityPill priority={ticket.priority} />
                    ) : null}
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-[#94a3b8] group-hover:text-primary sm:ml-0">
                      Open thread
                      <Icon name="arrow_forward" className="text-[14px]" />
                    </span>
                  </div>
                </div>

                {ticket.book ? (
                  <div className="mt-3 flex items-center gap-2 border-t border-[#E2E8F0] pt-3">
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-[#E5EEFF] text-primary">
                      <Icon name="menu_book" className="text-[11px]" />
                    </span>
                    <span className="text-[10px] text-[#64748b]">
                      {ticket.book.title} · {ticket.book.genre}
                    </span>
                    {ticket.assignee ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-[#94a3b8]">
                        <Icon name="support_agent" className="text-[13px]" />
                        Handled by {ticket.assignee.name}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};
