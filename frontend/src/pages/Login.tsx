import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { homeFor, useAuth } from '../store/auth';
import { Icon } from '../components/Icon';
import { BookCover } from '../components/BookCover';

export const LoginPage = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [adminLogin, setAdminLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const signedIn = await login(email, password, adminLogin ? 'ADMIN' : 'AUTHOR');
      const from = (location.state as { from?: string } | null)?.from;
      const destination =
        from && (signedIn.role === 'ADMIN' ? from.startsWith('/admin') : from.startsWith('/app'))
          ? from
          : homeFor(signedIn.role);
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'We could not sign you in. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Editorial brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#04382b] px-12 py-10 text-white lg:flex xl:px-16">
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #85f8c4 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #818CF8 0%, transparent 70%)' }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#85f8c4]" fill="currentColor" aria-hidden>
              <path d="M4 5.5h6.2c1.55 0 2.8 1.25 2.8 2.8V19c0-1.55-1.25-2.8-2.8-2.8H4V5.5Z" />
              <path d="M20 5.5h-6.2c-.6 0-1.15.2-1.6.52V19c.45-.32 1-.52 1.6-.52H20V5.5Z" opacity="0.65" />
            </svg>
          </span>
          <span className="text-[17px] font-bold tracking-tight">BookLeaf</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Author Support
          </span>
        </div>

        <div className="relative max-w-lg">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a7f3d0]">
            Publishing, without the wait
          </p>
          <h1 className="text-[2.6rem] font-bold leading-[1.12] tracking-[-0.03em] text-balance">
            Every author question, answered with care and precision.
          </h1>
          <p className="mt-4 max-w-md text-body-lg text-white/65">
            Royalties, ISBNs, print runs and distribution — one support desk, grounded in real
            publishing policy and built to respond fast.
          </p>

          <div className="mt-9 flex items-end gap-4">
            <div className="w-[92px] rotate-[-4deg]">
              <BookCover title="Whispers of the Ganges" author="Priya Sharma" genre="Literary Fiction" compact />
            </div>
            <div className="w-[104px] translate-y-[-10px] rotate-[2deg]">
              <BookCover title="Startup Sutra" author="Rohit Kapoor" genre="Business" compact />
            </div>
            <div className="w-[92px] rotate-[6deg]">
              <BookCover title="Midnight in Mysore" author="Sneha Kulkarni" genre="Thriller" compact />
            </div>
            <div className="mb-1 hidden xl:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#85f8c4]">22,000+ titles</p>
              <p className="mt-1 max-w-[120px] text-[12px] leading-relaxed text-white/50">
                Published across India and the US.
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-6 border-t border-white/10 pt-5 text-[11px] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="bolt" className="text-[15px] text-[#85f8c4]" /> AI-assisted triage
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="verified" className="text-[15px] text-[#85f8c4]" /> Policy-grounded drafts
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="sync" className="text-[15px] text-[#85f8c4]" /> Live thread updates
          </span>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-9 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M4 5.5h6.2c1.55 0 2.8 1.25 2.8 2.8V19c0-1.55-1.25-2.8-2.8-2.8H4V5.5Z" />
                <path d="M20 5.5h-6.2c-.6 0-1.15.2-1.6.52V19c.45-.32 1-.52 1.6-.52H20V5.5Z" opacity="0.65" />
              </svg>
            </span>
            <span className="text-[17px] font-bold tracking-tight">BookLeaf</span>
          </div>

          <p className="text-label-sm font-semibold uppercase tracking-[0.14em] text-primary">Welcome back</p>
          <h2 className="mt-1.5 text-[1.9rem] font-bold leading-tight tracking-tight text-ink">
            {adminLogin ? 'Admin sign in' : 'Author sign in'}
          </h2>
          <p className="mt-2 text-body-md text-[#64748b]">
            {adminLogin
              ? 'Sign in to manage author queries and support conversations.'
              : 'Sign in to track your books, royalties and support queries.'}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="field-label">
                Email address
              </label>
              <div className="relative">
                <Icon
                  name="mail"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#94a3b8]"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="field-label">
                  Password
                </label>
              </div>
              <div className="relative">
                <Icon
                  name="lock"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#94a3b8]"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input pl-10 pr-11"
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#64748b] hover:bg-[#F1F5F9]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                </button>
              </div>
            </div>

            {error ? (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft px-3.5 py-3 text-body-sm text-danger-deep animate-fade-up">
                <Icon name="error" className="mt-0.5 text-[17px]" />
                <span>{error}</span>
              </div>
            ) : null}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in…
                </>
              ) : (
                <>
                  {adminLogin ? 'Sign in as admin' : 'Sign in as author'}
                  <Icon name="arrow_forward" className="text-[18px]" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 border-t border-[#E2E8F0] pt-5 text-center">
            <p className="text-body-sm text-[#64748b]">
              {adminLogin ? 'Looking for your author desk?' : 'Part of the BookLeaf team?'}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setAdminLogin((current) => !current);
                setEmail('');
                setPassword('');
                setShowPassword(false);
                setError(null);
              }}
              className="btn-secondary mt-3 w-full"
            >
              <Icon name={adminLogin ? 'arrow_back' : 'admin_panel_settings'} className="text-[18px]" />
              {adminLogin ? 'Back to author login' : 'Admin login'}
            </button>
          </div>

          <p className="mt-7 flex items-start gap-1.5 text-[11px] leading-relaxed text-[#94a3b8]">
            <Icon name="shield" className="mt-px text-[14px]" />
            Your account gives you secure access to your BookLeaf desk.
          </p>
        </div>
      </div>
    </div>
  );
};
