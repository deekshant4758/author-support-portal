import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useToast } from '../../store/toast';
import { Avatar, Card, ErrorState, Modal, PageLoader, PriorityPill, Spinner, StatusPill } from '../../components/ui';
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
  const composer = useRef<HTMLTextAreaElement>(null);
  const chatBox = useRef<HTMLDivElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.tickets.get(id),
    enabled: Boolean(id),
  });
  const { data: ticket } = ticketQuery;
  const { data: team } = useQuery({ queryKey: ['admin-team'], queryFn: api.admin.team });

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
      push(payload.status === 'CLOSED' ? 'Ticket closed.' : 'Ticket updated.', 'success');
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
  const reopen = async () => {
    if (reopening) return;
    setReopening(true);
    try {
      await api.tickets.reopen(id);
      await refresh();
      push('Ticket reopened.', 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'The ticket could not be reopened.', 'error');
    } finally {
      setReopening(false);
    }
  };
  const messageCount = ticket?.messages.length ?? 0;
  // Keep the newest message in view inside the chat box without scrolling the page.
  useEffect(() => {
    const box = chatBox.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messageCount]);
  if (ticketQuery.isLoading)
    return <PageLoader label="Opening the ticket workspace…" hint="Loading the conversation and triage details." />;
  if (ticketQuery.isError || !ticket)
    return <ErrorState onRetry={() => void ticketQuery.refetch()} message="We could not open this ticket." />;
  const messages = ticket.messages.filter(
    (message, index) => !(index === 0 && message.role === 'AUTHOR' && message.body === ticket.description),
  );
  const finished = ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';
  return (
    <div className="animate-fade-up">
      <Link to="/admin/queue" className="link inline-flex items-center gap-1 text-body-sm">
        <Icon name="arrow_back" className="text-[16px]" /> Ticket queue
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.8rem] font-bold tracking-tight text-ink">{ticket.subject}</h1>
          <p className="mt-1 text-body-sm text-[#64748b]">
            {ticket.ticketNumber} · Opened {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {finished ? (
            <button type="button" className="btn-secondary" disabled={reopening} onClick={() => void reopen()}>
              {reopening ? <Spinner className="h-4 w-4" /> : <Icon name="replay" className="text-[17px]" />}
              Reopen
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              disabled={updating}
              onClick={() => void update({ status: 'CLOSED' })}
            >
              <Icon name="task_alt" className="text-[17px]" /> Close ticket
            </button>
          )}
          <button type="button" className="btn-primary" onClick={() => setDetailsOpen(true)}>
            <Icon name="edit" className="text-[17px]" /> Edit details
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-body-sm text-[#475569]">
        <StatusPill status={ticket.status} />
        <PriorityPill priority={ticket.priority} />
        <span className="rounded-md border border-[#E2E8F0] bg-white px-2 py-0.5">
          {CATEGORY_LABELS[ticket.category]}
        </span>
        <span className="rounded-md border border-[#E2E8F0] bg-white px-2 py-0.5">
          {ticket.assignee ? `Assigned to ${ticket.assignee.name}` : 'Unassigned'}
        </span>
      </div>
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
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
              <h2 className="text-headline-sm text-ink">Conversation</h2>
              <div className="flex items-center gap-3 text-[11px] text-[#64748b]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border border-[#CBD5E1] bg-white" /> Author
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Support
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FCD34D]" /> Internal
                </span>
              </div>
            </div>
            <div
              ref={chatBox}
              className="h-[460px] space-y-4 overflow-y-auto bg-[#F1F5F9] px-4 py-5 sm:px-5"
              aria-label="Conversation history"
            >
              <ChatBubble
                side="left"
                tone="author"
                name={ticket.author?.name ?? 'Author'}
                label="Original query"
                time={ticket.createdAt}
                body={ticket.description}
              />
              {messages.map((message) =>
                message.role === 'SYSTEM' ? (
                  <p key={message.id} className="text-center text-[11px] text-[#64748b]">
                    {message.body} · {formatDateTime(message.createdAt)}
                  </p>
                ) : (
                  <ChatBubble
                    key={message.id}
                    side={message.role === 'AUTHOR' ? 'left' : 'right'}
                    tone={message.role === 'AUTHOR' ? 'author' : message.isInternal ? 'internal' : 'support'}
                    name={message.authorName}
                    label={message.isInternal ? 'Internal note' : message.role === 'AUTHOR' ? 'Author' : 'Support'}
                    time={message.createdAt}
                    body={message.body}
                  />
                ),
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
                rows={4}
                maxLength={5000}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder={internal ? 'Add a private note…' : 'Write your reply…'}
                className="input max-h-64 resize-y"
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
        <Card className="p-5 xl:sticky xl:top-20">
          <div className="flex items-center gap-2">
            <Icon name="auto_awesome" className="text-[20px] text-ai" />
            <h2 className="text-headline-sm text-ink">Generate response with AI</h2>
          </div>
          <p className="mt-1 text-body-sm text-[#64748b]">
            Pick a tone and add any guidance, then generate. The draft uses the full conversation and the
            author&apos;s account details. Nothing is sent until you send it.
          </p>
          <label className="mt-4 block">
            <span className="field-label">Tone</span>
            <select
              aria-label="Tone"
              value={tone}
              onChange={(event) => setTone(event.target.value as Tone)}
              disabled={generating}
              className="input"
            >
              <option value="EMPATHETIC">Empathetic</option>
              <option value="CONCISE">Concise</option>
              <option value="ESCALATION">Escalation</option>
            </select>
          </label>
          <label htmlFor="draft-guidance" className="field-label mt-3">
            Your input (optional)
          </label>
          <textarea
            id="draft-guidance"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={generating}
            className="input resize-y"
            placeholder="e.g. Confirm the reprint is approved and ask for the delivery address."
          />
          <p className="mt-1 text-right text-[11px] text-[#94A3B8]">{instructions.length}/500</p>
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={generating}
            className="btn-primary mt-2 w-full justify-center"
          >
            {generating ? <Spinner className="h-4 w-4" /> : <Icon name="auto_awesome" className="text-[17px]" />}
            {generating ? 'Generating draft…' : draft ? 'Generate again' : 'Generate draft'}
          </button>
          {draftError ? (
            <p role="alert" className="mt-3 text-body-sm text-danger">
              {draftError}
            </p>
          ) : null}
          {draft || generating ? (
            <div className="mt-5 border-t border-[#E2E8F0] pt-4">
              {fallback ? (
                <p className="mb-3 text-body-sm text-[#B45309]">
                  AI is unavailable. A standard reply is ready to edit.
                </p>
              ) : null}
              <label htmlFor="draft-editor" className="field-label">
                Suggested reply
              </label>
              <textarea
                id="draft-editor"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={14}
                maxLength={5000}
                disabled={generating}
                className="input resize-y"
                placeholder="Preparing a reply…"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={!draft.trim() || generating}
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
            </div>
          ) : null}
        </Card>
      </div>      <Modal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Ticket details"
        description="Changes save as soon as you pick a value."
        footer={
          <button type="button" className="btn-primary" onClick={() => setDetailsOpen(false)}>
            Done
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
            className="btn-secondary mt-4 w-full"
          >
            Assign to me
          </button>
        ) : null}
        {ticket.aiPriorityReason ? (
          <p className="mt-4 text-body-sm leading-relaxed text-[#64748b]">{ticket.aiPriorityReason}</p>
        ) : null}
      </Modal>
    </div>
  );
};

