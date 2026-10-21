import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { BookCover } from '../../components/BookCover';
import { ProductionStepper } from '../../components/ProductionStepper';
import { Icon } from '../../components/Icon';
import {
  Card,
  EmptyState,
  ErrorState,
  MetricCard,
  PriorityPill,
  ProgressBar,
  StatusPill as StatusBadge,
} from '../../components/ui';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  formatDate,
  money,
  number,
  pluralize,
  timeAgo,
} from '../../lib/format';
import type { Book } from '../../lib/types';

const productionBook = (book: Book) => book.status !== 'Published & Live' && book.productionStage != null;

const QUICK_ANSWERS = [
  { label: 'When is my next royalty payout?', sectionId: 'royalty-timing' },
  { label: 'My Amazon listing is unavailable', sectionId: 'distribution-availability' },
];

export const DashboardPage = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['author-summary'],
    queryFn: api.authors.me,
  });
  const {
    data: knowledge,
    isLoading: knowledgeLoading,
    isError: knowledgeError,
    refetch: refetchKnowledge,
  } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: api.knowledge.list,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="animate-fade-up">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton mt-3 h-9 w-72" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="skeleton h-80 rounded-xl lg:col-span-2" />
          <div className="skeleton h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState onRetry={() => void refetch()} message="We could not load your dashboard." />;
  }

  const { author, metrics, recentTickets } = data;
  const books = recentTickets.flatMap((ticket) => (ticket.book ? [ticket.book] : []));
  const productionBooks = [...new Map(books.filter(productionBook).map((book) => [book.id, book])).values()];
  const openThreads = recentTickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS');
  const meetsThreshold = metrics.royaltyPending >= 1000;
  const latestPayout = [...books]
    .map((book) => book.lastRoyaltyPayoutDate)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-label-sm font-semibold uppercase tracking-[0.12em] text-[#64748b]">
            Author Desk · {author.tier}
          </div>
          <h1 className="mt-3 text-[2rem] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[2.25rem]">
            Welcome back, {author.name.split(' ')[0]}.
          </h1>
          <p className="mt-1.5 max-w-2xl text-body-md text-[#64748b]">
            {metrics.publishedCount > 0
              ? `${pluralize(metrics.publishedCount, 'title')} live and ${pluralize(metrics.bookCount, 'title')} in your catalogue. `
              : 'Your catalogue is being prepared. '}
            Track royalties and production, and reach the BookLeaf desk whenever you need.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/app/tickets/new" className="btn-primary">
            <Icon name="edit_note" className="text-[18px]" />
            Submit a query
          </Link>
          <Link to="/app/tickets" className="btn-secondary">
            <Icon name="forum" className="text-[18px]" />
            My tickets
            {metrics.openTickets > 0 ? (
              <span className="rounded bg-[#E5EEFF] px-1.5 py-0.5 text-[10px] font-bold text-primary tabular">
                {metrics.openTickets}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total royalty earned"
          value={money(metrics.totalRoyaltyEarned)}
          icon="trending_up"
          accent="text-ink"
          hint={`Across ${pluralize(metrics.bookCount, 'title')} · lifetime to date`}
        />
        <MetricCard
          label="Royalty paid out"
          value={money(metrics.royaltyPaid)}
          icon="account_balance"
          hint={latestPayout ? `Last payout ${formatDate(latestPayout)}` : 'No payout released yet'}
        />
        <MetricCard
          label="Pending payout"
          value={money(metrics.royaltyPending)}
          icon="hourglass_top"
          accent={metrics.royaltyPending > 0 ? 'text-tertiary' : 'text-ink'}
          hint={
            <span className="flex items-center gap-1.5">
              <span className={meetsThreshold ? 'text-[#047857]' : 'text-[#B45309]'}>
                {meetsThreshold ? 'Above ₹1,000 threshold' : 'Rolls over to next quarter'}
              </span>
              <span className="text-[#cbd5e1]">·</span>
              Quarterly cycle
            </span>
          }
        />
        <MetricCard
          label="Total copies sold"
          value={<>{number(metrics.totalCopiesSold)} <span className="text-sm font-normal text-[#64748b]">units</span></>}
          icon="auto_stories"
          hint={`${pluralize(metrics.bookCount, 'title')} in your catalogue`}
        />
      </div>

      {metrics.totalRoyaltyEarned > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5">
          <span className="text-label-sm font-semibold uppercase tracking-wider text-[#64748b]">Settlement progress</span>
          <ProgressBar value={metrics.royaltyPaid} max={metrics.totalRoyaltyEarned} className="max-w-xs flex-1" />
          <span className="text-body-sm text-[#64748b] tabular">
            {money(metrics.royaltyPaid)} of {money(metrics.totalRoyaltyEarned)} released
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-label-sm font-semibold text-primary">
            <Icon name="check_circle" className="text-[15px]" /> 80/20 author-first split
          </span>
        </div>
      ) : null}

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
        <Card>
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <div>
              <h2 className="text-headline-sm text-ink">Recent support threads</h2>
              <p className="text-body-sm text-[#64748b]">Replies appear here the moment the desk responds.</p>
            </div>
            <Link to="/app/tickets" className="link text-label-md">
              View all
            </Link>
          </div>

          {recentTickets.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon="forum"
                title="No support threads yet"
                message="When you raise a query, you can follow the whole conversation here."
                action={
                  <Link to="/app/tickets/new" className="btn-primary">
                    <Icon name="add_comment" className="text-[18px]" /> Raise your first query
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[#E2E8F0]">
              {recentTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    to={`/app/tickets/${ticket.id}`}
                    className="group flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-[#F8FAFC]"
                  >
                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#E5EEFF] text-primary">
                      <Icon name={CATEGORY_ICONS[ticket.category]} className="text-[19px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-label-md font-semibold text-ink group-hover:text-primary">
                          {ticket.subject}
                        </span>
                        {ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH' ? (
                          <PriorityPill priority={ticket.priority} className="!py-0.5 !text-[10px]" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#64748b]">
                        <span className="font-semibold text-[#475569]">{ticket.ticketNumber}</span>
                        <span>·</span>
                        <span>{CATEGORY_LABELS[ticket.category]}</span>
                        <span>·</span>
                        <span>{ticket.messageCount ?? 0} replies</span>
                        <span>·</span>
                        <span>{timeAgo(ticket.lastMessageAt)}</span>
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={ticket.status} />
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#94a3b8]">
                        <Icon name="schedule" className="text-[12px]" />
                        {ticket.slaBreached ? 'SLA overdue' : 'Within SLA'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon name="balance" className="text-[21px] text-primary" />
                <h2 className="text-headline-sm text-ink">BookLeaf 80/20 royalty policy</h2>
              </div>
            </div>
            <p className="mt-2 text-body-sm leading-relaxed text-[#64748b]">
              Authors keep 100% of intellectual rights and receive 80% of net profit. Net profit is MRP minus print cost,
              platform commission and shipping. Royalties are calculated quarterly and paid within 45 days of quarter end.
              Balances below ₹1,000 roll over.
            </p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <div className="border-b border-[#E2E8F0] px-5 py-4">
              <h2 className="text-headline-sm text-ink">In production</h2>
              <p className="text-body-sm text-[#64748b]">Live stage from the production desk.</p>
            </div>
            <div className="space-y-4 p-5">
              {productionBooks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center">
                  <Icon name="task_alt" className="text-[22px] text-primary" />
                  <p className="mt-1.5 text-label-md font-semibold text-ink">Nothing in production</p>
                  <p className="mt-0.5 text-body-sm text-[#64748b]">
                    Every title in your catalogue is live and available.
                  </p>
                </div>
              ) : (
                productionBooks.map((book) => (
                  <div key={book.id} className="rounded-lg border border-[#E2E8F0] p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="w-12 flex-shrink-0">
                        <BookCover title={book.title} author={author.name} genre={book.genre} compact minimal inProduction />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-label-md font-semibold text-ink">{book.title}</p>
                        <p className="text-[11px] text-[#64748b]">{book.status}</p>
                        <Link
                          to={`/app/tickets/new?bookId=${book.id}&subject=${encodeURIComponent(`Update on ${book.title}`)}`}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          Ask the production desk
                          <Icon name="arrow_forward" className="text-[13px]" />
                        </Link>
                      </div>
                    </div>
                    {book.productionStage ? (
                      <div className="mt-3">
                        <ProductionStepper stage={book.productionStage} />
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="bg-primary px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <Icon name="support_agent" className="text-[20px]" />
                <h2 className="text-headline-sm">Need a quick answer?</h2>
              </div>
              <p className="mt-1 text-body-sm text-white/70">
                Select a question to read the answer here.
              </p>
            </div>
            <div className="space-y-2 p-4">
              {QUICK_ANSWERS.map((prompt) => {
                const section = knowledge?.find((item) => item.id === prompt.sectionId);
                return (
                  <details key={prompt.sectionId} className="group border-b border-[#E2E8F0] last:border-b-0">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-2 py-3 text-body-sm font-medium text-ink hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                      <span>{prompt.label}</span>
                      <Icon
                        name="expand_more"
                        className="shrink-0 text-[18px] text-[#64748b] transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="px-2 pb-4 text-body-sm leading-relaxed text-[#64748b]">
                      {knowledgeLoading ? (
                        <p role="status">Loading answer…</p>
                      ) : knowledgeError || !section ? (
                        <div>
                          <p>We could not load this answer.</p>
                          <button type="button" onClick={() => void refetchKnowledge()} className="link mt-2">
                            Try again
                          </button>
                        </div>
                      ) : (
                        <p>{section.content}</p>
                      )}
                    </div>
                  </details>
                );
              })}
              <Link
                to="/app/tickets/new"
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#F1F5F9] px-3 py-2.5 text-label-md font-semibold text-ink transition-colors hover:bg-[#E5EEFF]"
              >
                <Icon name="add" className="text-[17px]" /> Open a new query
              </Link>
            </div>
          </Card>

        </div>
      </div>

<Card className="mt-5 p-5">
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-center gap-2">
      <Icon name="history" className="text-[21px] text-[#475569]" />
      <h2 className="text-headline-sm text-ink">Account snapshot</h2>
    </div>
    <span className="text-label-sm text-[#64748b]">
      {openThreads.length > 0 ? 'Active threads' : 'All settled'}
    </span>
  </div>
  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-body-sm sm:grid-cols-3 lg:grid-cols-6">
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[#94a3b8]">Author since</dt>
      <dd className="font-medium text-ink">{formatDate(author.joinedDate)}</dd>
    </div>
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[#94a3b8]">City</dt>
      <dd className="font-medium text-ink">{author.city}</dd>
    </div>
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[#94a3b8]">Package</dt>
      <dd className="font-medium text-ink">{author.tier}</dd>
    </div>
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[#94a3b8]">Payout account</dt>
      <dd className="font-medium text-ink">
        {author.bankName ?? 'Not linked'} {author.bankLast4 ? `· **${author.bankLast4}` : ''}
      </dd>
    </div>
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[#94a3b8]">Open threads</dt>
      <dd className="font-medium text-ink">{metrics.openTickets}</dd>
    </div>
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[#94a3b8]">Titles in production</dt>
      <dd className="font-medium text-ink">{metrics.productionCount}</dd>
    </div>
  </dl>
  <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-3">
    <span className="text-[11px] text-[#94a3b8]">Average first response under 2 hours</span>
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
      <Icon name="bolt" className="text-[14px]" /> Priority desk
    </span>
  </div>
</Card>
    </div>
  );
};
