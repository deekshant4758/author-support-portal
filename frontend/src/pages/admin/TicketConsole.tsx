import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useToast } from '../../store/toast';
import { Avatar, Card, ErrorState, Spinner, StatusPill } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { CATEGORY_LABELS, PRIORITY_LABELS, formatDateTime, money } from '../../lib/format';
import type { TicketCategory, TicketPriority, TicketStatus, Tone } from '../../lib/types';

export const AdminTicketPage = () => {
  const { id = '' } = useParams();
  return <TicketWorkspace key={id} id={id} />;
};

const TicketWorkspace = ({ id }: { id: string }) => {
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [draft, setDraft] = useState('');
  const [tone, setTone] = useState<Tone>('EMPATHETIC');
  const [instructions, setInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const draftEdited = useRef(false);
  const initialDraft = useRef<ReturnType<typeof api.tickets.draft> | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.tickets.get(id),
    enabled: Boolean(id),
  });
  const { data: ticket } = ticketQuery;
  const { data: team } = useQuery({ queryKey: ['admin-team'], queryFn: api.admin.team });

  // Keep the initial request across StrictMode effect replays. Never replace an edited draft.
  useEffect(() => {
    if (!ticket) return;
    let active = true;
    initialDraft.current ??= api.tickets.draft(id, { tone: 'EMPATHETIC', includeHistory: true });
    setGenerating(true);
    void initialDraft.current
      .then((result) => {
        if (active && !draftEdited.current) {
          setDraft(result.draft);
          setFallback(result.meta.source === 'TEMPLATE');
        }
      })
      .catch((caught) => {
        if (active)
          setDraftError(
            caught instanceof ApiError
              ? caught.message
              : 'The suggested reply could not be loaded. You can write a reply below.',
          );
      })
      .finally(() => {
        if (active) setGenerating(false);
      });
    return () => {
      active = false;
    };
  }, [ticket?.id, id]);

  const refresh = async () => {
    await Promise.all(
      [['ticket', id], ['tickets'], ['admin-stats'], ['author-summary']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
  };
  const update = async (payload: {
    status?: TicketStatus;
    category?: TicketCategory;
    priority?: TicketPriority;
  }) => {
    if (updating) return;
    setUpdating(true);
    try {
      await api.tickets.update(id, payload);
      await refresh();
      push('Ticket updated.', 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'The ticket could not be updated.', 'error');
    } finally {
      setUpdating(false);
    }
  };
  const assign = async (assigneeId: string | null) => {
    if (updating) return;
    setUpdating(true);
    try {
      await api.tickets.assign(id, assigneeId);
      await refresh();
      push(assigneeId ? 'Ticket assigned.' : 'Ticket unassigned.', 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'Assignment failed.', 'error');
    } finally {
      setUpdating(false);
    }
  };
  const regenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setDraftError(null);
    try {
      const result = await api.tickets.draft(id, {
        tone,
        includeHistory: true,
        instructions: instructions.trim() || undefined,
      });
      setDraft(result.draft);
      setFallback(result.meta.source === 'TEMPLATE');
      draftEdited.current = false;
    } catch (caught) {
      setDraftError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not generate a draft. You can still write your reply.',
      );
    } finally {
      setGenerating(false);
    }
  };
  const send = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await api.tickets.message(id, reply.trim(), internal);
      setReply('');
      await refresh();
      push(internal ? 'Internal note added.' : 'Reply sent to the author.', 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'The message could not be sent.', 'error');
    } finally {
      setSending(false);
    }
  };
  if (ticketQuery.isLoading) return <div className="skeleton h-96 rounded-xl" />;
  if (ticketQuery.isError || !ticket)
    return <ErrorState onRetry={() => void ticketQuery.refetch()} message="We could not open this ticket." />;
  const messages = ticket.messages.filter(
    (message, index) => !(index === 0 && message.role === 'AUTHOR' && message.body === ticket.description),
  );
  return (
    <div className="animate-fade-up">
      <Link to="/admin/queue" className="link inline-flex items-center gap-1 text-body-sm">
        <Icon name="arrow_back" className="text-[16px]" /> Ticket queue
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.8rem] font-bold tracking-tight text-ink">{ticket.subject}</h1>
        <StatusPill status={ticket.status} />
      </div>
      <p className="mt-1 text-body-sm text-[#64748b]">
        {ticket.ticketNumber} · Opened {formatDateTime(ticket.createdAt)}
      </p>
      <Card className="mt-5 flex flex-col gap-4 p-5 md:flex-row md:justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={ticket.author?.name ?? 'Author'} size="md" />
          <div>
            <p className="font-semibold text-ink">{ticket.author?.name}</p>
            <p className="text-body-sm text-[#64748b]">{ticket.author?.email}</p>
          </div>
        </div>
        {ticket.book ? (
          <div>
            <p className="font-semibold text-ink">{ticket.book.title}</p>
            <p className="text-body-sm text-[#64748b]">
              ISBN {ticket.book.isbn} · {ticket.book.status}
            </p>
            <p className="mt-1 text-body-sm text-[#64748b]">
              Royalty pending: {money(ticket.book.royaltyPending)}
            </p>
          </div>
        ) : (
          <p className="text-body-sm text-[#64748b]">General / Account Level</p>
        )}
      </Card>
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-[#E2E8F0] p-5">
              <h2 className="text-headline-sm text-ink">Original query</h2>
              <p className="mt-2 whitespace-pre-wrap text-body-sm leading-relaxed text-[#475569]">
                {ticket.description}
              </p>
              {ticket.attachmentName ? (
                <p className="mt-3 break-all text-body-sm text-[#64748b]">
                  Attachment reference: {ticket.attachmentName}
                </p>
              ) : null}
            </div>
            <div className="space-y-4 bg-[#F8FAFC] p-5">
              {messages.length === 0 ? (
                <p className="text-body-sm text-[#64748b]">No replies yet.</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={clsx(
                      'rounded-lg border p-4',
                      message.isInternal ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'border-[#E2E8F0] bg-white',
                    )}
                  >
                    <p className="text-[11px] text-[#64748b]">
                      {message.isInternal ? 'Internal note · ' : ''}
                      {message.authorName} · {formatDateTime(message.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-body-sm leading-relaxed text-ink">
                      {message.body}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-[#E2E8F0] p-5">
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setInternal(false)}
                  aria-pressed={!internal}
                  className={!internal ? 'btn-primary' : 'btn-secondary'}
                >
                  Reply to author
                </button>
                <button
                  type="button"
                  onClick={() => setInternal(true)}
                  aria-pressed={internal}
                  className={internal ? 'btn-primary' : 'btn-secondary'}
                >
                  Internal note
                </button>
              </div>
              {internal ? (
                <p className="mb-3 text-body-sm text-[#B45309]">Only the support team can see this note.</p>
              ) : null}
              <label htmlFor="admin-reply" className="field-label">
                {internal ? 'Note' : 'Reply'}
              </label>
              <textarea
                id="admin-reply"
                ref={composer}
                rows={6}
                maxLength={5000}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder={internal ? 'Add a private note…' : 'Write your reply…'}
                className="input resize-y"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!reply.trim() || sending}
                  className="btn-primary"
                >
                  {sending ? <Spinner className="h-4 w-4" /> : null}
                  {internal ? 'Save note' : 'Send reply'}
                </button>
              </div>
            </div>
          </Card>
          <details className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <summary className="cursor-pointer text-label-md font-semibold text-ink">Activity</summary>
            <ul className="mt-4 space-y-3">
              {ticket.events
                .filter((event) => !['AI_TRIAGE', 'DRAFT_GENERATED'].includes(event.type))
                .map((event) => (
                  <li key={event.id} className="text-body-sm text-[#64748b]">
                    {event.description}
                    <span className="mt-1 block text-[11px]">{formatDateTime(event.createdAt)}</span>
                  </li>
                ))}
            </ul>
          </details>
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-headline-sm text-ink">Ticket details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block">
                <span className="field-label">Status</span>
                <select
                  aria-label="Status"
                  value={ticket.status}
                  onChange={(event) => void update({ status: event.target.value as TicketStatus })}
                  disabled={updating}
                  className="input"
                >
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
                  value={ticket.category}
                  onChange={(event) => void update({ category: event.target.value as TicketCategory })}
                  disabled={updating}
                  className="input"
                >
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
                  value={ticket.priority}
                  onChange={(event) => void update({ priority: event.target.value as TicketPriority })}
                  disabled={updating}
                  className="input"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Assignee</span>
                <select
                  aria-label="Assignee"
                  value={ticket.assignee?.id ?? ''}
                  onChange={(event) => void assign(event.target.value || null)}
                  disabled={updating}
                  className="input"
                >
                  <option value="">Unassigned</option>
                  {(team ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {ticket.assignee?.id !== user?.id ? (
              <button
                type="button"
                disabled={updating}
                onClick={() => void assign('me')}
                className="btn-secondary mt-3 w-full"
              >
                Assign to me
              </button>
            ) : null}
            {ticket.aiPriorityReason ? (
              <p className="mt-4 text-body-sm leading-relaxed text-[#64748b]">{ticket.aiPriorityReason}</p>
            ) : null}
          </Card>
          <Card className="p-5">
            <h2 className="text-headline-sm text-ink">Suggested reply</h2>
            <p className="mt-1 text-body-sm text-[#64748b]">Review and edit before sending.</p>
            {fallback ? (
              <p className="mt-3 text-body-sm text-[#B45309]">
                AI is unavailable. A standard reply is ready to edit.
              </p>
            ) : null}
            {draftError ? (
              <p role="alert" className="mt-3 text-body-sm text-danger">
                {draftError}
              </p>
            ) : null}
            <label htmlFor="draft-editor" className="field-label mt-4">
              Draft
            </label>
            <textarea
              id="draft-editor"
              value={draft}
              onChange={(event) => {
                draftEdited.current = true;
                setDraft(event.target.value);
              }}
              rows={10}
              maxLength={5000}
              className="input resize-y"
              placeholder={generating ? 'Preparing a reply…' : 'Write or generate a suggested reply.'}
            />
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => void regenerate()}
                disabled={generating}
                className="btn-secondary"
              >
                {generating ? <Spinner className="h-4 w-4" /> : null}
                {generating ? 'Preparing reply…' : 'Regenerate'}
              </button>
              <button
                type="button"
                disabled={!draft.trim()}
                className="btn-primary"
                onClick={() => {
                  setReply(draft);
                  setInternal(false);
                  composer.current?.focus();
                  composer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                Use in reply
              </button>
            </div>
            <details className="mt-4 border-t border-[#E2E8F0] pt-4">
              <summary className="cursor-pointer text-body-sm text-[#64748b]">Adjust draft</summary>
              <label className="mt-3 block">
                <span className="field-label">Tone</span>
                <select
                  aria-label="Tone"
                  value={tone}
                  onChange={(event) => setTone(event.target.value as Tone)}
                  className="input"
                >
                  <option value="EMPATHETIC">Empathetic</option>
                  <option value="CONCISE">Concise</option>
                  <option value="ESCALATION">Escalation</option>
                </select>
              </label>
              <label className="mt-3 block">
                <span className="field-label">Instructions (optional)</span>
                <input
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  maxLength={500}
                  className="input"
                />
              </label>
            </details>
          </Card>
        </div>
      </div>
    </div>
  );
};
