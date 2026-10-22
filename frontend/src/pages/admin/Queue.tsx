import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Card,
  EmptyState,
  ErrorState,
  MetricCard,
  Pagination,
  PriorityPill,
  StatusPill,
} from '../../components/ui';
import { CATEGORY_LABELS, PRIORITY_LABELS, timeAgo } from '../../lib/format';
import type { TicketFilters } from '../../lib/types';

export const AdminQueuePage = () => {
  const [filters, setFilters] = useState<TicketFilters>({
    status: 'OPEN,IN_PROGRESS',
    sort: 'urgency',
    page: 1,
    pageSize: 20,
  });
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: api.admin.stats });
  const query = useQuery({
    queryKey: ['tickets', 'admin', filters],
    queryFn: () => api.tickets.list(filters),
    placeholderData: keepPreviousData,
  });
  const change = (value: Partial<TicketFilters>) =>
    setFilters((current) => ({ ...current, ...value, page: 1 }));
  const totals = stats.data?.totals;
  return (
    <div className="animate-fade-up">
      <h1 className="text-[2rem] font-bold tracking-tight text-ink">Ticket queue</h1>
      <p className="mt-1 text-body-md text-[#64748b]">
        Manage author queries and follow up on unresolved tickets.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Unresolved" value={totals?.unresolved ?? '—'} icon="pending_actions" />
        <MetricCard label="Unassigned" value={totals?.unassignedOpen ?? '—'} icon="person_add" />
        <MetricCard label="Overdue" value={totals?.overdueCount ?? '—'} icon="schedule" />
      </div>
      <Card className="mt-5 p-4">
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
              <option value="OPEN,IN_PROGRESS">Unresolved</option>
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
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
              <option value="urgency">Priority, then oldest</option>
              <option value="oldest">Oldest first</option>
              <option value="newest">Newest first</option>
              <option value="updated">Recently updated</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="link mt-3 text-body-sm"
          onClick={() => setFilters({ status: 'OPEN,IN_PROGRESS', sort: 'urgency', page: 1, pageSize: 20 })}
        >
          Reset filters
        </button>
      </Card>
      <div className="mt-5" aria-busy={query.isFetching}>
        {query.isLoading ? (
          <div className="skeleton h-64 rounded-xl" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message="We could not load the ticket queue." />
        ) : query.data?.items.length === 0 ? (
          <EmptyState icon="inbox" title="No tickets found" message="Try changing your filters." />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] uppercase tracking-wide text-[#64748b]">
                  <tr>
                    {['Ticket', 'Author', 'Priority', 'Status', 'Created'].map((label) => (
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
      </div>
    </div>
  );
};
