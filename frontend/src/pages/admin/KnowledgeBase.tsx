import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Card, CategoryPill, CopyButton, EmptyState, ErrorState } from '../../components/ui';
import { CATEGORY_LABELS } from '../../lib/format';
import type { TicketCategory } from '../../lib/types';

export const KnowledgeBasePage = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'ALL' | TicketCategory>('ALL');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: api.knowledge.list,
    staleTime: 5 * 60_000,
  });

  const sections = data ?? [];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sections.filter((section) => {
      const matchesCategory = category === 'ALL' || section.categories.includes(category);
      const matchesSearch =
        !query ||
        section.title.toLowerCase().includes(query) ||
        section.content.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [sections, search, category]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-9 w-64" />
        <div className="skeleton h-12 rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) return <ErrorState onRetry={() => void refetch()} message="We could not load the knowledge base." />;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm font-semibold uppercase tracking-[0.14em] text-primary">Grounding library</p>
          <h1 className="mt-1.5 text-[2rem] font-bold leading-tight tracking-[-0.03em] text-ink">
            Knowledge Base &amp; Policies
          </h1>
          <p className="mt-1 max-w-2xl text-body-md text-[#64748b]">
            The exact BookLeaf policy sections retrieved for AI drafts. Only the relevant 2–3 sections are sent per
            call, keeping prompts small and responses accurate.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[10px] text-[#475569] sm:self-auto">
          <Icon name="menu_book" className="text-[14px] text-primary" />
          {sections.length} curated sections
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:w-80">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#94a3b8]"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search policy, keyword or section…"
            className="input pl-9"
            aria-label="Search knowledge base"
          />
        </div>
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white p-1">
          <button
            type="button"
            onClick={() => setCategory('ALL')}
            className={clsx(
              'whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
              category === 'ALL' ? 'bg-primary text-white' : 'text-[#475569] hover:bg-[#F1F5F9]',
            )}
          >
            All sections
          </button>
          {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={clsx(
                'whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                category === value ? 'bg-primary text-white' : 'text-[#475569] hover:bg-[#F1F5F9]',
              )}
            >
              {CATEGORY_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="No policy sections match"
              message="Try a different keyword or clear the category filter."
              action={
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSearch('');
                    setCategory('ALL');
                  }}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            filtered.map((section) => (
              <Card key={section.id} hover className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#E5EEFF] text-primary">
                      <Icon name="menu_book" className="text-[19px]" />
                    </span>
                    <div>
                      <h2 className="text-headline-sm text-ink">{section.title}</h2>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wide text-[#94a3b8]">
                        kb://{section.id}
                      </p>
                    </div>
                  </div>
                  <CopyButton value={section.content} label="Copy section" />
                </div>

                <p className="mt-3 text-body-sm leading-relaxed text-[#475569]">{section.content}</p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#E2E8F0] pt-3">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">Applies to</span>
                  {section.categories.slice(0, 3).map((value) => (
                    <CategoryPill key={value} category={value} className="!py-0.5 !text-[9px]" />
                  ))}
                  {section.categories.length > 3 ? (
                    <span className="text-[9px] text-[#94a3b8]">+{section.categories.length - 3}</span>
                  ) : null}
                  <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-[#047857]">
                    <Icon name="check_circle" className="text-[11px]" />
                    Used for grounding
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon name="auto_awesome" className="text-[19px] text-ai" />
              <h2 className="text-headline-sm text-ink">Retrieval strategy</h2>
            </div>
            <ol className="mt-3 space-y-2.5">
              {[
                ['Tag by category', 'Each section declares the categories it applies to.'],
                ['Score keywords', 'Ticket text is matched against section keywords.'],
                ['Top 2–3 only', 'Only the highest-scoring sections enter the prompt.'],
                ['Cap characters', 'A hard character cap prevents runaway token cost.'],
              ].map(([title, copy], index) => (
                <li key={title} className="flex gap-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F5F3FF] text-[9px] font-bold text-[#6D28D9]">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-ink">{title}</p>
                    <p className="text-[10px] leading-relaxed text-[#64748b]">{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon name="verified_user" className="text-[19px] text-primary" />
              <h2 className="text-headline-sm text-ink">Guardrails</h2>
            </div>
            <ul className="mt-2.5 space-y-2">
              {[
                'Never invent amounts, dates or policy.',
                'Own BookLeaf errors without deflection.',
                'Always give a concrete next step and timeline.',
                'Internal notes never enter author prompts or threads.',
                'Human approval before any reply is sent.',
              ].map((rule) => (
                <li key={rule} className="flex gap-1.5 text-[10px] leading-relaxed text-[#64748b]">
                  <Icon name="check" className="mt-0.5 flex-shrink-0 text-[12px] text-primary" />
                  {rule}
                </li>
              ))}
            </ul>
          </Card>

          <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF]/60 p-4">
            <div className="flex items-center gap-1.5 text-[#5B21B6]">
              <Icon name="lock" className="text-[15px]" />
              <p className="text-label-md font-semibold">Server-side only</p>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-[#5B21B6]/80">
              This content is served through an authenticated endpoint. The Groq API key lives only in the backend
              environment and is never sent to the browser.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
