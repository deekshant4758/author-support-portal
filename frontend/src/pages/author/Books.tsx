import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useToast } from '../../store/toast';
import { BookCover } from '../../components/BookCover';
import { ProductionStepper } from '../../components/ProductionStepper';
import { Icon } from '../../components/Icon';
import {
  Card,
  CopyButton,
  Divider,
  EmptyState,
  ErrorState,
  Modal,
  Pill,
  ProgressBar,
} from '../../components/ui';
import {
  formatDate,
  money,
  number,
  pluralize,
} from '../../lib/format';
import type { Book } from '../../lib/types';

type Filter = 'ALL' | 'LIVE' | 'PRODUCTION';

const csvEscape = (value: string | number | null | undefined) => {
  if (value == null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const BooksPage = () => {
  const { user } = useAuth();
  const { push } = useToast();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Book | null>(null);

  const { data: books, isLoading, isError, refetch } = useQuery({
    queryKey: ['books'],
    queryFn: api.books.list,
  });

  const filtered = useMemo(() => {
    if (!books) return [];
    const query = search.trim().toLowerCase();
    return books.filter((book) => {
      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'LIVE' ? book.status === 'Published & Live' : book.status !== 'Published & Live');
      const matchesSearch =
        !query ||
        book.title.toLowerCase().includes(query) ||
        book.isbn.toLowerCase().includes(query) ||
        book.genre.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [books, filter, search]);

  const totals = useMemo(() => {
    const source = books ?? [];
    return source.reduce(
      (acc, book) => ({
        earned: acc.earned + book.totalRoyaltyEarned,
        paid: acc.paid + book.royaltyPaid,
        pending: acc.pending + book.royaltyPending,
        copies: acc.copies + book.totalCopiesSold,
        live: acc.live + (book.status === 'Published & Live' ? 1 : 0),
      }),
      { earned: 0, paid: 0, pending: 0, copies: 0, live: 0 },
    );
  }, [books]);

  const exportCsv = () => {
    if (!filtered.length) {
      push('There are no books in the current view to export.', 'info');
      return;
    }
    const headers = [
      'Title',
      'ISBN',
      'Genre',
      'Status',
      'Publication date',
      'MRP',
      'Royalty per copy',
      'Copies sold',
      'Total royalty earned',
      'Royalty paid',
      'Royalty pending',
      'Last payout',
      'Print partner',
      'Channels',
    ];
    const rows = filtered.map((book) =>
      [
        book.title,
        book.isbn,
        book.genre,
        book.status,
        book.publicationDate,
        book.mrp,
        book.royaltyPerCopy,
        book.totalCopiesSold,
        book.totalRoyaltyEarned,
        book.royaltyPaid,
        book.royaltyPending,
        book.lastRoyaltyPayoutDate,
        book.printPartner,
        book.availableOn.join('; '),
      ]
        .map(csvEscape)
        .join(','),
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookleaf-royalty-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    push('Royalty statement exported as CSV.', 'success');
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-36 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (isError) return <ErrorState onRetry={() => void refetch()} message="We could not load your catalogue." />;

  const allBooks = books ?? [];
  const liveCount = allBooks.filter((book) => book.status === 'Published & Live').length;
  const productionCount = allBooks.length - liveCount;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm font-semibold uppercase tracking-[0.14em] text-primary">Catalogue terminal</p>
          <h1 className="mt-1.5 text-[2rem] font-bold leading-tight tracking-[-0.03em] text-ink">My Books</h1>
          <p className="mt-1 text-body-md text-[#64748b]">
            {pluralize(allBooks.length, 'title')} · {liveCount} live · {productionCount} in production. Royalty figures
            are updated from reconciled sales.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={exportCsv} className="btn-secondary">
            <Icon name="download" className="text-[18px] text-primary" />
            Royalty statement
            <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#64748b]">CSV</span>
          </button>
          <Link to="/app/tickets/new" className="btn-primary">
            <Icon name="add_comment" className="text-[18px]" />
            Raise a query
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Lifetime royalty', value: money(totals.earned), icon: 'trending_up', hint: 'Across all titles' },
          { label: 'Released to bank', value: money(totals.paid), icon: 'account_balance', hint: 'Settled payouts' },
          {
            label: 'Pending release',
            value: money(totals.pending),
            icon: 'hourglass_top',
            hint: totals.pending >= 1000 ? 'Above ₹1,000 threshold' : 'Below threshold · rolls over',
          },
          { label: 'Copies sold', value: number(totals.copies), icon: 'auto_stories', hint: 'Reconciled units' },
        ].map((item) => (
          <Card key={item.label} className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="micro-label">{item.label}</p>
              <p className="mt-2 text-[1.4rem] font-bold leading-none tracking-tight text-ink tabular">{item.value}</p>
              <p className="mt-1.5 text-[11px] text-[#64748b]">{item.hint}</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748b]">
              <Icon name={item.icon} className="text-[18px]" />
            </span>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1">
          {[
            { value: 'ALL' as Filter, label: `All books (${allBooks.length})` },
            { value: 'LIVE' as Filter, label: `Published & live (${liveCount})` },
            { value: 'PRODUCTION' as Filter, label: `In production (${productionCount})` },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={
                filter === option.value
                  ? 'rounded-md bg-primary px-3 py-1.5 text-label-md font-semibold text-white shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-label-md text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-ink'
              }
            >
              {option.label}
            </button>
          ))}
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
            placeholder="Search by title, ISBN or genre…"
            className="input pl-9"
            aria-label="Search books"
          />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="No titles match this view"
            message={
              allBooks.length === 0
                ? 'Your catalogue is empty. New titles appear here once your manuscript is onboarded.'
                : 'Try a different filter or search term — your full catalogue is still available.'
            }
            action={
              allBooks.length > 0 ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setFilter('ALL');
                    setSearch('');
                  }}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          filtered.map((book) => {
            const live = book.status === 'Published & Live';
            const pending = book.royaltyPending;
            return (
              <Card key={book.id} hover className="overflow-hidden">
                {!live ? <div className="h-0.5 w-full bg-tertiary" /> : null}
                <div className="flex flex-col gap-5 p-5 lg:flex-row">
                  <div className="flex gap-4 lg:w-44 lg:flex-col">
                    <div className="w-24 flex-shrink-0 sm:w-32 lg:w-full">
                      <BookCover
                        title={book.title}
                        author={user?.name ?? 'Author'}
                        genre={book.genre}
                        inProduction={!live}
                      />
                    </div>
                    <div className="min-w-0 pt-1 lg:pt-0">
                      <p className="text-[11px] text-[#64748b]">{book.genre}</p>
                      <p className="mt-0.5 text-[11px] text-[#94a3b8]">
                        {live ? `Published ${formatDate(book.publicationDate)}` : 'Not yet published'}
                      </p>
                      <p className="mt-1 text-[10px] text-[#94a3b8]">
                        {book.printPartner ? `Print: ${book.printPartner}` : 'Print partner pending'}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <Pill
                            className={
                              live
                                ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                                : 'border-ai-border bg-ai-soft text-ai-deep'
                            }
                            dot={live ? 'bg-[#059669]' : 'bg-ai'}
                          >
                            {book.status}
                          </Pill>
                          {!live && book.productionStage ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                              Stage {book.productionStage} of 9
                            </span>
                          ) : null}
                          {live && pending === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#047857]">
                              <Icon name="task_alt" className="text-[13px]" /> Fully settled
                            </span>
                          ) : null}
                        </div>
                        <h2 className="text-headline-md text-ink">{book.title}</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">ISBN</span>
                          <code className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] font-semibold text-[#334155]">
                            {book.isbn}
                          </code>
                          <CopyButton value={book.isbn} label="Copy ISBN" />
                          {book.printPartner ? (
                            <span className="text-[11px] text-[#94a3b8]">· Printed by {book.printPartner}</span>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
                        Paperback
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#E2E8F0] sm:grid-cols-5">
                      {[
                        { label: 'MRP', value: money(book.mrp), tone: 'text-ink' },
                        {
                          label: 'Copies sold',
                          value: number(book.totalCopiesSold),
                          tone: 'text-ink',
                        },
                        {
                          label: 'Royalty earned',
                          value: money(book.totalRoyaltyEarned),
                          tone: 'text-primary',
                        },
                        { label: 'Paid to date', value: money(book.royaltyPaid), tone: 'text-ink' },
                        {
                          label: 'Pending',
                          value: money(book.royaltyPending),
                          tone: pending > 0 ? 'text-tertiary' : 'text-[#64748b]',
                        },
                      ].map((metric) => (
                        <div key={metric.label} className="bg-[#F8FAFC] px-3 py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">
                            {metric.label}
                          </p>
                          <p className={`mt-1 text-[15px] font-bold tracking-tight tabular ${metric.tone}`}>
                            {metric.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {live && book.totalRoyaltyEarned > 0 ? (
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar
                          value={book.royaltyPaid}
                          max={book.totalRoyaltyEarned}
                          className="max-w-[220px] flex-1"
                        />
                        <span className="text-[10px] text-[#94a3b8] tabular">
                          {Math.round((book.royaltyPaid / book.totalRoyaltyEarned) * 100)}% released
                        </span>
                      </div>
                    ) : null}

                    {!live && book.productionStage ? (
                      <div className="mt-4 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF]/60 p-3.5">
                        <ProductionStepper stage={book.productionStage} />
                        {book.productionNote ? (
                          <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-[#5B21B6]">
                            <Icon name="info" className="mt-px text-[14px]" />
                            {book.productionNote}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#E2E8F0] pt-3">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">Channels</span>
                      {book.availableOn.length > 0 ? (
                        book.availableOn.map((channel) => (
                          <span
                            key={channel}
                            className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[9px] font-medium text-[#475569]"
                          >
                            <span className="h-1 w-1 rounded-full bg-[#059669]" />
                            {channel}
                          </span>
                        ))
                      ) : (
                        <span className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-1.5 py-0.5 text-[9px] font-medium text-[#B45309]">
                          Not listed yet
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setSelected(book)} className="btn-secondary !py-2">
                          <Icon name="receipt_long" className="text-[17px]" />
                          Royalty breakdown
                        </button>
                        <Link
                          to={`/app/tickets/new?bookId=${book.id}`}
                          className="btn-ghost !py-2"
                        >
                          <Icon name="help_center" className="text-[17px]" />
                          Raise a query for this book
                        </Link>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#94a3b8]">
                        <Icon name="verified_user" className="text-[13px]" />
                        Data reconciled by BookLeaf finance
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Royalty statement · ${selected.title}` : 'Royalty statement'}
        description="How this title's earnings are calculated and settled."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
              Close
            </button>
            {selected ? (
              <Link
                to={`/app/tickets/new?bookId=${selected.id}&subject=${encodeURIComponent(
                  `Question about the royalty statement for ${selected.title}`,
                )}`}
                className="btn-primary"
              >
                <Icon name="help_center" className="text-[18px]" /> Ask about this statement
              </Link>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#94a3b8]">Net royalty pending</p>
                <p className="text-headline-md font-bold text-tertiary tabular">{money(selected.royaltyPending)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-[#94a3b8]">Last payout</p>
                <p className="text-label-md font-semibold text-ink">{formatDate(selected.lastRoyaltyPayoutDate)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ['Royalty per copy', money(selected.royaltyPerCopy)],
                ['MRP', money(selected.mrp)],
                ['Copies sold', number(selected.totalCopiesSold)],
                ['Lifetime royalty', money(selected.totalRoyaltyEarned)],
                ['Paid to date', money(selected.royaltyPaid)],
                ['Pending release', money(selected.royaltyPending)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#E2E8F0] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[#94a3b8]">{label}</p>
                  <p className="mt-0.5 text-label-md font-semibold text-ink tabular">{value}</p>
                </div>
              ))}
            </div>

            <Divider label="How it is calculated" />
            <div className="space-y-2 text-body-sm leading-relaxed text-[#475569]">
              <p>
                Net profit = MRP − printing cost − platform commission − shipping. You receive{' '}
                <strong className="text-ink">80% of net profit</strong>; BookLeaf retains 20%.
              </p>
              <p>
                Royalties are calculated quarterly and released within 45 days of quarter end. A balance below ₹1,000
                rolls into the next cycle. Payouts go to the bank account linked in your profile.
              </p>
              <p className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
                <Icon name="info" className="text-[14px]" />
                Marketplace data is reconciled in billing cycles, so the last few days of a month may appear in the
                following statement.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Distribution channels</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selected.availableOn.length > 0 ? (
                  selected.availableOn.map((channel) => (
                    <span
                      key={channel}
                      className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] text-[#475569]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {channel}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-[#94a3b8]">Not listed on any channel yet.</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2.5">
              <span className="text-[11px] text-[#64748b]">Settlement status</span>
              <Pill
                className={
                  selected.royaltyPending > 0
                    ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                    : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                }
                dot={selected.royaltyPending > 0 ? 'bg-[#F59E0B]' : 'bg-[#059669]'}
              >
                {selected.royaltyPending > 0 ? 'Pending release' : 'Fully settled'}
              </Pill>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
