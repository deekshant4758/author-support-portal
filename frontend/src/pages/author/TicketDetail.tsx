import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../../lib/api';
import { useLiveStatus } from '../../store/live';
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
  const live = useLiveStatus();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(0);
  const {
    data: ticket,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['ticket', id], queryFn: () => api.tickets.get(id), enabled: Boolean(id) });
  useEffect(() => {
    const count = ticket?.messages.length ?? 0;
    if (previousCount.current > 0 && count > previousCount.current)
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    previousCount.current = count;
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <StatusPill status={ticket.status} />
        <span className="text-body-sm text-[#64748b]">
          {live === 'live' ? 'Live thread' : live === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </span>
      </div>
      <h1 className="mt-3 text-[1.8rem] font-bold tracking-tight text-ink">{ticket.subject}</h1>
      <p className="mt-1 text-body-sm text-[#64748b]">
        {ticket.ticketNumber} · Opened {formatDateTime(ticket.createdAt)}
        {ticket.book ? ` · ${ticket.book.title}` : ' · General / Account Level'}
      </p>
      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-[#E2E8F0] p-5">
          <h2 className="text-label-md font-semibold text-ink">Original query</h2>
          <p className="mt-2 whitespace-pre-wrap text-body-sm leading-relaxed text-[#475569]">
            {ticket.description}
          </p>
          {ticket.attachmentName ? (
            <p className="mt-3 break-all text-body-sm text-[#64748b]">
              Attachment reference: {ticket.attachmentName}
            </p>
          ) : null}
        </div>
        <div className="space-y-5 bg-[#F8FAFC] p-5">
          {messages.length === 0 ? (
            <p className="text-body-sm text-[#64748b]">No replies yet.</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={clsx('flex gap-3', message.role === 'AUTHOR' && 'flex-row-reverse')}
              >
                {message.role !== 'SYSTEM' ? (
                  <Avatar
                    name={message.authorName}
                    size="sm"
                    tone={message.role === 'AUTHOR' ? 'primary' : 'neutral'}
                  />
                ) : null}
                <div
                  className={clsx(
                    'min-w-0 max-w-[90%] rounded-lg border p-3.5',
                    message.role === 'AUTHOR' ? 'border-[#A7F3D0] bg-[#F0FDF7]' : 'border-[#E2E8F0] bg-white',
                  )}
                >
                  <p className="text-[11px] text-[#64748b]">
                    {message.role === 'AUTHOR'
                      ? 'You'
                      : message.role === 'SYSTEM'
                        ? 'BookLeaf Support'
                        : message.authorName}{' '}
                    · {formatDateTime(message.createdAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-body-sm leading-relaxed text-ink">
                    {message.body}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-[#E2E8F0] p-5">
          {closed ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body-sm text-[#64748b]">This ticket is closed.</p>
              <Link to="/app/tickets/new" className="btn-primary">
                Raise a new query
              </Link>
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
                className="input resize-y"
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
