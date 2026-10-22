import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../store/toast';
import { Card, ErrorState, Spinner } from '../../components/ui';
import { Icon } from '../../components/Icon';

export const NewTicketPage = () => {
  const navigate = useNavigate();
  const { push } = useToast();
  const [params] = useSearchParams();
  const {
    data: books,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['books'], queryFn: api.books.list });
  const [bookId, setBookId] = useState(params.get('bookId') ?? '');
  const [subject, setSubject] = useState(params.get('subject') ?? '');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subjectError = subject.trim().length < 5 ? 'Enter a subject of at least 5 characters.' : null;
  const descriptionError =
    description.trim().length < 20 ? 'Describe the issue in at least 20 characters.' : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (subjectError || descriptionError || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.tickets.create({
        bookId: bookId || null,
        subject: subject.trim(),
        description: description.trim(),
      });
      push(`Ticket ${response.data.ticketNumber} submitted.`, 'success');
      navigate(`/app/tickets/${response.data.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'We could not submit your query. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };
  if (isLoading) return <div className="skeleton h-96 rounded-xl" />;
  if (isError) return <ErrorState onRetry={() => void refetch()} message="We could not load your books." />;
  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <Link to="/app/tickets" className="link inline-flex items-center gap-1 text-body-sm">
        <Icon name="arrow_back" className="text-[16px]" /> My tickets
      </Link>
      <h1 className="mt-4 text-[2rem] font-bold tracking-tight text-ink">Raise a support query</h1>
      <p className="mt-1 text-body-md text-[#64748b]">
        Tell us what you need help with. Our team will reply in your ticket.
      </p>
      <Card className="mt-6 p-5 sm:p-7">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="query-book" className="field-label">
              Book
            </label>
            <select
              id="query-book"
              value={bookId}
              onChange={(event) => setBookId(event.target.value)}
              className="input"
            >
              <option value="">General / Account Level</option>
              {(books ?? []).map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="query-subject" className="field-label">
              Subject
            </label>
            <input
              id="query-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={140}
              required
              className="input"
              placeholder="A short summary of your query"
              aria-invalid={touched && Boolean(subjectError)}
              aria-describedby={touched && subjectError ? 'subject-error' : undefined}
            />
            {touched && subjectError ? (
              <p id="subject-error" className="mt-1 text-body-sm text-danger">
                {subjectError}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="query-description" className="field-label">
              Description
            </label>
            <textarea
              id="query-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              rows={7}
              required
              className="input resize-y"
              placeholder="Include the details our team needs to help you."
              aria-invalid={touched && Boolean(descriptionError)}
              aria-describedby={touched && descriptionError ? 'description-error' : undefined}
            />
            {touched && descriptionError ? (
              <p id="description-error" className="mt-1 text-body-sm text-danger">
                {descriptionError}
              </p>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-5">
            <Link to="/app/tickets" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <Spinner className="h-4 w-4" /> : <Icon name="send" className="text-[17px]" />}
              {submitting ? 'Submitting…' : 'Submit query'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};
