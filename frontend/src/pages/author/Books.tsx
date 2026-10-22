import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { BookCover } from '../../components/BookCover';
import { ProductionStepper } from '../../components/ProductionStepper';
import { Card, EmptyState, ErrorState } from '../../components/ui';
import { formatDate, money, number } from '../../lib/format';

export const BooksPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const query = useQuery({ queryKey: ['books'], queryFn: api.books.list });
  const books = (query.data ?? []).filter((book) => {
    const text = search.trim().toLowerCase();
    return (
      (!text || `${book.title} ${book.isbn} ${book.genre}`.toLowerCase().includes(text)) &&
      (filter === 'ALL' ||
        (filter === 'LIVE' ? book.status === 'Published & Live' : book.status !== 'Published & Live'))
    );
  });
  return (
    <div className="animate-fade-up">
      <h1 className="text-[2rem] font-bold tracking-tight text-ink">My Books</h1>
      <p className="mt-1 text-body-md text-[#64748b]">Your catalogue, sales and royalties.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="field-label">Search books</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title, ISBN or genre"
            className="input"
          />
        </label>
        <label>
          <span className="field-label">Status</span>
          <select
            aria-label="Status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="input"
          >
            <option value="ALL">All books</option>
            <option value="LIVE">Published & Live</option>
            <option value="PRODUCTION">In production</option>
          </select>
        </label>
      </div>
      <div className="mt-5 space-y-5">
        {query.isLoading ? (
          <div className="skeleton h-64 rounded-xl" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message="We could not load your books." />
        ) : books.length === 0 ? (
          <EmptyState
            icon="menu_book"
            title="No books found"
            message="Your books will appear here. Try changing your search or status filter."
          />
        ) : (
          books.map((book) => (
            <Card key={book.id} className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div aria-hidden="true" className="w-16 shrink-0 sm:w-20">
                  <BookCover
                    title={book.title}
                    author={user?.name ?? ''}
                    genre={book.genre}
                    compact
                    minimal
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm text-primary">{book.status}</p>
                  <h2 className="mt-1 text-headline-md text-ink">{book.title}</h2>
                  <p className="mt-1 text-body-sm text-[#64748b]">{book.genre}</p>
                  <p className="mt-1 break-all text-body-sm text-[#64748b]">ISBN {book.isbn}</p>
                  <p className="mt-1 text-body-sm text-[#64748b]">
                    {book.publicationDate
                      ? `Published ${formatDate(book.publicationDate)}`
                      : 'Not published yet'}
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#E2E8F0] pt-5 sm:grid-cols-3 xl:grid-cols-5">
                {[
                  ['MRP', money(book.mrp)],
                  ['Copies sold', number(book.totalCopiesSold)],
                  ['Royalty earned', money(book.totalRoyaltyEarned)],
                  ['Royalty paid', money(book.royaltyPaid)],
                  ['Royalty pending', money(book.royaltyPending)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] text-[#64748b]">{label}</dt>
                    <dd className="mt-1 font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              {book.status !== 'Published & Live' && book.productionStage != null ? (
                <div className="mt-5 border-t border-[#E2E8F0] pt-5">
                  <ProductionStepper stage={book.productionStage} />
                  {book.productionNote ? (
                    <p className="mt-3 text-body-sm text-[#64748b]">{book.productionNote}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4">
                <p className="text-body-sm text-[#64748b]">
                  {book.availableOn.length > 0
                    ? `Available on ${book.availableOn.join(', ')}`
                    : 'Distribution is being prepared.'}
                </p>
                <Link to={`/app/tickets/new?bookId=${book.id}`} className="link text-body-sm">
                  Ask about this book
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
