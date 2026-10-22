import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, EmptyState, ErrorState, LoadingOverlay, PageLoader, Pagination, StatusPill } from '../../components/ui';
import { timeAgo } from '../../lib/format';

export const TicketsPage = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filters = {
    status: status || undefined,
    search: search.trim() || undefined,
    page,
    pageSize: 20,
    sort: 'updated' as const,
  };
  const query = useQuery({
    queryKey: ['tickets', 'author', filters],
    queryFn: () => api.tickets.list(filters),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-bold tracking-tight text-ink">My Tickets</h1>
          <p className="mt-1 text-body-md text-[#64748b]">
            Follow your queries and read replies from BookLeaf.
          </p>
        </div>
        <Link to="/app/tickets/new" className="btn-primary">
          Submit a query
        </Link>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="field-label">Search tickets</span>
          <input
            type="search"
            maxLength={120}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Subject or ticket number"
            className="input"
          />
        </label>
        <label>
          <span className="field-label">Status</span>
          <select
            aria-label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="input"
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
      </div>
      <div className="relative mt-5 space-y-3" aria-busy={query.isFetching}>
        {query.isLoading ? (
          <PageLoader label="Loading your tickets…" hint="Fetching your support conversations." />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message="We could not load your tickets." />
        ) : query.data?.items.length === 0 ? (
          <EmptyState
            icon="forum"
            title="No tickets found"
            message="Submit a query or change your filters."
          />
        ) : (
          <>
            {query.data?.items.map((ticket) => (
              <Link key={ticket.id} to={`/app/tickets/${ticket.id}`} className="block">
                <Card hover className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-ink">{ticket.subject}</h2>
                    <StatusPill status={ticket.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-body-sm text-[#64748b]">{ticket.description}</p>
                  <p className="mt-3 text-[11px] text-[#64748b]">
                    {ticket.ticketNumber} · {ticket.book?.title ?? 'General / Account Level'} · Updated{' '}
                    {timeAgo(ticket.lastMessageAt)}
                  </p>
                </Card>
              </Link>
            ))}
            <Pagination
              page={query.data?.meta.page ?? 1}
              pages={query.data?.meta.pages ?? 1}
              total={query.data?.meta.total ?? 0}
              disabled={query.isFetching}
              onChange={setPage}
            />
          </>
        )}
        <LoadingOverlay show={query.isPlaceholderData && !query.isError} />
      </div>
    </div>
  );
};
