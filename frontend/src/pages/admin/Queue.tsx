import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../store/toast';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingOverlay,
  MetricCard,
  PageLoader,
  Pagination,
  PriorityPill,
  Spinner,
  StatusPill,
  Tabs,
} from '../../components/ui';
import { CATEGORY_LABELS, PRIORITY_LABELS, timeAgo } from '../../lib/format';
import type { TicketFilters } from '../../lib/types';

type QueueTab = 'active' | 'closed';

const TAB_STATUSES: Record<QueueTab, string> = {
  active: 'OPEN,IN_PROGRESS',
  closed: 'RESOLVED,CLOSED',
};

const defaultFilters = (tab: QueueTab): TicketFilters => ({
  status: TAB_STATUSES[tab],
  sort: 'newest',
  page: 1,
  pageSize: 20,
});

export const AdminQueuePage = () => {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [tab, setTab] = useState<QueueTab>('active');
  const [filters, setFilters] = useState<TicketFilters>(defaultFilters('active'));
  const [reopening, setReopening] = useState<string | null>(null);
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: api.admin.stats });
  const query = useQuery({
    queryKey: ['tickets', 'admin', filters],
    queryFn: () => api.tickets.list(filters),
    placeholderData: keepPreviousData,
  });
  const change = (value: Partial<TicketFilters>) =>
    setFilters((current) => ({ ...current, ...value, page: 1 }));
  const switchTab = (next: QueueTab) => {
    setTab(next);
    setFilters(defaultFilters(next));
  };
  const reopen = async (id: string) => {
    if (reopening) return;
    setReopening(id);
    try {
      await api.tickets.reopen(id);
      await Promise.all(
        [['tickets'], ['ticket', id], ['admin-stats']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      push('Ticket reopened.', 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'The ticket could not be reopened.', 'error');
    } finally {
      setReopening(null);
    }
  };
  const totals = stats.data?.totals;
  const statuses = stats.data?.statuses;
  return (
    <div className="animate-fade-up">
      <h1 className="text-[2rem] font-bold tracking-tight text-ink">Ticket queue</h1>
      <p className="mt-1 text-body-md text-[#64748b]">
        Manage author queries and follow up on unresolved tickets.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Unresolved"
          value={totals?.unresolved ?? (stats.isLoading ? <Spinner className="h-5 w-5" /> : '—')}
          icon="pending_actions"
        />
        <MetricCard
          label="Unassigned"
          value={totals?.unassignedOpen ?? (stats.isLoading ? <Spinner className="h-5 w-5" /> : '—')}
          icon="person_add"
        />
        <MetricCard
          label="Overdue"
          value={totals?.overdueCount ?? (stats.isLoading ? <Spinner className="h-5 w-5" /> : '—')}
          icon="schedule"
        />
      </div>
      <Tabs
        className="mt-5 w-fit"
        value={tab}
        onChange={switchTab}
        options={[
          {
            value: 'active',
            label: 'Active',
            count: statuses ? statuses.OPEN + statuses.IN_PROGRESS : undefined,
          },
          {
            value: 'closed',
            label: 'Closed & resolved',
            count: statuses ? statuses.RESOLVED + statuses.CLOSED : undefined,
          },
        ]}
      />
      <Card className="mt-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="field-label">Search</span>
            <input
              type="search"
              maxLength={120}
              value={filters.search ?? ''}
              onChange={(event) => change({ search: event.target.value })}
              placeholder="Subject, ticket, author or book"
              className="input"
            />
          </label>
          <label className="block">
            <span className="field-label">Status</span>
            <select
              aria-label="Status"
              value={filters.status ?? ''}
              onChange={(event) => change({ status: event.target.value || undefined })}
              className="input"
            >
              {tab === 'active' ? (
                <>
                  <option value="OPEN,IN_PROGRESS">All active</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                </>
              ) : (
                <>
                  <option value="RESOLVED,CLOSED">All closed &amp; resolved</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </>
              )}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Category</span>
            <select
              aria-label="Category"
              value={filters.category ?? ''}
              onChange={(event) => change({ category: event.target.value || undefined })}
              className="input"
            >
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Priority</span>
            <select
              aria-label="Priority"
              value={filters.priority ?? ''}
              onChange={(event) => change({ priority: event.target.value || undefined })}
              className="input"
            >
              <option value="">All priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">From date</span>
            <input
              type="date"
              value={filters.dateFrom?.slice(0, 10) ?? ''}
              max={filters.dateTo?.slice(0, 10)}
              onChange={(event) =>
                change({ dateFrom: event.target.value ? `${event.target.value}T00:00:00` : undefined })
              }
              className="input"
            />
          </label>
          <label className="block">
            <span className="field-label">To date</span>
            <input
              type="date"
              value={filters.dateTo?.slice(0, 10) ?? ''}
              min={filters.dateFrom?.slice(0, 10)}
              onChange={(event) =>
                change({ dateTo: event.target.value ? `${event.target.value}T23:59:59.999` : undefined })
              }
              className="input"
            />
          </label>
          <label className="block">
            <span className="field-label">Sort by</span>
            <select
              aria-label="Sort by"
              value={filters.sort}
              onChange={(event) => change({ sort: event.target.value as TicketFilters['sort'] })}
              className="input"
            >
              <option value="newest">Newest first</option>
              <option value="updated">Recently updated</option>
              <option value="urgency">Priority, then oldest</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="link mt-3 text-body-sm"
          onClick={() => setFilters(defaultFilters(tab))}
        >
          Reset filters
        </button>
      </Card>
      <div className="relative mt-5" aria-busy={query.isFetching}>
        {query.isLoading ? (
          <PageLoader label="Loading the ticket queue…" hint="Fetching the latest author queries." />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message="We could not load the ticket queue." />
        ) : query.data?.items.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={tab === 'closed' ? 'No closed tickets' : 'No tickets found'}
            message="Try changing your filters."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] uppercase tracking-wide text-[#64748b]">
                  <tr>
                    {['Ticket', 'Author', 'Priority', 'Status', 'Created', ...(tab === 'closed' ? [''] : [])].map((label) => (
                      <th key={label} className="px-4 py-3 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {query.data?.items.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-[#F8FAFC]">
                      <td className="min-w-[240px] px-4 py-4">
                        <Link
                          to={`/admin/tickets/${ticket.id}`}
                          className="font-semibold text-ink hover:text-primary"
                        >
                          {ticket.subject}
                        </Link>
                        <p className="mt-1 text-[11px] text-[#64748b]">
                          {ticket.ticketNumber} · {CATEGORY_LABELS[ticket.category]}
                        </p>
                        {ticket.slaBreached ? (
                          <p className="mt-1 text-[11px] font-semibold text-danger">Overdue</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <p className="whitespace-nowrap">{ticket.author?.name}</p>
                        <p className="mt-1 text-[11px] text-[#64748b]">
                          {ticket.assignee ? `Assigned to ${ticket.assignee.name}` : 'Unassigned'}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <PriorityPill priority={ticket.priority} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill status={ticket.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#64748b]">
                        {timeAgo(ticket.createdAt)}
                      </td>
                      {tab === 'closed' ? (
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            className="btn-secondary whitespace-nowrap"
                            disabled={reopening !== null}
                            onClick={() => void reopen(ticket.id)}
                          >
                            {reopening === ticket.id ? <Spinner className="h-4 w-4" /> : null}
                            Reopen
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={query.data?.meta.page ?? 1}
              pages={query.data?.meta.pages ?? 1}
              total={query.data?.meta.total ?? 0}
              disabled={query.isFetching}
              onChange={(page) => setFilters((current) => ({ ...current, page }))}
            />
          </Card>
        )}
        <LoadingOverlay show={query.isFetching && !query.isLoading} label="Applying filters…" />
      </div>
    </div>
  );
};
