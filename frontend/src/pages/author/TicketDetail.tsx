import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../../lib/api';
import { useLiveStatus } from '../../store/live';
import { useToast } from '../../store/toast';
import { BookCover } from '../../components/BookCover';
import { Icon } from '../../components/Icon';
import {
  Avatar,
  Card,
  CategoryPill,
  EmptyState,
  ErrorState,
  Modal,
  PriorityPill,
  SlaPill,
  SourcePill,
  Spinner,
  StatusPill,
} from '../../components/ui';
import {
  CATEGORY_LABELS,
  categoryLabel,
  formatDate,
  formatDateTime,
  money,
  timeAgo,
} from '../../lib/format';
import type { Message } from '../../lib/types';

const EVENT_ICONS: Record<string, string> = {
  CREATED: 'add_circle',
  AI_TRIAGE: 'auto_awesome',
  STATUS_CHANGED: 'swap_horiz',
  PUBLIC_REPLY: 'chat',
  CLOSED: 'task_alt',
  ASSIGNED: 'person_add',
  CATEGORY_OVERRIDE: 'edit',
  PRIORITY_OVERRIDE: 'priority_high',
  INTERNAL_NOTE: 'lock',
};

export const TicketDetailPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const live = useLiveStatus();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef(0);

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.tickets.get(id),
    enabled: Boolean(id),
  });

  const { data: knowledge } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: api.knowledge.list,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const count = ticket?.messages.length ?? 0;
    // Only follow new messages; never yank the reader to the bottom on load.
    if (ticket && previousMessageCount.current > 0 && count > previousMessageCount.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    previousMessageCount.current = count;
  }, [ticket]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-28 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="skeleton h-96 rounded-xl" />
          <div className="skeleton h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !ticket) {
    return <ErrorState onRetry={() => void refetch()} message="We could not open this ticket." />;
  }

  const closed = ticket.status === 'CLOSED';
  const resolved = ticket.status === 'RESOLVED';
  const relevantPolicy = knowledge?.find((section) => section.categories.includes(ticket.category));

  const send = async () => {
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.tickets.message(ticket.id, body);
      setReply('');
      await queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      await queryClient.invalidateQueries({ queryKey: ['author-summary'] });
      push('Reply sent to the BookLeaf desk.', 'success');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Your reply could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (closing) return;
    setClosing(true);
    try {
      await api.tickets.close(ticket.id);
      await queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      await queryClient.invalidateQueries({ queryKey: ['author-summary'] });
      setConfirmClose(false);
      push('Ticket closed. Thank you for confirming.', 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'Could not close the ticket.', 'error');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] text-[#94a3b8]">
        <Link to="/app/tickets" className="inline-flex items-center gap-1 hover:text-primary">
          <Icon name="arrow_back" className="text-[14px]" /> My tickets
        </Link>
        <Icon name="chevron_right" className="text-[13px]" />
        <span className="font-semibold text-[#475569] tabular">{ticket.ticketNumber}</span>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={ticket.status} />
            <PriorityPill priority={ticket.priority} />
            <CategoryPill category={ticket.category} />
            <span
              className={clsx(
                'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold',
                live === 'live' ? 'bg-[#ECFDF5] text-[#047857]' : 'bg-[#F1F5F9] text-[#475569]',
              )}
            >
              <span
                className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  live === 'live' ? 'animate-pulse bg-[#059669]' : 'bg-[#94A3B8]',
                )}
              />
              {live === 'live' ? 'Live thread' : 'Reconnecting'}
            </span>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94a3b8] tabular">
              {ticket.ticketNumber} · {CATEGORY_LABELS[ticket.category]}
            </p>
            <h1 className="mt-1 text-[1.5rem] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[1.75rem]">
              {ticket.subject}
            </h1>
            <p className="mt-1 text-[11px] text-[#64748b]">
              Opened {formatDateTime(ticket.createdAt)} · updated {timeAgo(ticket.lastMessageAt)}
              {ticket.firstResponseAt ? ` · first response ${timeAgo(ticket.firstResponseAt)}` : ' · awaiting first response'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SlaPill minutes={ticket.slaRemainingMinutes} breached={ticket.slaBreached} />
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[10px] text-[#64748b]">
              <Icon name="auto_awesome" className="text-[13px] text-ai" />
              Triaged by {ticket.categorySource === 'AI' ? 'AI' : ticket.categorySource === 'HEURISTIC' ? 'rule engine' : 'the desk'}
              {ticket.aiConfidence != null ? ` · ${Math.round(ticket.aiConfidence * 100)}% confidence` : ''}
            </span>
            {ticket.book ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[10px] text-[#64748b]">
                <Icon name="menu_book" className="text-[13px]" />
                {ticket.book.title}
              </span>
            ) : null}
            {!closed ? (
              <button
                type="button"
                onClick={() => setConfirmClose(true)}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-semibold text-[#475569] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
              >
                <Icon name="task_alt" className="text-[15px]" /> Mark satisfied &amp; close
              </button>
            ) : null}
          </div>
        </div>

        {resolved ? (
          <div className="flex items-center gap-2 border-t border-[#A7F3D0] bg-[#ECFDF5] px-5 py-2.5 text-[11px] text-[#047857]">
            <Icon name="task_alt" className="text-[15px]" />
            This ticket is marked resolved. Sending another reply will reopen it automatically.
          </div>
        ) : null}
        {closed ? (
          <div className="flex items-center gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-2.5 text-[11px] text-[#475569]">
            <Icon name="lock" className="text-[15px]" />
            This thread is closed. Start a new query if you need further help.
          </div>
        ) : null}
      </Card>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
            <div className="flex items-center gap-2">
              <Icon name="forum" className="text-[18px] text-primary" />
              <h2 className="text-label-md font-semibold text-ink">Conversation</h2>
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#64748b] tabular">
                {ticket.messages.length}
              </span>
            </div>
            <span className="text-[10px] text-[#94a3b8]">{ticket.assignee ? `Handled by ${ticket.assignee.name}` : 'Awaiting assignment'}</span>
          </div>

          <div className="space-y-5 bg-[#FBFCFE] px-4 py-5 sm:px-5">
            {ticket.messages.map((message: Message, index) => {
              if (message.role === 'SYSTEM') {
                return (
                  <div key={message.id} className="flex justify-center">
                    <div className="flex max-w-xl items-start gap-2 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF]/70 px-3 py-2.5 text-[11px] leading-relaxed text-[#5B21B6]">
                      <Icon name="auto_awesome" className="mt-px flex-shrink-0 text-[15px]" />
                      <p>{message.body}</p>
                    </div>
                  </div>
                );
              }

              const isAuthor = message.role === 'AUTHOR';
              return (
                <div key={message.id} className={clsx('flex gap-2.5', isAuthor && 'flex-row-reverse')}>
                  <Avatar name={message.authorName} size="sm" tone={isAuthor ? 'primary' : 'ai'} />
                  <div className={clsx('min-w-0 max-w-[86%]', isAuthor && 'text-right')}>
                    <div className={clsx('mb-1 flex items-center gap-1.5 text-[10px]', isAuthor && 'justify-end')}>
                      <span className="font-semibold text-[#334155]">{message.authorName}</span>
                      {!isAuthor ? (
                        <span className="rounded bg-ai-soft px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-ai-deep">
                          BookLeaf desk
                        </span>
                      ) : (
                        <span className="rounded bg-[#ECFDF5] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#047857]">
                          You
                        </span>
                      )}
                      <span className="text-[#94a3b8]">{formatDateTime(message.createdAt)}</span>
                    </div>
                    <div
                      className={clsx(
                        'rounded-xl border px-3.5 py-3 text-left text-body-sm leading-relaxed',
                        isAuthor
                          ? 'rounded-tr-sm border-[#A7F3D0] bg-[#F0FDF7] text-ink'
                          : 'rounded-tl-sm border-[#E2E8F0] bg-white text-[#1e293b] shadow-card',
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      {index === 0 && ticket.attachmentName ? (
                        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white/80 px-2.5 py-2">
                          <Icon name="attach_file" className="text-[16px] text-[#64748b]" />
                          <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[#475569]">
                            {ticket.attachmentName}
                          </span>
                          <span className="text-[9px] text-[#94a3b8]">{ticket.attachmentSize ?? ''}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <div className="border-t border-[#E2E8F0] bg-white p-4">
            {closed ? (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-[#F8FAFC] px-4 py-6 text-center">
                <Icon name="lock" className="text-[22px] text-[#94a3b8]" />
                <p className="text-body-sm text-[#64748b]">This conversation is closed.</p>
                <Link to="/app/tickets/new" className="btn-primary !py-2">
                  Raise a new query
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label htmlFor="reply" className="text-label-md font-semibold text-ink">
                    Reply to the desk
                  </label>
                  <span className="text-[10px] text-[#94a3b8] tabular">{reply.length}/5000</span>
                </div>
                <textarea
                  id="reply"
                  rows={4}
                  value={reply}
                  onChange={(event) => setReply(event.target.value.slice(0, 5000))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={resolved ? 'Reply to reopen this ticket…' : 'Add any detail that will help the desk resolve this…'}
                  className="input mt-1.5 resize-y"
                />
                {error ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-danger">
                    <Icon name="error" className="text-[14px]" /> {error}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-[#94a3b8]">
                    Replies are visible to the BookLeaf team. Press Ctrl/⌘ + Enter to send.
                  </p>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!reply.trim() || sending}
                    className="btn-primary !py-2"
                  >
                    {sending ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : <Icon name="send" className="text-[16px]" />}
                    Send reply
                  </button>
                </div>
              </>
            )}
          </div>
        </Card>

        <aside className="space-y-4">
          {ticket.book ? (
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Icon name="menu_book" className="text-[18px] text-primary" />
                <h2 className="text-label-md font-semibold text-ink">Associated book</h2>
              </div>
              <div className="mt-3 flex gap-3">
                <div className="w-16 flex-shrink-0">
                  <BookCover
                    title={ticket.book.title}
                    author={ticket.author?.name ?? 'Author'}
                    genre={ticket.book.genre}
                    compact
                    inProduction={ticket.book.status !== 'Published & Live'}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-label-md font-semibold leading-snug text-ink">{ticket.book.title}</p>
                  <p className="mt-0.5 text-[10px] text-[#64748b]">{ticket.book.genre}</p>
                  <p className="mt-1 text-[10px] text-[#94a3b8] tabular">{ticket.book.isbn}</p>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#047857]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                    {ticket.book.status}
                  </span>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[#E2E8F0] pt-3 text-[10px]">
                <div>
                  <dt className="uppercase tracking-wide text-[#94a3b8]">MRP</dt>
                  <dd className="mt-0.5 font-semibold text-ink tabular">{money(ticket.book.mrp)}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-[#94a3b8]">Pending royalty</dt>
                  <dd className="mt-0.5 font-semibold text-tertiary tabular">{money(ticket.book.royaltyPending)}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-[#94a3b8]">Copies sold</dt>
                  <dd className="mt-0.5 font-semibold text-ink tabular">{ticket.book.totalCopiesSold}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-[#94a3b8]">Last payout</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{ticket.book.lastRoyaltyPayoutDate ?? '—'}</dd>
                </div>
              </dl>
              <Link to="/app/books" className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-[#F8FAFC] py-2 text-[11px] font-semibold text-primary hover:bg-[#E5EEFF]">
                View in My Books <Icon name="arrow_forward" className="text-[13px]" />
              </Link>
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Icon name="account_balance" className="text-[18px] text-primary" />
                <h2 className="text-label-md font-semibold text-ink">Account-level query</h2>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748b]">
                This query is not tied to a single title. The desk will check your author account, royalty ledger and
                distribution record.
              </p>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Icon name="fact_check" className="text-[18px] text-[#475569]" />
              <h2 className="text-label-md font-semibold text-ink">Triage</h2>
            </div>
            <div className="mt-2.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-[#94a3b8]">Category</span>
                <CategoryPill category={ticket.category} className="!py-0.5 !text-[9px]" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-[#94a3b8]">Priority</span>
                <div className="flex items-center gap-1.5">
                  <PriorityPill priority={ticket.priority} className="!py-0.5 !text-[9px]" />
                  <SourcePill source={ticket.prioritySource} />
                </div>
              </div>
              {ticket.aiPriorityReason ? (
                <p className="rounded-lg bg-[#F8FAFC] p-2.5 text-[10px] leading-relaxed text-[#64748b]">
                  {ticket.aiPriorityReason}
                </p>
              ) : null}
              {ticket.categorySource === 'AUTHOR' ? (
                <p className="text-[10px] text-[#94a3b8]">
                  Category chosen by you. AI still assessed priority from the content.
                </p>
              ) : null}
            </div>
          </Card>

          {relevantPolicy ? (
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Icon name="menu_book" className="text-[18px] text-[#475569]" />
                <h2 className="text-label-md font-semibold text-ink">Policy reference</h2>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-ink">{relevantPolicy.title}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#64748b]">{relevantPolicy.content}</p>
            </Card>
          ) : null}

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Icon name="timeline" className="text-[18px] text-[#475569]" />
              <h2 className="text-label-md font-semibold text-ink">Timeline</h2>
            </div>
            <ol className="mt-3 space-y-3">
              {ticket.events.slice(-5).map((event) => (
                <li key={event.id} className="relative flex gap-2.5 pb-0.5">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748b]">
                    <Icon name={EVENT_ICONS[event.type] ?? 'circle'} className="text-[12px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] leading-snug text-[#475569]">{event.description}</p>
                    <p className="mt-0.5 text-[9px] text-[#94a3b8]">{formatDate(event.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF]/60 p-4">
            <div className="flex items-center gap-2 text-[#5B21B6]">
              <Icon name="verified_user" className="text-[17px]" />
              <p className="text-label-md font-semibold">Author protection</p>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-[#5B21B6]/80">
              Internal notes and AI drafts are never shown in your thread. Only reviewed replies from the BookLeaf desk
              appear here.
            </p>
          </div>

          {!ticket.book && ticket.messages.length === 0 ? (
            <EmptyState title="No messages yet" message="The desk will reply here shortly." />
          ) : null}
        </aside>
      </div>

      <Modal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Close this support ticket?"
        description="Only close the ticket once your question is fully answered. You can always raise a new query later."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmClose(false)}>
              Keep open
            </button>
            <button type="button" className="btn-primary" onClick={() => void closeTicket()} disabled={closing}>
              {closing ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : <Icon name="task_alt" className="text-[17px]" />}
              Close ticket
            </button>
          </>
        }
      >
        <p className="text-body-sm text-[#475569]">
          <strong className="text-ink">{ticket.ticketNumber}</strong> · {ticket.subject}
          <br />
          <span className="text-[#64748b]">{categoryLabel(ticket.category)}</span>
        </p>
      </Modal>
    </div>
  );
};
