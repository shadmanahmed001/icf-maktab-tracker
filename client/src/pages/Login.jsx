/**
 * Sign-in.
 *
 * One form for all three roles, because a teacher on a phone should not have to
 * pick "I am a teacher" first — the account already knows. The single secret
 * field accepts either a password or a numeric PIN.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ArrowRight, ShieldCheck, GraduationCap, Users } from 'lucide-react';
import { api } from '../lib/api';
import { HOME_FOR_ROLE, useAuth } from '../lib/auth';
import { Alert, Button, Field, Input, Spinner } from '../ui';
import { MaktabMark } from '../layout/AppShell';
import { ThemeToggle } from '../features/ThemeToggle';

const ROLE_META = {
  admin: { icon: ShieldCheck, label: 'Administration', blurb: 'Pacing across every grade' },
  teacher: { icon: GraduationCap, label: 'Teacher', blurb: 'Daily check-off in under a minute' },
  parent: { icon: Users, label: 'Parent', blurb: "Your own child's progress" },
};

export default function Login() {
  const { signIn, isSignedIn, user } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null);

  // Already signed in — go straight to the right portal.
  useEffect(() => {
    if (isSignedIn && user) navigate(HOME_FOR_ROLE[user.role] || '/', { replace: true });
  }, [isSignedIn, user, navigate]);

  useEffect(() => {
    api.demoAccounts().then(setDemo).catch(() => setDemo({ enabled: false, accounts: [] }));
  }, []);

  const submit = async (event) => {
    event?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const signedIn = await signIn(identifier.trim(), secret);
      navigate(HOME_FOR_ROLE[signedIn.role] || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  };

  /** Fill the form from a demo account and sign straight in. */
  const signInWithDemoAccount = async (account) => {
    setIdentifier(account.email);
    setSecret(demo.password);
    setError(null);
    setBusy(true);
    try {
      const signedIn = await signIn(account.email, demo.password);
      navigate(HOME_FOR_ROLE[signedIn.role] || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  };

  const grouped = (demo?.accounts || []).reduce((acc, account) => {
    (acc[account.role] ||= []).push(account);
    return acc;
  }, {});

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      {/* Reachable before anyone signs in: a tester who finds the dark scheme
          hard to read should not have to get through the form first. */}
      <div className="absolute right-3 top-3 z-10">
        <ThemeToggle />
      </div>
      {/* Brand panel */}
      <div
        className="motif relative flex shrink-0 flex-col justify-between overflow-hidden px-6 py-8 sm:px-10 lg:w-[46%] lg:py-12"
        style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="relative">
          <div className="flex items-center gap-3">
            <MaktabMark size={40} />
            <div>
              <p className="text-[0.95rem] font-semibold leading-tight" style={{ color: 'var(--text-strong)' }}>
                Islamic Center of Fremont
              </p>
              <p className="text-[0.8rem]" style={{ color: 'var(--accent-text)' }}>Daily Maktab</p>
            </div>
          </div>

          <h1
            className="mt-8 max-w-md text-2xl font-semibold leading-tight tracking-[-0.015em] sm:text-3xl lg:mt-12"
            style={{ color: 'var(--text-strong)' }}
          >
            Academic standards and progress, in one place.
          </h1>
          <p className="mt-3 max-w-md text-[0.9rem] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            The An-Nasīḥah syllabus for 2026–2027, tracked from the daily lesson check-off through
            to each family&rsquo;s end-of-term report — replacing the paper binders.
          </p>

          <dl className="mt-8 grid gap-3 sm:grid-cols-3 lg:mt-10">
            {Object.entries(ROLE_META).map(([role, meta]) => {
              const Icon = meta.icon;
              return (
                <div
                  key={role}
                  className="rounded-xl px-3 py-3"
                  style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}
                >
                  <Icon size={18} style={{ color: 'var(--accent)' }} />
                  <dt className="mt-1.5 text-[0.8rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                    {meta.label}
                  </dt>
                  <dd className="text-[0.74rem] leading-snug" style={{ color: 'var(--text-muted)' }}>
                    {meta.blurb}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <p className="relative mt-8 text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>
          Academic Year 2026–2027 · Grades 1–6
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-strong)' }}>Sign in</h2>
          <p className="mt-1 text-[0.83rem]" style={{ color: 'var(--text-muted)' }}>
            Use your maktab email address with your password, or your teaching PIN.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email address" required>
              <Input
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck="false"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@icfbayarea.com"
                required
              />
            </Field>

            <Field label="Password or PIN" required>
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>

            {error && <Alert tone="risk">{error}</Alert>}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              busy={busy}
              icon={busy ? null : <KeyRound size={16} />}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {/* Demo sign-in shortcuts. Disabled by setting DEMO_MODE=false. */}
          {demo === null && (
            <div className="mt-8 flex justify-center"><Spinner /></div>
          )}

          {demo?.enabled && (
            <div className="mt-8">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
                <span
                  className="text-[0.68rem] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Demonstration accounts
                </span>
                <span className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
              </div>

              <p className="mt-3 text-[0.76rem]" style={{ color: 'var(--text-muted)' }}>
                Tap any account below to sign straight in and see that portal.
                All demo accounts share the password{' '}
                <code
                  className="rounded px-1 py-0.5 font-semibold"
                  style={{ background: 'var(--surface-sunken)', color: 'var(--text-strong)' }}
                >
                  {demo.password}
                </code>
                .
              </p>

              <div className="mt-3 space-y-3">
                {['admin', 'teacher', 'parent'].map((role) => {
                  const accounts = grouped[role] || [];
                  if (!accounts.length) return null;
                  const Icon = ROLE_META[role].icon;
                  return (
                    <div key={role}>
                      <p
                        className="mb-1.5 flex items-center gap-1.5 text-[0.72rem] font-semibold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Icon size={13} />
                        {ROLE_META[role].label}
                      </p>
                      <div className="space-y-1.5">
                        {accounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            data-email={account.email}
                            data-role={account.role}
                            onClick={() => signInWithDemoAccount(account)}
                            disabled={busy}
                            className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:brightness-[0.98] disabled:opacity-60"
                            style={{
                              background: 'var(--surface-card)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <span className="min-w-0 flex-1">
                              <span
                                className="block truncate text-[0.8rem] font-semibold"
                                style={{ color: 'var(--text-strong)' }}
                              >
                                {account.full_name}
                              </span>
                              <span
                                className="block truncate text-[0.7rem]"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {account.title || account.hint}
                              </span>
                            </span>
                            <ArrowRight
                              size={15}
                              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                              style={{ color: 'var(--accent)' }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
