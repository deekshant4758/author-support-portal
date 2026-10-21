import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useToast } from '../../store/toast';
import { BookCover } from '../../components/BookCover';
import { Icon } from '../../components/Icon';
import {
  Avatar,
  Card,
  CategoryPill,
  ConfidenceMeter,
  ErrorState,
  PriorityPill,
  SlaPill,
  SourcePill,
  Spinner,
  StatusPill,
} from '../../components/ui';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  formatDateTime,
  money,
  number,
  timeAgo,
} from '../../lib/format';
import type {
  DraftMeta,
  Message,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  Tone,
} from '../../lib/types';

type ReplyMode = 'PUBLIC' | 'INTERNAL';

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
  DRAFT_GENERATED: 'draw',
};

const TONES: Array<{ value: Tone; label: string; icon: string }> = [
  { value: 'EMPATHETIC', label: 'Empathetic', icon: 'favorite' },
  { value: 'CONCISE', label: 'Concise', icon: 'compress' },
  { value: 'ESCALATION', label: 'Escalation', icon: 'priority_high' },
];

export const AdminTicketPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { user } = useAuth();

  const [replyMode, setReplyMode] = useState<ReplyMode>('PUBLIC');
  const [reply, setReply] = useState('');
  const [draft, setDraft] = useState('');
  const [draftMeta, setDraftMeta] = useState<DraftMeta | null>(null);
  const [tone, setTone] = useState<Tone>('EMPATHETIC');
  const [instructions, setInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [showInternal, setShowInternal] = useState(true);
  const [showAudit, setShowAudit] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.tickets.get(id),
    enabled: Boolean(id),
  });
  const { data: team } = useQuery({
    queryKey: ['admin-team'],
    queryFn: api.admin.team,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ticket', id] }),
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['author-summary'] }),
    ]);
  };

  useEffect(() => {
    if (ticket) {
      setReply('');
      setDraft('');
      setDraftMeta(null);
      setShowInternal(true);
    }
  }, [ticket?.id]);

  const visibleMessages = useMemo(() => {
    if (!ticket) return [];
    return showInternal ? ticket.messages : ticket.messages.filter((message) => !message.isInternal);
  }, [ticket, showInternal]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-5 w-64" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <div className="skeleton h-[520px] rounded-xl" />
          <div className="skeleton h-[520px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !ticket) {
    return <ErrorState onRetry={() => void refetch()} message="We could not open this ticket." />;
  }

  const update = async (
    payload: { status?: TicketStatus; category?: TicketCategory; priority?: TicketPriority },
    message: string,
  ) => {
    setUpdating(true);
    try {
      await api.tickets.update(ticket.id, payload);
      await refresh();
      push(message, 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'The update could not be saved.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const assign = async (assigneeId: string | null) => {
    setUpdating(true);
    try {
      await api.tickets.assign(ticket.id, assigneeId);
      await refresh();
      push(assigneeId ? 'Ticket assigned.' : 'Ticket returned to the unassigned pool.', 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'Assignment failed.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const generate = async (requestedTone: Tone = tone) => {
    setGenerating(true);
    try {
      const result = await api.tickets.draft(ticket.id, {
        tone: requestedTone,
        includeHistory: true,
        instructions: instructions.trim() || undefined,
      });
      setTone(requestedTone);
      setDraft(result.draft);
      setDraftMeta(result.meta);
      if (result.meta.source === 'TEMPLATE') {
        push('Groq unavailable — a policy-grounded template draft was generated.', 'info');
      } else {
        push('Grounded draft generated. Review before sending.', 'success');
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'Draft generation failed.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const reclassify = async () => {
    setReclassifying(true);
    try {
      const response = await api.tickets.reclassify(ticket.id);
      const triage = response.meta?.triage as
        | { source?: string; confidence?: number; cached?: boolean }
        | undefined;
      await refresh();
      push(
        `Triage re-run: ${triage?.source === 'AI' ? 'AI' : 'rule engine'}${
          triage?.cached ? ' (cached)' : ''
        }.`,
        'success',
      );
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'Could not re-run triage.', 'error');
    } finally {
      setReclassifying(false);
    }
  };

  const send = async () => {
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await api.tickets.message(ticket.id, body, replyMode === 'INTERNAL');
      setReply('');
      await refresh();
      push(replyMode === 'INTERNAL' ? 'Internal note added.' : 'Reply sent to the author.', 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'The message could not be sent.', 'error');
    } finally {
      setSending(false);
    }
  };

  const useDraft = () => {
    setReply(draft);
    setReplyMode('PUBLIC');
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    push('Draft loaded into the reply editor. Review and send when ready.', 'info');
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] text-[#94a3b8]">
        <Link to="/admin/queue" className="inline-flex items-center gap-1 hover:text-primary">
          <Icon name="arrow_back" className="text-[14px]" /> Ticket queue
        </Link>
        <Icon name="chevron_right" className="text-[13px]" />
        <span className="font-semibold text-[#475569] tabular">{ticket.ticketNumber}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#475569]">
          <Icon name="lock" className="text-[11px]" /> Internal console
        </span>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={ticket.status} />
            <PriorityPill priority={ticket.priority} />
            <CategoryPill category={ticket.category} />
            <SlaPill minutes={ticket.slaRemainingMinutes} breached={ticket.slaBreached} />
          </div>
          <h1 className="mt-2 max-w-4xl text-[1.6rem] font-bold leading-tight tracking-[-0.025em] text-ink sm:text-[1.9rem]">
            {ticket.subject}
          </h1>
          <p className="mt-1 text-[11px] text-[#64748b]">
            <span className="font-bold tabular">{ticket.ticketNumber}</span> · opened {formatDateTime(ticket.createdAt)} ·{' '}
            {timeAgo(ticket.lastMessageAt)} · {ticket.messageCount ?? 0} public replies
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void reclassify()}
            disabled={reclassifying}
            className="btn-ai"
          >
            {reclassifying ? <Spinner className="h-4 w-4" /> : <Icon name="auto_awesome" className="text-[17px]" />}
            Re-run AI triage
          </button>
          {ticket.status !== 'CLOSED' ? (
            <button
              type="button"
              onClick={() => void update({ status: 'CLOSED' }, 'Ticket closed.')}
              disabled={updating}
              className="btn-secondary"
            >
              <Icon name="task_alt" className="text-[18px]" />
              Close
            </button>
          ) : null}
        </div>
      </div>

      {/* Author + book context */}
      <Card className="mt-5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3 lg:w-[300px]">
            <Avatar name={ticket.author?.name ?? 'Author'} size="lg" tone="primary" />
            <div className="min-w-0">
              <p className="text-label-md font-semibold text-ink">{ticket.author?.name}</p>
              <p className="truncate text-[11px] text-[#64748b]">{ticket.author?.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="rounded border border-[#A7F3D0] bg-[#ECFDF5] px-1.5 py-0.5 text-[9px] font-semibold text-[#047857]">
                  {ticket.author?.tier ?? 'Standard Free'}
                </span>
                <span className="text-[10px] text-[#94a3b8]">
                  {ticket.author?.city} · {ticket.author?.id}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden h-12 w-px bg-[#E2E8F0] lg:block" />

          {ticket.book ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="w-10 flex-shrink-0">
                <BookCover
                  title={ticket.book.title}
                  author={ticket.author?.name ?? 'Author'}
                  genre={ticket.book.genre}
                  compact
                  minimal
                  inProduction={ticket.book.status !== 'Published & Live'}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Linked title</p>
                <p className="truncate text-label-md font-semibold text-ink">{ticket.book.title}</p>
                <p className="truncate text-[10px] text-[#64748b] tabular">
                  ISBN {ticket.book.isbn} · {ticket.book.status}
                </p>
              </div>
              <div className="hidden grid-cols-3 gap-4 sm:grid">
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">Earned</p>
                  <p className="text-[11px] font-bold text-ink tabular">{money(ticket.book.totalRoyaltyEarned)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">Pending</p>
                  <p className="text-[11px] font-bold text-tertiary tabular">{money(ticket.book.royaltyPending)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">Sold</p>
                  <p className="text-[11px] font-bold text-ink tabular">{number(ticket.book.totalCopiesSold)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Query scope</p>
              <p className="text-label-md font-semibold text-ink">General / account level</p>
              <p className="text-[10px] text-[#64748b]">No single title attached to this ticket.</p>
            </div>
          )}

          {ticket.attachmentName ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5">
              <Icon name="attach_file" className="text-[16px] text-[#64748b]" />
              <span className="max-w-[150px] truncate text-[10px] font-medium text-[#475569]">
                {ticket.attachmentName}
              </span>
              <span className="text-[9px] text-[#94a3b8]">{ticket.attachmentSize}</span>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.08fr_1fr]">
        {/* Conversation + composer */}
        <div className="space-y-4" ref={composerRef}>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon name="forum" className="text-[18px] text-primary" />
                <h2 className="text-label-md font-semibold text-ink">Author conversation</h2>
                <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#64748b] tabular">
                  {visibleMessages.length}
                </span>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-[#64748b]">
                <input
                  type="checkbox"
                  checked={showInternal}
                  onChange={(event) => setShowInternal(event.target.checked)}
                  className="h-3.5 w-3.5 accent-[#006948]"
                />
                Show internal notes
              </label>
            </div>

            <div className="space-y-4 bg-[#FBFCFE] px-4 py-4">
              {visibleMessages.map((message: Message) => {
                if (message.role === 'SYSTEM') {
                  return (
                    <div key={message.id} className="flex justify-center">
                      <div className="flex max-w-lg items-start gap-2 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF]/70 px-3 py-2 text-[11px] leading-relaxed text-[#5B21B6]">
                        <Icon name="auto_awesome" className="mt-px flex-shrink-0 text-[14px]" />
                        <p>{message.body}</p>
                      </div>
                    </div>
                  );
                }

                if (message.isInternal) {
                  return (
                    <div key={message.id} className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#B45309]">
                        <Icon name="lock" className="text-[13px]" />
                        Internal note · {message.authorName} · {formatDateTime(message.createdAt)}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-body-sm leading-relaxed text-[#78350F]">
                        {message.body}
                      </p>
                    </div>
                  );
                }

                const isAuthor = message.role === 'AUTHOR';
                return (
                  <div key={message.id} className={clsx('flex gap-2.5', !isAuthor && 'flex-row-reverse')}>
                    <Avatar name={message.authorName} size="sm" tone={isAuthor ? 'neutral' : 'ai'} />
                    <div className={clsx('min-w-0 max-w-[88%]', !isAuthor && 'text-right')}>
                      <div className={clsx('mb-1 flex items-center gap-1.5 text-[10px]', !isAuthor && 'justify-end')}>
                        <span className="font-semibold text-[#334155]">{message.authorName}</span>
                        <span
                          className={clsx(
                            'rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide',
                            isAuthor ? 'bg-[#F1F5F9] text-[#475569]' : 'bg-ai-soft text-ai-deep',
                          )}
                        >
                          {isAuthor ? 'Author' : 'BookLeaf desk'}
                        </span>
                        <span className="text-[#94a3b8]">{formatDateTime(message.createdAt)}</span>
                      </div>
                      <div
                        className={clsx(
                          'rounded-xl border px-3.5 py-3 text-left text-body-sm leading-relaxed',
                          isAuthor
                            ? 'rounded-tl-sm border-[#E2E8F0] bg-white text-[#1e293b] shadow-card'
                            : 'rounded-tr-sm border-[#A7F3D0] bg-[#F0FDF7] text-ink',
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#E2E8F0] bg-white p-4">
              <div className="flex items-center gap-1 rounded-lg bg-[#F1F5F9] p-0.5">
                <button
                  type="button"
                  onClick={() => setReplyMode('PUBLIC')}
                  className={clsx(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                    replyMode === 'PUBLIC' ? 'bg-white text-ink shadow-sm' : 'text-[#64748b] hover:text-ink',
                  )}
                >
                  <Icon name="send" className="text-[14px]" /> Reply to author
                </button>
                <button
                  type="button"
                  onClick={() => setReplyMode('INTERNAL')}
                  className={clsx(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                    replyMode === 'INTERNAL' ? 'bg-[#FFFBEB] text-[#B45309] shadow-sm' : 'text-[#64748b] hover:text-ink',
                  )}
                >
                  <Icon name="lock" className="text-[14px]" /> Internal note
                </button>
              </div>

              <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
                <Icon
                  name={replyMode === 'PUBLIC' ? 'campaign' : 'lock'}
                  className={clsx('mt-0.5 text-[15px]', replyMode === 'PUBLIC' ? 'text-primary' : 'text-[#B45309]')}
                />
                <p className="text-[10px] leading-relaxed text-[#64748b]">
                  {replyMode === 'PUBLIC'
                    ? 'This reply is visible to the author and syncs to their thread instantly. AI drafts must be reviewed and edited before sending.'
                    : 'Internal notes are visible only to operations staff. They are excluded from the author API and live stream.'}
                </p>
              </div>

              <textarea
                rows={6}
                value={reply}
                onChange={(event) => setReply(event.target.value.slice(0, 5000))}
                placeholder={
                  replyMode === 'PUBLIC'
                    ? 'Write the author-facing reply, or load an AI draft from the copilot…'
                    : 'Add context for the next specialist: verification steps, escalation IDs, internal next actions…'
                }
                className={clsx('input mt-2 resize-y', replyMode === 'INTERNAL' && 'border-[#FDE68A] bg-[#FFFDF5]')}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-[#94a3b8]">
                  {reply.length}/5000 · {replyMode === 'PUBLIC' ? 'Author-visible' : 'Internal only'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void generate(tone)}
                    disabled={generating}
                    className="btn-ai !py-2"
                  >
                    {generating ? <Spinner className="h-4 w-4" /> : <Icon name="auto_awesome" className="text-[16px]" />}
                    {draft ? 'Generate again' : 'Draft with AI'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!reply.trim() || sending}
                    className={replyMode === 'PUBLIC' ? 'btn-primary !py-2' : 'btn-secondary !border-[#FDE68A] !bg-[#FFFBEB] !text-[#B45309]'}
                  >
                    {sending ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Icon name={replyMode === 'PUBLIC' ? 'send' : 'lock'} className="text-[16px]" />
                    )}
                    {replyMode === 'PUBLIC' ? 'Send reply' : 'Save note'}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAudit((open) => !open)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2">
                <Icon name="history" className="text-[17px] text-[#475569]" />
                <span className="text-label-md font-semibold text-ink">Audit &amp; event log</span>
                <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#64748b]">
                  {ticket.events.length}
                </span>
              </span>
              <Icon
                name={showAudit ? 'expand_less' : 'expand_more'}
                className="text-[18px] text-[#64748b]"
              />
            </button>
            {showAudit ? (
              <div className="border-t border-[#E2E8F0] px-4 py-3">
                <ol className="space-y-3">
                  {[...ticket.events].reverse().map((event) => (
                    <li key={event.id} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#F8FAFC] text-[#64748b]">
                        <Icon name={EVENT_ICONS[event.type] ?? 'circle'} className="text-[12px]" />
                      </span>
                      <div>
                        <p className="text-[11px] leading-snug text-[#475569]">{event.description}</p>
                        <p className="mt-0.5 text-[9px] text-[#94a3b8]">
                          {event.actorName} · {formatDateTime(event.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </Card>
        </div>

        {/* AI + controls */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#DDD6FE] bg-gradient-to-r from-[#EEF2FF] to-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ai text-white">
                  <Icon name="auto_awesome" className="text-[16px]" />
                </span>
                <div>
                  <h2 className="text-label-md font-bold text-ink">BookLeaf Copilot</h2>
                  <p className="text-[9px] uppercase tracking-wider text-ai-deep">Grounded triage</p>
                </div>
              </div>
              <span className="text-[11px] text-ai-deep">
                {ticket.categorySource === 'AI' ? 'LLM + KB' : 'Rule fallback'}
              </span>
            </div>

            <div className="space-y-3.5 p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
                  <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">Detected category</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-ink">
                    <Icon name={CATEGORY_ICONS[ticket.category]} className="text-[13px] text-primary" />
                    {CATEGORY_LABELS[ticket.category]}
                  </p>
                  <div className="mt-1">
                    <SourcePill source={ticket.categorySource} confidence={ticket.aiConfidence} />
                  </div>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
                  <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">Priority score</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-ink">
                    <Icon name="priority_high" className="text-[13px] text-[#B45309]" />
                    {ticket.priority}
                  </p>
                  <div className="mt-1">
                    <SourcePill source={ticket.prioritySource} />
                  </div>
                </div>
              </div>

              {ticket.aiConfidence != null ? (
                <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-2.5 py-2">
                  <span className="text-[10px] text-[#64748b]">Classifier confidence</span>
                  <ConfidenceMeter value={ticket.aiConfidence} />
                </div>
              ) : null}

              {ticket.aiPriorityReason ? (
                <div className="rounded-lg border border-[#DDD6FE] bg-[#F5F3FF]/60 p-2.5">
                  <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#6D28D9]">
                    <Icon name="psychology" className="text-[12px]" /> Why this priority
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#5B21B6]">{ticket.aiPriorityReason}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                    Override category
                  </span>
                  <select
                    value={ticket.category}
                    onChange={(event) =>
                      void update(
                        { category: event.target.value as TicketCategory },
                        'Category overridden. Audit log updated.',
                      )
                    }
                    disabled={updating}
                    className="input !py-1.5 text-[11px]"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                    Override priority
                  </span>
                  <select
                    value={ticket.priority}
                    onChange={(event) =>
                      void update(
                        { priority: event.target.value as TicketPriority },
                        'Priority overridden. Audit log updated.',
                      )
                    }
                    disabled={updating}
                    className="input !py-1.5 text-[11px]"
                  >
                    {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as TicketPriority[]).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {ticket.categorySource === 'ADMIN' || ticket.prioritySource === 'ADMIN' ? (
                <p className="flex items-center gap-1 text-[9px] text-[#B45309]">
                  <Icon name="edit" className="text-[12px]" />
                  Manual override active — re-run AI triage to reset.
                </p>
              ) : null}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon name="draw" className="text-[18px] text-ai" />
                <h2 className="text-label-md font-semibold text-ink">AI draft studio</h2>
              </div>
              {draftMeta ? (
                <span
                  className={clsx(
                    'text-[11px]',
                    draftMeta.source === 'AI'
                      ? 'text-ai-deep'
                      : 'text-[#B45309]',
                  )}
                >
                  {draftMeta.source === 'AI' ? 'AI grounded' : 'Template fallback'}
                  {draftMeta.cached ? ' · cached' : ''}
                </span>
              ) : null}
            </div>

            <div className="p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">Tone</span>
                {TONES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTone(option.value)}
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors',
                      tone === option.value
                        ? 'border-ai bg-ai text-white'
                        : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]',
                    )}
                  >
                    <Icon name={option.icon} className="text-[11px]" />
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowInstructions((open) => !open)}
                  className="ml-auto inline-flex items-center gap-1 text-[9px] font-semibold text-[#64748b] hover:text-ink"
                >
                  <Icon name="tune" className="text-[12px]" />
                  {showInstructions ? 'Hide note' : 'Add note'}
                </button>
              </div>

              {showInstructions ? (
                <input
                  type="text"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value.slice(0, 500))}
                  placeholder="Optional instruction, e.g. mention the 48-hour finance escalation"
                  className="input mt-2 !py-2 text-[11px]"
                />
              ) : null}

              <button
                type="button"
                onClick={() => void generate(tone)}
                disabled={generating}
                className="btn-ai mt-2.5 w-full !py-2"
              >
                {generating ? (
                  <>
                    <Spinner className="h-4 w-4" /> Drafting from BookLeaf policy…
                  </>
                ) : (
                  <>
                    <Icon name="auto_awesome" className="text-[16px]" />
                    {draft ? 'Regenerate draft' : 'Generate grounded draft'}
                  </>
                )}
              </button>

              {draftMeta ? (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[8px] font-medium text-[#475569]">
                    {draftMeta.model}
                  </span>
                  <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[8px] text-[#475569]">
                    {draftMeta.promptTokens + draftMeta.completionTokens} tokens
                  </span>
                  <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[8px] text-[#475569]">
                    ~${draftMeta.estimatedCostUsd.toFixed(5)}
                  </span>
                  {draftMeta.latencyMs > 0 ? (
                    <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[8px] text-[#475569]">
                      {draftMeta.latencyMs}ms
                    </span>
                  ) : null}
                </div>
              ) : null}

              {draftMeta?.sections?.length ? (
                <div className="mt-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-2">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-[#94a3b8]">Knowledge base matched</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {draftMeta.sections.map((section) => (
                      <li key={section} className="flex items-center gap-1 text-[9px] text-[#475569]">
                        <Icon name="menu_book" className="text-[11px] text-primary" />
                        {section}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <label htmlFor="draft-editor" className="mt-3 block text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                Draft editor {draft ? '' : '(generate to populate)'}
              </label>
              <textarea
                id="draft-editor"
                rows={8}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="The grounded draft will appear here. You can edit every word before it reaches the author."
                className="input mt-1 resize-y text-[12px] leading-relaxed"
              />

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1 text-[9px] text-[#94a3b8]">
                  <Icon name="verified_user" className="text-[11px]" />
                  Human review required
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(draft);
                      push('Draft copied to clipboard.', 'info');
                    }}
                    disabled={!draft}
                    className="btn-ghost !px-2 !py-1.5 !text-[10px]"
                  >
                    <Icon name="content_copy" className="text-[13px]" /> Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft('');
                      setDraftMeta(null);
                    }}
                    disabled={!draft}
                    className="btn-ghost !px-2 !py-1.5 !text-[10px]"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={useDraft}
                    disabled={!draft.trim()}
                    className="btn-primary !px-2.5 !py-1.5 !text-[10px]"
                  >
                    <Icon name="arrow_downward" className="text-[13px]" /> Use in reply
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Icon name="tune" className="text-[18px] text-[#475569]" />
              <h2 className="text-label-md font-semibold text-ink">Ticket controls</h2>
            </div>

            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">Status</span>
                <select
                  value={ticket.status}
                  onChange={(event) =>
                    void update({ status: event.target.value as TicketStatus }, 'Ticket status updated.')
                  }
                  disabled={updating}
                  className="input !py-2 text-[12px]"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </label>

              <div>
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Assignee
                </span>
                <div className="flex items-center gap-2">
                  {ticket.assignee ? (
                    <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5">
                      <Avatar name={ticket.assignee.name} size="sm" tone="ai" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-ink">{ticket.assignee.name}</p>
                        <p className="text-[9px] text-[#94a3b8]">Assigned specialist</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void assign(null)}
                        className="rounded p-1 text-[#94a3b8] hover:bg-white hover:text-danger"
                        title="Unassign"
                      >
                        <Icon name="close" className="text-[15px]" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-2 text-[10px] text-[#64748b]">
                      In the unassigned pool
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void assign(user?.id ?? null)}
                    disabled={ticket.assignee?.id === user?.id || updating}
                    className="btn-secondary !px-2.5 !py-2 !text-[10px]"
                  >
                    <Icon name="person_add" className="text-[14px]" />
                    {ticket.assignee?.id === user?.id ? 'Mine' : 'Assign me'}
                  </button>
                </div>

                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value) void assign(event.target.value);
                  }}
                  disabled={updating}
                  className="input mt-2 !py-2 text-[11px]"
                  aria-label="Assign to team member"
                >
                  <option value="">Assign to another specialist…</option>
                  {team?.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.assignedCount} open
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-[#E2E8F0] pt-3 text-[10px]">
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">First response</p>
                  <p className="mt-0.5 font-semibold text-ink">
                    {ticket.firstResponseAt ? timeAgo(ticket.firstResponseAt) : 'Not yet'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">SLA due</p>
                  <p className={clsx('mt-0.5 font-semibold', ticket.slaBreached ? 'text-danger' : 'text-ink')}>
                    {ticket.slaBreached ? 'Overdue' : formatDateTime(ticket.slaDueAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">Created</p>
                  <p className="mt-0.5 font-semibold text-ink">{formatDateTime(ticket.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">Last activity</p>
                  <p className="mt-0.5 font-semibold text-ink">{timeAgo(ticket.lastMessageAt)}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
