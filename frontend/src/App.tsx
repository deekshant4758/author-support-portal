import { Navigate, Outlet, Route, Routes, Link } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Icon } from './components/Icon';
import { RequireRole, homeFor, useAuth } from './store/auth';
import { LiveProvider } from './store/live';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/author/Dashboard';
import { BooksPage } from './pages/author/Books';
import { NewTicketPage } from './pages/author/NewTicket';
import { TicketsPage } from './pages/author/Tickets';
import { TicketDetailPage } from './pages/author/TicketDetail';
import { AdminQueuePage } from './pages/admin/Queue';
import { AdminTicketPage } from './pages/admin/TicketConsole';
import { AnalyticsPage } from './pages/admin/Analytics';
import { KnowledgeBasePage } from './pages/admin/KnowledgeBase';

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#cbd5e1] border-t-primary" />
      </div>
    );
  }
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
};

const NotFoundPage = () => {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E5EEFF] text-primary">
        <Icon name="menu_book" className="text-[28px]" />
      </span>
      <div>
        <p className="text-label-sm uppercase tracking-[0.16em] text-[#94a3b8]">404 · Page not found</p>
        <h1 className="mt-1 text-headline-lg text-ink">This page is not in the catalogue.</h1>
        <p className="mx-auto mt-1 max-w-sm text-body-sm text-[#64748b]">
          The link may be outdated. Head back to your desk to continue.
        </p>
      </div>
      <Link to={user ? homeFor(user.role) : '/login'} className="btn-primary">
        <Icon name="arrow_back" className="text-[18px]" /> Back to my desk
      </Link>
    </div>
  );
};

export const App = () => (
  <Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<LoginPage />} />

    <Route
      path="/app"
      element={
        <RequireRole role="AUTHOR">
          <LiveProvider>
            <AppShell role="AUTHOR">
              <Outlet />
            </AppShell>
          </LiveProvider>
        </RequireRole>
      }
    >
      <Route index element={<Navigate to="/app/dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="books" element={<BooksPage />} />
      <Route path="tickets" element={<TicketsPage />} />
      <Route path="tickets/new" element={<NewTicketPage />} />
      <Route path="tickets/:id" element={<TicketDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>

    <Route
      path="/admin"
      element={
        <RequireRole role="ADMIN">
          <LiveProvider>
            <AppShell role="ADMIN">
              <Outlet />
            </AppShell>
          </LiveProvider>
        </RequireRole>
      }
    >
      <Route index element={<Navigate to="/admin/queue" replace />} />
      <Route path="queue" element={<AdminQueuePage />} />
      <Route path="tickets/:id" element={<AdminTicketPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="knowledge-base" element={<KnowledgeBasePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
