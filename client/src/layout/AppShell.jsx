/**
 * The shared portal shell.
 *
 * One layout serves all three portals; the nav items and the accent come from
 * the portal config. On desktop it is a fixed sidebar, on a phone a slide-over
 * drawer plus a bottom tab bar for the handful of screens a teacher or parent
 * actually needs mid-session.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Avatar, Badge, IconButton, cx } from '../ui';
import { ThemeToggle } from '../features/ThemeToggle';
import { longDate } from '../lib/format';

function MaktabMark({ size = 30 }) {
  // An eight-point star — a common motif in Islamic geometric patterns.
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg"
      style={{ width: size, height: size, background: 'var(--accent)' }}
      aria-hidden="true"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 1.6 14.9 7l6.1.9-4.4 4.3 1 6.1L12 15.4l-5.6 2.9 1-6.1L3 7.9 9.1 7 12 1.6Z"
          fill="rgba(255,255,255,0.95)"
        />
        <path d="M12 6.2 13.6 9.3l3.4.5-2.5 2.4.6 3.4L12 14l-3.1 1.6.6-3.4-2.5-2.4 3.4-.5L12 6.2Z" fill="var(--accent)" />
      </svg>
    </span>
  );
}

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => cx(
        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem] font-medium transition-colors',
        isActive ? 'font-semibold' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
      )}
      style={({ isActive }) => (isActive
        ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' }
        : { color: 'var(--text-body)' })}
    >
      {Icon && <Icon size={17} strokeWidth={2} className="shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? <Badge size="sm" tone="risk">{item.badge}</Badge> : null}
    </NavLink>
  );
}

function AccountMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    // A click anywhere else dismisses the menu.
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const roleLabel = { admin: 'Administrator', teacher: 'Teacher', parent: 'Parent' }[user.role];

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
      >
        <Avatar name={user.full_name} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.82rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
            {user.full_name}
          </span>
          <span className="block truncate text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>
            {user.title || roleLabel}
          </span>
        </span>
        <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-in absolute bottom-full left-0 z-30 mb-1 w-full min-w-52 overflow-hidden rounded-xl"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="truncate text-[0.78rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
              {user.email}
            </p>
            <p className="text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>{roleLabel}</p>
          </div>
          <Link
            to="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[0.82rem] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            style={{ color: 'var(--text-body)' }}
          >
            Account &amp; password
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[0.82rem] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            style={{ color: 'var(--risk-ink)' }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ portal, nav, bottomNav, title, subtitle, children }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Any navigation closes the mobile drawer.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const portalName = { admin: 'Administration', teacher: 'Teacher Portal', parent: 'Family Portal' }[portal];

  const sidebar = (
    <div className="flex h-full flex-col gap-1">
      <div className="mb-1 flex items-center gap-2.5 px-2.5 py-1">
        <MaktabMark />
        <div className="min-w-0">
          <p className="truncate text-[0.85rem] font-semibold leading-tight" style={{ color: 'var(--text-strong)' }}>
            ICF Daily Maktab
          </p>
          <p className="truncate text-[0.7rem]" style={{ color: 'var(--accent-text)' }}>{portalName}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto pt-2" aria-label={portalName}>
        {nav.map((section, index) => (
          <div key={section.title || index} className={index > 0 ? 'pt-3' : undefined}>
            {section.title && (
              <p
                className="px-2.5 pb-1 text-[0.66rem] font-semibold uppercase tracking-[0.09em]"
                style={{ color: 'var(--text-muted)' }}
              >
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <NavItem key={item.to} item={item} onNavigate={() => setDrawerOpen(false)} />
            ))}
          </div>
        ))}
      </nav>

      <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <AccountMenu user={user} onSignOut={signOut} />
      </div>
    </div>
  );

  return (
    <div data-portal={portal} className="min-h-screen">
      {/* Desktop sidebar */}
      <aside
        aria-label="Portal sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col p-3 lg:flex print:hidden"
        style={{ background: 'var(--surface-card)', borderRight: '1px solid var(--border-subtle)' }}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'rgb(16 24 40 / 0.5)' }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            aria-label="Portal menu"
            className="animate-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col p-3"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-pop)' }}
          >
            <div className="mb-1 flex justify-end">
              <IconButton label="Close menu" onClick={() => setDrawerOpen(false)}>
                <X size={18} />
              </IconButton>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Top bar */}
        <header
          className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 sm:px-6 print:hidden"
          style={{
            background: 'color-mix(in srgb, var(--surface-page) 88%, transparent)',
            borderBottom: '1px solid var(--border-subtle)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
            <Menu size={20} />
          </IconButton>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
              {title}
            </p>
            {subtitle && (
              <p className="truncate text-[0.74rem]" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
            )}
          </div>

          <p className="hidden text-[0.76rem] sm:block" style={{ color: 'var(--text-muted)' }}>
            {longDate(new Date().toISOString().slice(0, 10))}
          </p>

          <ThemeToggle />
        </header>

        <main className={cx('px-4 py-5 sm:px-6 sm:py-6', bottomNav?.length && 'pb-24 lg:pb-6')}>
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Mobile bottom tabs — the screens used mid-session */}
      {bottomNav?.length ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex lg:hidden print:hidden"
          style={{
            background: 'var(--surface-card)',
            borderTop: '1px solid var(--border-subtle)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          aria-label="Quick navigation"
        >
          {bottomNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.66rem] font-semibold"
                style={({ isActive }) => ({ color: isActive ? 'var(--accent-text)' : 'var(--text-muted)' })}
              >
                <Icon size={20} strokeWidth={2} />
                {item.label}
                {item.badge ? (
                  <span
                    className="absolute right-1/2 top-1.5 translate-x-4 rounded-full px-1 text-[0.58rem] font-bold"
                    style={{ background: 'var(--risk)', color: '#fff' }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

export { MaktabMark };
