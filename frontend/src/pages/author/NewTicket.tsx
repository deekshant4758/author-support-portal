import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useToast } from '../../store/toast';
import { BookCover } from '../../components/BookCover';
import { Icon } from '../../components/Icon';
import { Card, ErrorState, Pill } from '../../components/ui';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  money,
  pluralize,
} from '../../lib/format';
import type { TicketCategory } from '../../lib/types';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as TicketCategory[];

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const NewTicketPage = () => {
  const navigate = useNavigate();
  const { push } = useToast();
  const [params] = useSearchParams();
  const fileInput = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const { data: books, isLoading, isError, refetch } = useQuery({
    queryKey: ['books'],
    queryFn: api.books.list,
  });
  const { data: knowledge } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: api.knowledge.list,
    staleTime: 5 * 60_000,
  });

  const [bookId, setBookId] = useState(params.get('bookId') ?? '');
  const [category, setCategory] = useState<TicketCategory | 'AUTO'>('AUTO');
  const [subject, setSubject] = useState(params.get('subject') ?? '');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; size: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = {
    subject: subject.trim().length < 5 ? 'Give your query a clear subject (at least 5 characters).' : null,
    description:
      description.trim().length < 20 ? 'Add a little more detail (at least 20 characters).' : null,
  };
  const valid = !validation.subject && !validation.description;

  const selectedBook = books?.find((book) => book.id === bookId) ?? null;

  const relatedPolicy = useMemo(() => {
    if (!knowledge) return [];
    if (category !== 'AUTO') {
      return knowledge.filter((section) => section.categories.includes(category)).slice(0, 2);
    }
    return knowledge.filter((section) => ['royalty-timing', 'distribution-availability'].includes(section.id));
  }, [knowledge, category]);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      push('Attachments are limited to 10 MB in this demo.', 'error');
      return;
    }
    setAttachment({ name: file.name, size: formatBytes(file.size) });
    push('Attachment metadata added. File upload is UI-only in this build.', 'info');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!valid || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await api.tickets.create({
        bookId: bookId || null,
        subject: subject.trim(),
        description: description.trim(),
        category,
        attachmentName: attachment?.name ?? null,
        attachmentSize: attachment?.size ?? null,
      });
      const ticket = response.data;
      push(
        `${ticket.ticketNumber} created · routed to ${CATEGORY_LABELS[ticket.category]} with ${ticket.priority.toLowerCase()} priority.`,
        'success',
      );
      navigate(`/app/tickets/${ticket.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'We could not submit your ticket. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="skeleton h-10 w-64" />
          <div className="skeleton h-40 rounded-xl" />
          <div className="skeleton h-80 rounded-xl" />
        </div>
        <div className="skeleton h-72 rounded-xl" />
      </div>
    );
  }

  if (isError) return <ErrorState onRetry={() => void refetch()} message="We could not load your books." />;

  const availableBooks = books ?? [];

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#94a3b8]">
        <Link to="/app/dashboard" className="hover:text-primary">
          Author desk
        </Link>
        <Icon name="chevron_right" className="text-[13px]" />
        <Link to="/app/tickets" className="hover:text-primary">
          My tickets
        </Link>
        <Icon name="chevron_right" className="text-[13px]" />
        <span className="font-medium text-[#475569]">New query</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-label-sm font-semibold uppercase tracking-[0.14em] text-primary">Support desk</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#047857]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#059669]" />
              Desk active
            </span>
          </div>
          <h1 className="mt-1.5 text-[2rem] font-bold leading-tight tracking-[-0.03em] text-ink">
            Raise a support query
          </h1>
          <p className="mt-1 max-w-2xl text-body-md text-[#64748b]">
            Tell us what happened. Your query is classified and prioritised automatically, then routed to the right
            specialist.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[11px] text-[#475569]">
          <Icon name="schedule" className="text-[15px] text-primary" /> First response under 24h
        </span>
      </div>

      <form onSubmit={submit} className="mt-6 grid items-start gap-5 lg:grid-cols-[1fr_320px]" noValidate>
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-headline-sm text-ink">Which book is this about?</h2>
                <p className="text-body-sm text-[#64748b]">
                  {pluralize(availableBooks.length, 'active title')} in your catalogue
                </p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Required</span>
            </div>

            <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setBookId('')}
                className={clsx(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                  bookId === ''
                    ? 'border-primary bg-[#F0FDF7] ring-1 ring-primary/20'
                    : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]',
                )}
                aria-pressed={bookId === ''}
              >
                <span
                  className={clsx(
                    'flex h-10 w-8 flex-shrink-0 items-center justify-center rounded bg-[#E5EEFF] text-primary',
                    bookId === '' && 'bg-primary text-white',
                  )}
                >
                  <Icon name="account_balance" className="text-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-label-md font-semibold text-ink">General / account level</span>
                  <span className="block text-[11px] text-[#64748b]">Royalties, profile, packages or anything else</span>
                </span>
                {bookId === '' ? <Icon name="check_circle" className="ml-auto text-[18px] text-primary" filled /> : null}
              </button>

              {availableBooks.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setBookId(book.id)}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                    bookId === book.id
                      ? 'border-primary bg-[#F0FDF7] ring-1 ring-primary/20'
                      : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]',
                  )}
                  aria-pressed={bookId === book.id}
                >
                  <span className="w-8 flex-shrink-0">
                    <BookCover title={book.title} author={user?.name ?? 'Author'} genre={book.genre} compact minimal />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-label-md font-semibold text-ink">{book.title}</span>
                    <span className="block truncate text-[11px] text-[#64748b]">{book.status}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-[#94a3b8] tabular">{book.isbn}</span>
                  </span>
                  {bookId === book.id ? (
                    <Icon name="check_circle" className="ml-auto flex-shrink-0 text-[18px] text-primary" filled />
                  ) : null}
                </button>
              ))}
            </div>

            {selectedBook ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#64748b]">
                <span>
                  MRP <strong className="text-ink">{money(selectedBook.mrp)}</strong>
                </span>
                <span>
                  Pending royalty{' '}
                  <strong className="text-ink">{money(selectedBook.royaltyPending)}</strong>
                </span>
                <span>
                  Last payout <strong className="text-ink">{selectedBook.lastRoyaltyPayoutDate ?? 'not yet'}</strong>
                </span>
                <span className="ml-auto font-medium text-[#475569]">{selectedBook.printPartner ?? 'Print partner TBD'}</span>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="subject" className="text-headline-sm text-ink">
                Subject line
              </label>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                Be specific
              </span>
            </div>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={140}
              className={clsx('input mt-2', touched && validation.subject && 'input-error')}
              placeholder="e.g. Royalty payout still pending for Whispers of the Ganges"
              aria-invalid={Boolean(touched && validation.subject)}
            />
            <div className="mt-1 flex items-center justify-between">
              {touched && validation.subject ? (
                <p className="text-[11px] text-danger">{validation.subject}</p>
              ) : (
                <p className="text-[11px] text-[#94a3b8]">A clear subject helps us route the query faster.</p>
              )}
              <span className="text-[10px] text-[#94a3b8] tabular">{subject.length}/140</span>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="description" className="text-headline-sm text-ink">
                  What is happening?
                </label>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                  {description.length}/2000
                </span>
              </div>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 2000))}
                onBlur={() => setTouched(true)}
                rows={8}
                className={clsx('input mt-2 resize-y', touched && validation.description && 'input-error')}
                placeholder="Include dates, order or payout references, the platform affected, and what you have already checked. The more specific you are, the faster we can resolve it."
                aria-invalid={Boolean(touched && validation.description)}
              />
              <div className="mt-1 flex items-start justify-between gap-4">
                {touched && validation.description ? (
                  <p className="text-[11px] text-danger">{validation.description}</p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-[#94a3b8]">
                    Avoid sharing bank account numbers or passwords. Reference the last four digits instead.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <Icon name="auto_awesome" className="text-[18px] text-ai" />
                <h3 className="text-label-md font-semibold text-ink">Query topic</h3>
                <span className="rounded-full border border-ai-border bg-ai-soft px-2 py-0.5 text-[10px] font-semibold text-ai-deep">
                  AI auto-classification
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategory('AUTO')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                    category === 'AUTO'
                      ? 'border-ai bg-ai text-white'
                      : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-ai-border hover:bg-ai-soft',
                  )}
                >
                  <Icon name="auto_awesome" className="text-[13px]" />
                  Auto-detect (recommended)
                </button>
                {CATEGORIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                      category === value
                        ? 'border-primary bg-primary text-white'
                        : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]',
                    )}
                  >
                    <Icon name={CATEGORY_ICONS[value]} className="text-[13px]" />
                    {CATEGORY_LABELS[value]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[#94a3b8]">
                You can leave this to the classifier. Our AI also assigns a priority from the content, which the
                operations team can adjust.
              </p>
            </div>

            <div className="mt-5">
              <h3 className="text-label-md font-semibold text-ink">Supporting document</h3>
              <div className="mt-2 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4">
                {attachment ? (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                      <Icon name="description" className="text-[19px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-md font-semibold text-ink">{attachment.name}</p>
                      <p className="text-[11px] text-[#64748b]">
                        {attachment.size} · metadata attached (file upload is UI-only)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachment(null);
                        if (fileInput.current) fileInput.current.value = '';
                      }}
                      className="btn-ghost p-1.5"
                      aria-label="Remove attachment"
                    >
                      <Icon name="close" className="text-[17px]" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                    <Icon name="cloud_upload" className="text-[24px] text-[#94a3b8]" />
                    <p className="text-[11px] text-[#64748b]">
                      Screenshots, statements or photographs of a defective copy
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="mt-0.5 text-[11px] font-semibold text-primary hover:underline"
                    >
                      Browse files
                    </button>
                    <p className="text-[10px] text-[#94a3b8]">PNG, JPG, PDF or CSV · up to 10 MB</p>
                  </div>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,.csv"
                  className="hidden"
                  onChange={onFile}
                />
              </div>
            </div>
          </Card>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-body-sm text-danger-deep">
              <Icon name="error" className="mt-0.5 text-[17px]" />
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
              <Icon name="verified_user" className="text-[15px] text-primary" />
              Your account is verified. Only you and the BookLeaf desk can see this thread.
            </div>
            <div className="flex items-center gap-2">
              <Link to="/app/tickets" className="btn-secondary">
                Cancel
              </Link>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Classifying &amp; routing…
                  </>
                ) : (
                  <>
                    Submit ticket
                    <Icon name="send" className="text-[17px]" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="overflow-hidden">
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon name="psychology" className="text-[20px] text-ai" />
                <h2 className="text-label-md font-semibold text-ink">How routing works</h2>
              </div>
            </div>
            <ol className="space-y-3 p-4">
              {[
                ['1', 'Classify', 'The query is matched to one of six support categories.'],
                ['2', 'Prioritise', 'Revenue blockers and catalogue errors are flagged first.'],
                ['3', 'Ground', 'Drafts use BookLeaf policy, never generic AI filler.'],
                ['4', 'Review', 'A specialist reviews and sends every response.'],
              ].map(([step, title, copy]) => (
                <li key={step} className="flex gap-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-ai-border bg-ai-soft text-[10px] font-bold text-ai-deep">
                    {step}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-ink">{title}</p>
                    <p className="text-[11px] leading-relaxed text-[#64748b]">{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Icon name="lightbulb" className="text-[19px] text-[#B45309]" />
              <h2 className="text-label-md font-semibold text-ink">Knowledge assistant</h2>
            </div>
            <p className="mt-1 text-[11px] text-[#64748b]">
              Relevant BookLeaf policy for this query. These answer many questions without waiting for the desk.
            </p>
            <div className="mt-3 space-y-2">
              {relatedPolicy.length > 0 ? (
                relatedPolicy.map((section) => (
                  <div key={section.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
                    <p className="text-[11px] font-semibold text-ink">{section.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-[#64748b]">{section.content}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-[#CBD5E1] p-3 text-[11px] text-[#94a3b8]">
                  Select a topic or start writing to see the most relevant policy.
                </p>
              )}
            </div>
          </Card>

          <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-4">
            <div className="flex items-center gap-2 text-[#047857]">
              <Icon name="verified" className="text-[18px]" filled />
              <p className="text-label-md font-semibold">Service commitment</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#047857]/80">
              Every ticket gets a human review. Critical revenue or catalogue-integrity issues are escalated with a
              48-hour resolution target.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Pill className="border-[#A7F3D0] bg-white/70 text-[#047857] !text-[9px]">Human reviewed</Pill>
              <Pill className="border-[#A7F3D0] bg-white/70 text-[#047857] !text-[9px]">Policy grounded</Pill>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
};
