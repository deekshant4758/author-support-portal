import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, EmptyState, ErrorState, InlineLoader, MetricCard, PageLoader, StatusPill } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ProductionStepper } from '../../components/ProductionStepper';
import { money, number, timeAgo } from '../../lib/format';

export const DashboardPage = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['author-summary'],
    queryFn: api.authors.me,
  });
  const answers = useQuery({
    queryKey: ['support-answers'],
    queryFn: api.knowledge.answers,
    staleTime: 5 * 60_000,
  });
  if (isLoading)
    return (
      <PageLoader
        label="Loading your dashboard…"
        hint="Fetching your books, royalties and recent tickets."
      />
    );
  if (isError || !data)
    return <ErrorState onRetry={() => void refetch()} message="We could not load your dashboard." />;
  const { author, metrics, recentTickets, books } = data;
  const productionBooks = books.filter((book) => book.status !== 'Published & Live');
  return (
    <div className="animate-fade-up">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[2rem] font-bold tracking-tight text-ink">
            Welcome back, {author.name.split(' ')[0]}.
          </h1>
          <p className="mt-1 text-body-md text-[#64748b]">Your books, royalties and support conversations.</p>
        </div>
        <Link to="/app/tickets/new" className="btn-primary self-start">
          <Icon name="add_comment" className="text-[18px]" /> Submit a query
        </Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Royalty earned" value={money(metrics.totalRoyaltyEarned)} icon="trending_up" />
        <MetricCard label="Royalty paid" value={money(metrics.royaltyPaid)} icon="account_balance" />
        <MetricCard label="Royalty pending" value={money(metrics.royaltyPending)} icon="hourglass_top" />
        <MetricCard label="Copies sold" value={number(metrics.totalCopiesSold)} icon="auto_stories" />
      </div>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] p-5">
            <h2 className="text-headline-sm text-ink">Recent tickets</h2>
            <Link to="/app/tickets" className="link text-body-sm">
              View all
            </Link>
          </div>
          {recentTickets.length === 0 ? (
            <EmptyState
              icon="forum"
              title="No tickets yet"
              message="When you submit a query, you can follow it here."
            />
          ) : (
            <ul className="divide-y divide-[#E2E8F0]">
              {recentTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    to={`/app/tickets/${ticket.id}`}
                    className="flex items-start justify-between gap-3 p-5 hover:bg-[#F8FAFC]"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{ticket.subject}</span>
                      <span className="mt-1 block text-body-sm text-[#64748b]">
                        {ticket.ticketNumber} · {timeAgo(ticket.lastMessageAt)}
                      </span>
                    </span>
                    <StatusPill status={ticket.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-5">
          {productionBooks.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-headline-sm text-ink">In production</h2>
              <div className="mt-4 space-y-5">
                {productionBooks.map((book) => (
                  <div key={book.id}>
                    <p className="font-semibold text-ink">{book.title}</p>
                    <p className="mt-1 text-body-sm text-[#64748b]">{book.status}</p>
                    {book.productionStage != null ? (
                      <div className="mt-3">
                        <ProductionStepper stage={book.productionStage} />
                      </div>
                    ) : null}
                    <Link
                      to={`/app/tickets/new?bookId=${book.id}`}
                      className="link mt-3 inline-block text-body-sm"
                    >
                      Ask about this book
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          <Card>
            <div className="border-b border-[#E2E8F0] p-5">
              <h2 className="text-headline-sm text-ink">Need a quick answer?</h2>
            </div>
            <div className="p-4">
              {answers.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <InlineLoader label="Loading answers…" />
                </div>
              ) : answers.isError ? (
                <div className="text-body-sm">
                  <p>We could not load the answers.</p>
                  <button type="button" className="link mt-2" onClick={() => void answers.refetch()}>
                    Try again
                  </button>
                </div>
              ) : (
                (answers.data ?? []).map((answer) => (
                  <details key={answer.id} className="group border-b border-[#E2E8F0] last:border-0">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 py-3 text-body-sm font-medium text-ink hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                      <span>{answer.question}</span>
                      <Icon
                        name="expand_more"
                        className="shrink-0 text-[18px] transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="px-1 pb-4 text-body-sm leading-relaxed text-[#64748b]">{answer.answer}</p>
                  </details>
                ))
              )}
              <Link to="/app/tickets/new" className="link mt-4 block text-center text-body-sm">
                Open a new query
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