const BUBBLE_TONES = {
  author: 'rounded-tl-sm border border-[#E2E8F0] bg-white text-ink',
  support: 'rounded-tr-sm bg-primary text-white',
  internal: 'rounded-tr-sm border border-[#FCD34D] bg-[#FFFBEB] text-ink',
} as const;

const ChatBubble = ({
  side,
  tone,
  name,
  label,
  time,
  body,
}: {
  side: 'left' | 'right';
  tone: keyof typeof BUBBLE_TONES;
  name: string;
  label: string;
  time: string;
  body: string;
}) => (
  <div className={clsx('flex items-end gap-2.5', side === 'right' && 'flex-row-reverse')}>
    <Avatar name={name} size="sm" tone={tone === 'author' ? 'neutral' : 'primary'} />
    <div className={clsx('flex min-w-0 max-w-[78%] flex-col', side === 'right' ? 'items-end' : 'items-start')}>
      <p className="mb-1 px-1 text-[11px] text-[#64748b]">
        <span className="font-semibold text-[#334155]">{name}</span> · {label} · {formatDateTime(time)}
      </p>
      <div className={clsx('rounded-2xl px-4 py-3 shadow-card', BUBBLE_TONES[tone])}>
        <p className="whitespace-pre-wrap break-words text-body-sm leading-relaxed">{body}</p>
      </div>
    </div>
  </div>
);