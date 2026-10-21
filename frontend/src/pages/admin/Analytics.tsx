import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { Card, EmptyState, ErrorState, MetricCard, ProgressBar } from '../../components/ui';
import { CATEGORY_LABELS, formatDuration, number, timeAgo } from '../../lib/format';
import type { TicketCategory, TicketPriority } from '../../lib/types';

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  CRITICAL: 'bg-danger',
  HIGH: 'bg-[#F97316]',
  MEDIUM: 'bg-[#64748B]',
  LOW: 'bg-[#CBD5E1]',
};

export const AnalyticsPage = () => {
  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: api.admin.stats,
  });
  const { data: usage } = useQuery({
    queryKey: ['admin-usage'],
    queryFn: api.admin.aiUsage,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-9 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-72 rounded-xl" />
      </div>
    );
  }

  if (isError || !stats) {
    return <ErrorState onRetry={() => void refetch()} message="We could not load operations analytics." />;
  }

  const totalCategoryCount = Object.values(stats.categories).reduce((sum, value) => sum + value, 0) || 1;
  const totalPriorityCount =
    Object.values(stats.priorities).reduce((sum, value) => sum + value, 0) || 1;
  const totalStatusCount = Object.values(stats.statuses).reduce((sum, value) => sum + value, 0) || 1;
  const categorized = Object.entries(stats.categories) as Array<[TicketCategory, number]>;
  const prioritized = Object.entries(stats.priorities) as Array<[TicketPriority, number]>;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm font-semibold uppercase tracking-[0.14em] text-ai-deep">Intelligence layer</p>
          <h1 className="mt-1.5 text-[2rem] font-bold leading-tight tracking-[-0.03em] text-ink">
            AI &amp; Operations Analytics
          </h1>
          <p className="mt-1 max-w-2xl text-body-md text-[#64748b]">
            Triage quality, queue health and the real token economics of the support copilot.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[10px] text-[#475569] sm:self-auto">
          <Icon name="database" className="text-[14px] text-primary" />
          Live from the support database
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="AI auto-classified"
          value={`${stats.percentages.autoClassified}%`}
          icon="auto_awesome"
          accent="text-ai-deep"
          hint={`${stats.totals.total} tickets processed`}
        />
        <MetricCard
          label="Avg first response"
          value={formatDuration(stats.avgFirstResponseMinutes)}
          icon="timer"
          hint={
            <span className="inline-flex items-center gap-1">
              <Icon name="target" className="text-[13px] text-primary" /> Target under 2h
            </span>
          }
        />
        <MetricCard
          label="Estimated AI spend"
          value={`$${stats.ai.estimatedCostUsd.toFixed(4)}`}
          icon="payments"
          hint={`${number(stats.ai.tokens)} tokens · ${stats.ai.calls} calls`}
        />
        <MetricCard
          label="Fallback rate"
          value={`${stats.percentages.fallbackRate}%`}
          icon="shield"
          accent={stats.percentages.fallbackRate > 0 ? 'text-[#B45309]' : 'text-ink'}
          hint={`${stats.ai.cacheHits} cache hits · ${stats.ai.fallbacks} graceful fallbacks`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-headline-sm text-ink">Category mix</h2>
              <p className="text-body-sm text-[#64748b]">Where author demand is concentrated.</p>
            </div>
            <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-semibold text-[#475569]">
              All time
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {categorized
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => {
                const pct = Math.round((count / totalCategoryCount) * 100);
                return (
                  <div key={category}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium text-[#475569]">{CATEGORY_LABELS[category]}</span>
                      <span className="font-bold text-ink tabular">
                        {count} <span className="font-normal text-[#94a3b8]">· {pct}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#E5EEFF]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#006948] to-[#34D399]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-headline-sm text-ink">Priority &amp; queue health</h2>
              <p className="text-body-sm text-[#64748b]">AI scoring distribution and SLA exposure.</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#FECACA] bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger-deep">
              <Icon name="alarm" className="text-[11px]" /> {stats.totals.overdueCount} overdue
            </span>
          </div>

          <div className="mt-4 flex items-center gap-5">
            <div
              className="relative flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${prioritized
                  .map(([priority, count], index) => {
                    const previous = prioritized
                      .slice(0, index)
                      .reduce((sum, [, value]) => sum + value, 0);
                    const start = (previous / totalPriorityCount) * 100;
                    const end = ((previous + count) / totalPriorityCount) * 100;
                    const color =
                      priority === 'CRITICAL'
                        ? '#BA1A1A'
                        : priority === 'HIGH'
                          ? '#F97316'
                          : priority === 'MEDIUM'
                            ? '#64748B'
                            : '#CBD5E1';
                    return `${color} ${start}% ${end}%`;
                  })
                  .join(', ')})`,
              }}
            >
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-[1.5rem] font-bold leading-none text-ink tabular">{stats.totals.total}</span>
                <span className="text-[9px] uppercase tracking-wide text-[#94a3b8]">tickets</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {prioritized.map(([priority, count]) => (
                <div key={priority} className="flex items-center gap-2 text-[11px]">
                  <span className={`h-2 w-2 rounded-full ${PRIORITY_COLORS[priority]}`} />
                  <span className="flex-1 capitalize text-[#475569]">{priority.toLowerCase()}</span>
                  <span className="font-bold text-ink tabular">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#E2E8F0] pt-3">
            <div>
              <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">Resolved rate</p>
              <div className="mt-1 flex items-center gap-2">
                <ProgressBar value={stats.percentages.resolvedRate} max={100} className="max-w-[90px]" />
                <span className="text-[11px] font-bold text-ink tabular">{stats.percentages.resolvedRate}%</span>
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">Unassigned</p>
              <p className="mt-1 text-[11px] font-bold text-ink tabular">{stats.totals.unassignedOpen} open</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-headline-sm text-ink">AI token &amp; cost telemetry</h2>
              <p className="text-body-sm text-[#64748b]">
                Every call is logged server-side. No prompt or API key is exposed to the browser.
              </p>
            </div>
            <span className="rounded-full border border-ai-border bg-ai-soft px-2 py-0.5 text-[10px] font-semibold text-ai-deep">
              {stats.ai.byOperation.CLASSIFY} classify · {stats.ai.byOperation.DRAFT} drafts
            </span>
          </div>

          {usage && usage.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    {['Operation', 'Model', 'Tokens', 'Cost', 'Latency', 'Status', 'When'].map((header) => (
                      <th key={header} className="py-2 pr-3 text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {usage.slice(0, 10).map((entry) => (
                    <tr key={entry.id} className="text-[11px]">
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-ink">
                          <Icon
                            name={entry.operation === 'CLASSIFY' ? 'account_tree' : 'draw'}
                            className={clsx('text-[13px]', entry.operation === 'CLASSIFY' ? 'text-[#475569]' : 'text-ai')}
                          />
                          {entry.operation === 'CLASSIFY' ? 'Classify' : 'Draft'}
                        </span>
                      </td>
                      <td className="max-w-[140px] truncate py-2 pr-3 text-[#64748b]">{entry.model}</td>
                      <td className="py-2 pr-3 text-[#475569] tabular">
                        {entry.promptTokens + entry.completionTokens}
                      </td>
                      <td className="py-2 pr-3 text-[#475569] tabular">${entry.estimatedCostUsd.toFixed(5)}</td>
                      <td className="py-2 pr-3 text-[#475569] tabular">
                        {entry.latencyMs > 0 ? `${entry.latencyMs}ms` : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {entry.cached ? (
                          <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[9px] text-[#475569]">
                            Cached
                          </span>
                        ) : entry.fallback ? (
                          <span className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-1.5 py-0.5 text-[9px] text-[#B45309]">
                            Fallback
                          </span>
                        ) : entry.success ? (
                          <span className="rounded border border-[#A7F3D0] bg-[#ECFDF5] px-1.5 py-0.5 text-[9px] text-[#047857]">
                            Success
                          </span>
                        ) : (
                          <span className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] text-danger">
                            Error
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-[#94a3b8]">{timeAgo(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                icon="data_usage"
                title="No AI calls logged yet"
                message="Generate a draft or create a ticket to populate token and cost telemetry."
              />
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { label: 'Prompt tokens', value: number(usage?.reduce((sum, entry) => sum + entry.promptTokens, 0) ?? 0) },
              {
                label: 'Completion tokens',
                value: number(usage?.reduce((sum, entry) => sum + entry.completionTokens, 0) ?? 0),
              },
              {
                label: 'Avg latency',
                value: stats.ai.avgLatencyMs > 0 ? `${stats.ai.avgLatencyMs}ms` : '—',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <p className="text-[9px] uppercase tracking-wide text-[#94a3b8]">{item.label}</p>
                <p className="mt-0.5 text-label-md font-bold text-ink tabular">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon name="savings" className="text-[19px] text-primary" />
              <h2 className="text-headline-sm text-ink">Cost-aware by design</h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {[
                ['Retrieval, not the whole KB', 'Only the 2–3 policy sections that match the ticket are sent.'],
                ['Compact account facts', 'A structured fact block replaces raw database rows.'],
                ['Two models by task', 'A smaller model classifies; a stronger one drafts.'],
                ['30-minute caching', 'Re-generating an unchanged draft costs no tokens.'],
                ['Token ceilings', 'Description and context are truncated before every call.'],
              ].map(([title, copy]) => (
                <li key={title} className="flex gap-2">
                  <Icon name="check_circle" className="mt-0.5 text-[14px] text-primary" filled />
                  <div>
                    <p className="text-[11px] font-semibold text-ink">{title}</p>
                    <p className="text-[10px] leading-relaxed text-[#64748b]">{copy}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon name="health_and_safety" className="text-[19px] text-primary" />
              <h2 className="text-headline-sm text-ink">Graceful degradation</h2>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#64748b]">
              If Groq is down, rate-limited or the key is missing, ticket creation still succeeds. The rule engine
              assigns a category and priority, and the draft studio falls back to a policy-grounded template.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-2">
              <Icon name="offline_bolt" className="text-[16px] text-[#B45309]" />
              <div>
                <p className="text-[10px] font-semibold text-[#B45309]">
                  {stats.ai.fallbacks} fallback{stats.ai.fallbacks === 1 ? '' : 's'} recorded
                </p>
                <p className="text-[9px] text-[#B45309]/80">Authors are never blocked by an AI outage.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-headline-sm text-ink">Queue volume by status</h2>
            <p className="text-body-sm text-[#64748b]">Snapshot of the current support lifecycle.</p>
          </div>
          <span className="text-[10px] text-[#94a3b8] tabular">
            {stats.totals.open} open · {stats.totals.inProgress} in progress · {stats.totals.resolved} resolved ·{' '}
            {stats.totals.closed} closed
          </span>
        </div>
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[#E5EEFF]">
          <div className="bg-[#F59E0B]" style={{ width: `${(stats.statuses.OPEN / totalStatusCount) * 100}%` }} />
          <div className="bg-ai" style={{ width: `${(stats.statuses.IN_PROGRESS / totalStatusCount) * 100}%` }} />
          <div className="bg-[#059669]" style={{ width: `${(stats.statuses.RESOLVED / totalStatusCount) * 100}%` }} />
          <div className="bg-[#94A3B8]" style={{ width: `${(stats.statuses.CLOSED / totalStatusCount) * 100}%` }} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { label: 'Open', value: stats.statuses.OPEN, color: 'bg-[#F59E0B]' },
            { label: 'In progress', value: stats.statuses.IN_PROGRESS, color: 'bg-ai' },
            { label: 'Resolved', value: stats.statuses.RESOLVED, color: 'bg-[#059669]' },
            { label: 'Closed', value: stats.statuses.CLOSED, color: 'bg-[#94A3B8]' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${item.color}`} />
              <span className="text-[10px] text-[#64748b]">{item.label}</span>
              <span className="ml-auto text-label-md font-bold text-ink tabular">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#94a3b8]">
        <Icon name="verified_user" className="text-[13px]" />
        AI output is logged, reviewable and never sent to an author without an operations specialist approving it.
      </p>
    </div>
  );
};
