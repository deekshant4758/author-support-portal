import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Icon } from './Icon';
import { Avatar } from './ui';
import { useAuth } from '../store/auth';
import { useLiveStatus } from '../store/live';
import { api } from '../lib/api';
import { number } from '../lib/format';
import type { Role } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  exact?: boolean;
  badge?: number;
}

const Logo = () => (
  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 5.5h6.2c1.55 0 2.8 1.25 2.8 2.8V19c0-1.55-1.25-2.8-2.8-2.8H4V5.5Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M20 5.5h-6.2c-.6 0-1.15.2-1.6.52V19c.45-.32 1-.52 1.6-.52H20V5.5Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  </span>
);

const LiveChip = ({ status }: { status: 'connecting' | 'live' | 'offline' }) => {
  const config = {
    live: { label: 'Live sync', dot: 'bg-[#059669]', className: 'text-[#047857]' },
    connecting: { label: 'Connecting', dot: 'bg-[#F59E0B]', className: 'text-[#B45309]' },
    offline: { label: 'Reconnecting', dot: 'bg-[#94A3B8]', className: 'text-[#475569]' },
  }[status];

  return (
    <span
      className={clsx('hidden items-center gap-1.5 text-label-sm sm:inline-flex', config.className)}
      title={status === 'live' ? 'Real-time updates connected' : 'Real-time updates are reconnecting'}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', config.dot, status === 'live' && 'animate-pulse')} />
      {config.label}
    </span>
  );
};

export const AppShell = ({ role, children }: { role: Role; children: ReactNode }) => {
  const { user, logout } = useAuth();
  const status = useLiveStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = role === 'ADMIN';

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: api.admin.stats,
    enabled: isAdmin,
    staleTime: 30_000,
  });
  const { data: summary } = useQuery({
    queryKey: ['author-summary'],
    queryFn: api.authors.me,
    enabled: !isAdmin,
    staleTime: 30_000,
  });

  const nav: NavItem[] = isAdmin
    ? [
        {
          to: '/admin/queue',
          label: 'Ticket Queue',
          icon: 'inbox_customize',
          badge: stats?.totals.unresolved,
        },
      ]
    : [
        { to: '/app/dashboard', label: 'Overview', icon: 'space_dashboard', exact: true },
        { to: '/app/books', label: 'My Books', icon: 'auto_stories' },
        { to: '/app/tickets/new', label: 'Submit Query', icon: 'rate_review', exact: true },
        {
          to: '/app/tickets',
          label: 'My Tickets',
          icon: 'mark_email_unread',
          badge: summary?.metrics.openTickets,
        },
      ];

  const isActive = (item: NavItem) => {
    if (item.to === '/app/tickets') {
      // The "new ticket" route lives under /app/tickets but belongs to Submit Query.
      return (
        location.pathname === item.to ||
        (location.pathname.startsWith(`${item.to}/`) && !location.pathname.startsWith('/app/tickets/new'))
      );
    }
    return item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  };

  const current = nav.find(isActive);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  const onSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-label-sm uppercase tracking-[0.12em] text-[#94a3b8]">
          {isAdmin ? 'Operations Hub' : 'Author Desk'}
        </p>
        <nav className="space-y-1">
          {nav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-label-md transition-all',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-ink',
                )}
              >
                <Icon
                  name={item.icon}
                  className={clsx('text-[20px]', active ? 'text-white' : 'text-[#64748b]')}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge != null && item.badge > 0 ? (
                  <span
                    className={clsx(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold tabular',
                      active ? 'bg-white/20 text-white' : 'bg-[#E5EEFF] text-[#006948]',
                    )}
                  >
                    {number(item.badge)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <p className="px-4 pb-4 text-[11px] text-[#94a3b8]">BookLeaf Publishing</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md">
        <div className="flex h-full items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            className="btn-ghost -ml-1 p-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </button>

          <Link to={isAdmin ? '/admin/queue' : '/app/dashboard'} className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[17px] font-bold tracking-tight text-ink">BookLeaf</span>
            <span
              className={clsx(
                'hidden rounded px-1.5 py-0.5 text-label-sm uppercase tracking-wider sm:inline-block',
                isAdmin ? 'bg-ai-soft text-ai-deep' : 'bg-[#E5EEFF] text-[#3D4A42]',
              )}
            >
              {isAdmin ? 'Ops Hub' : 'Author Portal'}
            </span>
          </Link>

          {current ? (
            <>
              <span className="hidden h-5 w-px bg-[#E2E8F0] lg:block" />
              <span className="hidden text-label-md text-[#64748b] lg:block">{current.label}</span>
            </>
          ) : null}

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
            <LiveChip status={status} />
            <span className="hidden h-6 w-px bg-[#E2E8F0] sm:block" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg p-1 pr-1.5 transition-colors hover:bg-[#F1F5F9]"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <Avatar name={user?.name ?? 'BookLeaf'} size="sm" tone={isAdmin ? 'ai' : 'primary'} />
                <span className="hidden text-left sm:block">
                  <span className="block text-label-md font-semibold leading-tight text-ink">
                    {user?.name}
                  </span>
                  <span className="block text-[10px] uppercase tracking-wide text-[#94a3b8]">
                    {isAdmin ? 'Operations' : 'Author'}
                  </span>
                </span>
                <Icon name="keyboard_arrow_down" className="hidden text-[18px] text-[#64748b] sm:block" />
              </button>

              {menuOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lift animate-fade-up"
                  >
                    <div className="border-b border-[#E2E8F0] px-4 py-3">
                      <p className="text-label-md font-semibold text-ink">{user?.name}</p>
                      <p className="truncate text-body-sm text-[#64748b]">{user?.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-label-md text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-ink"
                      role="menuitem"
                    >
                      <Icon name="logout" className="text-[18px]" />
                      Sign out
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-64 border-r border-[#E2E8F0] bg-white lg:block">
        {sidebar()}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-drawer animate-slide-in">
            <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-4">
              <div className="flex items-center gap-2">
                <Logo />
                <span className="font-bold tracking-tight text-ink">BookLeaf</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="btn-ghost p-2"
                aria-label="Close navigation"
              >
                <Icon name="close" />
              </button>
            </div>
            {sidebar(() => setMobileOpen(false))}
          </div>
        </div>
      ) : null}

      <main className="pt-16 lg:pl-64">
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
};
