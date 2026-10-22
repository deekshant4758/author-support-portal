import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../../lib/api';

import { useToast } from '../../store/toast';
import { Avatar, Card, ErrorState, Modal, Spinner, StatusPill } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { formatDateTime } from '../../lib/format';

export const TicketDetailPage = () => {
  const { id = '' } = useParams();
  return <TicketThread key={id} id={id} />;
};

const TicketThread = ({ id }: { id: string }) => {
  const queryClient = useQueryClient();
  const { push } = useToast();

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const chatBox = useRef<HTMLDivElement>(null);
  const {
    data: ticket,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['ticket', id], queryFn: () => api.tickets.get(id), enabled: Boolean(id) });
  // Keep the newest message in view inside the chat box without scrolling the page.
  useEffect(() => {
    const box = chatBox.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [ticket?.messages.length]);
  const refresh = async () => {
    await Promise.all(
      [['ticket', id], ['tickets'], ['author-summary']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
  };
  const send = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.tickets.message(id, reply.trim());
      setReply('');
      await refresh();
      push('Reply sent to the BookLeaf desk.', 'success');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Your reply could not be sent.');
    } finally {
      setSending(false);
    }
  };
  const close = async () => {
    if (closing) return;
    setClosing(true);
    try {
      await api.tickets.close(id);
      await refresh();
      setConfirmClose(false);
      push('Ticket closed.', 'success');
    } catch (caught) {
      push(caught instanceof ApiError ? caught.message : 'Could not close the ticket.', 'error');
    } finally {
      setClosing(false);
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
      push(caught instanceof ApiError ? caught.message : 'Could not reopen the ticket.', 'error');
    } finally {
      setReopening(false);
    }
  };
  if (isLoading) return <div className="skeleton h-96 rounded-xl" />;
  if (isError || !ticket)
    return <ErrorState onRetry={() => void refetch()} message="We could not open this ticket." />;
  const closed = ticket.status === 'CLOSED';
  const messages = ticket.messages.filter(
    (message, index) => !(index === 0 && message.role === 'AUTHOR' && message.body === ticket.description),
  );
  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <Link to="/app/tickets" className="link inline-flex items-center gap-1 text-body-sm">
        <Icon name="arrow_back" className="text-[16px]" /> My tickets
      </Link>
      <div className="mt-4">
        <StatusPill status={ticket.status} />
      </div>
      <h1 className="mt-3 text-[1.8rem] font-bold tracking-tight text-ink">{ticket.subject}</h1>
      <p className="mt-1 text-body-sm text-[#64748b]">
        {ticket.ticketNumber} · Opened {formatDateTime(ticket.createdAt)}
        {ticket.book ? ` · ${ticket.book.title}` : ' · General / Account Level'}
      </p>
      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
          <h2 className="text-label-md font-semibold text-ink">Conversation</h2>
          <div className="flex items-center gap-3 text-[11px] text-[#64748b]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> You
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-[#CBD5E1] bg-white" /> BookLeaf Support
            </span>
          </div>
        </div>
        <div
          ref={chatBox}
          className="h-[460px] space-y-4 overflow-y-auto bg-[#F1F5F9] px-4 py-5 sm:px-5"
          aria-label="Conversation history"
        >
          <AuthorBubble mine name="You" label="Original query" time={ticket.createdAt} body={ticket.description} />
          {messages.map((message) =>
            message.role === 'SYSTEM' ? (
              <p key={message.id} className="text-center text-[11px] text-[#64748b]">
                {message.body} · {formatDateTime(message.createdAt)}
              </p>
            ) : (
              <AuthorBubble
                key={message.id}
                mine={message.role === 'AUTHOR'}
                name={message.role === 'AUTHOR' ? 'You' : message.authorName}
                label={message.role === 'AUTHOR' ? '' : 'BookLeaf Support'}
                time={message.createdAt}
                body={message.body}
              />
            ),
          )}
        </div>
        <div className="border-t border-[#E2E8F0] p-5">
          {closed ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body-sm text-[#64748b]">This ticket is closed.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" disabled={reopening} onClick={() => void reopen()}>
                  {reopening ? <Spinner className="h-4 w-4" /> : null}
                  Reopen ticket
                </button>
                <Link to="/app/tickets/new" className="btn-primary">
                  Raise a new query
                </Link>
              </div>
            </div>
          ) : (
            <>
              {ticket.status === 'RESOLVED' ? (
                <p className="mb-3 text-body-sm text-[#475569]">
                  Your query is marked resolved. Reply if you need more help, or close the ticket.
                </p>
              ) : null}
              <label htmlFor="reply" className="field-label">
                Reply to the desk
              </label>
              <textarea
                id="reply"
                rows={4}
                maxLength={5000}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                className="input max-h-64 resize-y"
                placeholder="Write your reply…"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              {error ? (
                <p role="alert" className="mt-2 text-body-sm text-danger">
                  {error}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap justify-between gap-3">
                <button type="button" className="btn-secondary" onClick={() => setConfirmClose(true)}>
                  Close ticket
                </button>
                <button
                  type="button"
                  disabled={!reply.trim() || sending}
                  className="btn-primary"
                  onClick={() => void send()}
                >
                  {sending ? <Spinner className="h-4 w-4" /> : <Icon name="send" className="text-[17px]" />}{' '}
                  Send reply
                </button>
              </div>
            </>
          )}
        </div>
      </Card>
      <Modal open={confirmClose} onClose={() => setConfirmClose(false)} title="Close this ticket?">
        <p className="text-body-sm text-[#64748b]">
          Close the ticket if your query is answered. You can submit a new query if you need help later.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setConfirmClose(false)}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={closing} onClick={() => void close()}>
            {closing ? 'Closing…' : 'Close ticket'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

const AuthorBubble = ({
  mine,
  name,
  label,
  time,
  body,
}: {
  mine: boolean;
  name: string;
  label: string;
  time: string;
  body: string;
}) => (
  <div className={clsx('flex items-end gap-2.5', mine && 'flex-row-reverse')}>
    <Avatar name={name} size="sm" tone={mine ? 'primary' : 'neutral'} />
    <div className={clsx('flex min-w-0 max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
      <p className="mb-1 px-1 text-[11px] text-[#64748b]">
        <span className="font-semibold text-[#334155]">{name}</span>
        {label ? ` · ${label}` : ''} · {formatDateTime(time)}
      </p>
      <div
        className={clsx(
          'rounded-2xl px-4 py-3 shadow-card',
          mine ? 'rounded-tr-sm bg-primary text-white' : 'rounded-tl-sm border border-[#E2E8F0] bg-white text-ink',
        )}
      >
        <p className="whitespace-pre-wrap break-words text-body-sm leading-relaxed">{body}</p>
      </div>
    </div>
  </div>
);