/**
 * Shared UI kit.
 *
 * Everything here reads from the CSS tokens in index.css, so components inherit
 * the active portal accent and the reader's light/dark preference without being
 * told which portal or scheme they are in.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../lib/hooks';

const cx = (...parts) => parts.filter(Boolean).join(' ');

// ── Tones ───────────────────────────────────────────────────────────────────

/*
 * Each tone carries three values because they do different jobs:
 *   ink  — label text, contrast-checked against `soft`
 *   mark — chart fills and dots, contrast-checked against the card surface
 *   soft — the tinted background behind a badge
 * Using `ink` for a chart fill or `mark` for small text is what breaks
 * legibility in one of the two colour schemes, so the split is deliberate.
 */
const TONE_VARS = {
  ok: { ink: 'var(--ok-ink)', mark: 'var(--ok)', bg: 'var(--ok-soft)' },
  warn: { ink: 'var(--warn-ink)', mark: 'var(--warn)', bg: 'var(--warn-soft)' },
  risk: { ink: 'var(--risk-ink)', mark: 'var(--risk)', bg: 'var(--risk-soft)' },
  info: { ink: 'var(--info-ink)', mark: 'var(--info)', bg: 'var(--info-soft)' },
  neutral: { ink: 'var(--neutral-ink)', mark: 'var(--neutral)', bg: 'var(--neutral-soft)' },
  accent: { ink: 'var(--accent-text)', mark: 'var(--accent)', bg: 'var(--accent-soft)' },
};

const tone_ = (tone) => TONE_VARS[tone] || TONE_VARS.neutral;

/** Label text colour for a tone. */
export const toneColor = (tone) => tone_(tone).ink;
/** Chart mark / fill colour for a tone. */
export const toneMark = (tone) => tone_(tone).mark;
export const toneBackground = (tone) => tone_(tone).bg;

// ── Surfaces ────────────────────────────────────────────────────────────────

export function Card({ as: Tag = 'div', className, padded = true, children, ...rest }) {
  return (
    <Tag
      className={cx('rounded-xl', padded && 'p-4 sm:p-5', className)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({ title, description, action, level = 2 }) {
  const Tag = `h${level}`;
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Tag className="text-[0.95rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
          {title}
        </Tag>
        {description && (
          <p className="mt-0.5 text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p
              className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.09em]"
              style={{ color: 'var(--accent-text)' }}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className="text-xl font-semibold tracking-[-0.01em] sm:text-2xl"
            style={{ color: 'var(--text-strong)' }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-[0.85rem]" style={{ color: 'var(--text-muted)' }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-[0.78rem] gap-1.5',
  md: 'h-10 px-4 text-[0.85rem] gap-2',
  lg: 'h-12 px-5 text-[0.92rem] gap-2',
};

export function Button({
  variant = 'secondary', size = 'md', as: Tag = 'button', className,
  busy = false, disabled, icon, children, ...rest
}) {
  const base = cx(
    'inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap',
    'transition-[background-color,border-color,color,opacity,transform] duration-150',
    'disabled:cursor-not-allowed disabled:opacity-55 active:translate-y-px select-none',
    BUTTON_SIZES[size], className
  );

  const styles = {
    primary: { background: 'var(--accent)', color: '#fff', border: '1px solid transparent' },
    secondary: {
      background: 'var(--surface-card)', color: 'var(--text-body)',
      border: '1px solid var(--border-strong)',
    },
    soft: { background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid transparent' },
    ghost: { background: 'transparent', color: 'var(--text-body)', border: '1px solid transparent' },
    danger: { background: 'var(--risk)', color: '#fff', border: '1px solid transparent' },
  }[variant];

  return (
    <Tag
      className={base}
      style={styles}
      disabled={Tag === 'button' ? (disabled || busy) : undefined}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner size={14} tone={variant === 'primary' || variant === 'danger' ? 'light' : 'accent'} /> : icon}
      {children}
    </Tag>
  );
}

export function IconButton({ label, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
        'hover:bg-black/5 dark:hover:bg-white/10', className
      )}
      style={{ color: 'var(--text-muted)' }}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

export function Spinner({ size = 18, tone = 'accent', className }) {
  const color = tone === 'light' ? 'rgba(255,255,255,0.9)' : 'var(--accent)';
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx('inline-block animate-spin rounded-full align-middle', className)}
      style={{
        width: size, height: size,
        border: `${Math.max(2, Math.round(size / 9))}px solid color-mix(in srgb, ${color} 25%, transparent)`,
        borderTopColor: color,
      }}
    />
  );
}

export function Badge({ tone = 'neutral', size = 'md', icon, className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[0.66rem]' : 'px-2 py-0.5 text-[0.72rem]',
        className
      )}
      style={{ background: toneBackground(tone), color: toneColor(tone) }}
    >
      {icon}
      {children}
    </span>
  );
}

/** A small coloured dot — used where a badge would be too heavy. */
export function Dot({ tone = 'neutral', size = 8, className }) {
  return (
    <span
      className={cx('inline-block rounded-full shrink-0', className)}
      style={{ width: size, height: size, background: toneMark(tone) }}
    />
  );
}

export function Alert({ tone = 'info', title, children, action, className }) {
  return (
    <div
      role={tone === 'risk' ? 'alert' : 'status'}
      className={cx('rounded-xl px-4 py-3 text-[0.83rem]', className)}
      style={{
        background: toneBackground(tone),
        color: toneColor(tone),
        border: `1px solid color-mix(in srgb, ${toneColor(tone)} 25%, transparent)`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={title ? 'mt-0.5 opacity-90' : 'opacity-90'}>{children}</div>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action, icon, className }) {
  return (
    <div
      className={cx('flex flex-col items-center justify-center rounded-xl px-6 py-12 text-center', className)}
      style={{ border: '1px dashed var(--border-strong)', background: 'var(--surface-sunken)' }}
    >
      {icon && <div className="mb-3" style={{ color: 'var(--text-muted)' }}>{icon}</div>}
      <p className="text-[0.9rem] font-semibold" style={{ color: 'var(--text-strong)' }}>{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Placeholder block matching the shape of content still loading. */
export function Skeleton({ className, height = 16, radius = 6 }) {
  return (
    <div
      className={cx('animate-pulse', className)}
      style={{ height, borderRadius: radius, background: 'var(--surface-sunken)' }}
    />
  );
}

export function LoadingBlock({ rows = 3, className }) {
  return (
    <div className={cx('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={i === 0 ? 22 : 14} className={i === 0 ? 'w-1/3' : 'w-full'} />
      ))}
    </div>
  );
}

/** Consistent error presentation with a retry affordance. */
export function ErrorBlock({ error, onRetry, className }) {
  const message = error?.message || 'Something went wrong.';
  return (
    <Alert
      tone="risk"
      title="Could not load this section"
      className={className}
      action={onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}
    >
      {message}
    </Alert>
  );
}

/** Wraps a useApi result: shows a skeleton, an error, or the content. */
export function AsyncSection({ query, rows = 3, children, empty }) {
  if (query.loading && !query.data) return <LoadingBlock rows={rows} />;
  if (query.error && !query.data) return <ErrorBlock error={query.error} onRetry={query.reload} />;
  if (!query.data) return empty || null;
  return children(query.data);
}

// ── Form controls ───────────────────────────────────────────────────────────

const CONTROL_STYLE = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-strong)',
};

const controlClass = 'w-full rounded-lg px-3 py-2 text-[0.85rem] transition-colors placeholder:opacity-60 disabled:opacity-60';

export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1 flex items-baseline gap-1 text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>
          {label}
          {required && <span style={{ color: 'var(--risk)' }} aria-hidden="true">*</span>}
        </span>
      )}
      {children}
      {error
        ? <span className="mt-1 block text-[0.75rem]" style={{ color: 'var(--risk)' }}>{error}</span>
        : hint && <span className="mt-1 block text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>{hint}</span>}
    </label>
  );
}

export function Input({ className, invalid, ...rest }) {
  return (
    <input
      className={cx(controlClass, className)}
      style={{ ...CONTROL_STYLE, borderColor: invalid ? 'var(--risk)' : 'var(--border-strong)' }}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({ className, rows = 3, ...rest }) {
  return (
    <textarea
      rows={rows}
      className={cx(controlClass, 'resize-y leading-relaxed', className)}
      style={CONTROL_STYLE}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }) {
  return (
    <select
      className={cx(controlClass, 'appearance-none bg-no-repeat pr-9', className)}
      style={{
        ...CONTROL_STYLE,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2.5' stroke-linecap='round'><path d='m6 9 6 6 6-6'/></svg>\")",
        backgroundPosition: 'right 10px center',
        // Set alongside the image rather than relying on a utility class:
        // without it the chevron tiles across the whole control.
        backgroundRepeat: 'no-repeat',
        backgroundSize: '16px 16px',
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, description, className, ...rest }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-2.5', className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--accent)]"
        {...rest}
      />
      <span className="text-[0.83rem]">
        <span className="font-medium" style={{ color: 'var(--text-strong)' }}>{label}</span>
        {description && (
          <span className="block text-[0.76rem]" style={{ color: 'var(--text-muted)' }}>{description}</span>
        )}
      </span>
    </label>
  );
}

/** Search input with a magnifier and a clear affordance. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cx('relative', className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(controlClass, 'pl-9')}
        style={CONTROL_STYLE}
      />
    </div>
  );
}

/** Mutually exclusive options rendered as a pill group. */
export function SegmentedControl({ value, onChange, options, size = 'md', className, ariaLabel }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx('inline-flex rounded-lg p-0.5', className)}
      style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-md font-semibold transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-[0.74rem]' : 'px-3 py-1.5 text-[0.8rem]'
            )}
            style={active
              ? { background: 'var(--surface-card)', color: 'var(--accent-text)', boxShadow: 'var(--shadow-card)' }
              : { color: 'var(--text-muted)' }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

export function Tabs({ value, onChange, tabs, className }) {
  return (
    <div
      className={cx('flex gap-1 overflow-x-auto', className)}
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className="relative shrink-0 px-3 pb-2.5 pt-2 text-[0.83rem] font-semibold transition-colors"
            style={{ color: active ? 'var(--accent-text)' : 'var(--text-muted)' }}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && tab.count !== null && (
                <Badge size="sm" tone={active ? 'accent' : 'neutral'}>{tab.count}</Badge>
              )}
            </span>
            {active && (
              <span
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────

/** Horizontally scrollable wrapper so wide tables never widen the page. */
export function TableWrap({ className, children }) {
  return (
    <div
      className={cx('overflow-x-auto rounded-xl', className)}
      style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}
    >
      {children}
    </div>
  );
}

export function Table({ className, children }) {
  return <table className={cx('w-full border-collapse text-[0.83rem]', className)}>{children}</table>;
}

export function Th({ className, align = 'left', children, ...rest }) {
  return (
    <th
      scope="col"
      className={cx(
        'whitespace-nowrap px-3 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.05em]',
        align === 'right' && 'text-right', align === 'center' && 'text-center',
        align === 'left' && 'text-left', className
      )}
      style={{
        color: 'var(--text-muted)',
        background: 'var(--surface-sunken)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ className, align = 'left', children, ...rest }) {
  return (
    <td
      className={cx(
        'px-3 py-2.5 align-middle',
        align === 'right' && 'text-right', align === 'center' && 'text-center', className
      )}
      style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-body)' }}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Tr({ className, onClick, children, ...rest }) {
  return (
    <tr
      className={cx(onClick && 'cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]', className)}
      onClick={onClick}
      {...rest}
    >
      {children}
    </tr>
  );
}

// ── Dialog ──────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  useEscapeKey(onClose, open);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog so keyboard users are not left on the page behind.
    const timer = setTimeout(() => {
      panelRef.current?.querySelector('input,select,textarea,button')?.focus();
    }, 30);
    return () => {
      document.body.style.overflow = previous;
      clearTimeout(timer);
    };
  }, [open]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgb(16 24 40 / 0.55)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'animate-in relative flex max-h-[92vh] w-full flex-col overflow-hidden',
          'rounded-t-2xl sm:rounded-2xl', widths[size]
        )}
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-pop)' }}
      >
        <div
          className="flex items-start justify-between gap-4 px-5 pb-3 pt-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="min-w-0">
            <h2 className="text-[0.98rem] font-semibold" style={{ color: 'var(--text-strong)' }}>{title}</h2>
            {description && (
              <p className="mt-0.5 text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>{description}</p>
            )}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div
            className="flex flex-wrap justify-end gap-2 px-5 py-3"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Confirmation dialog for destructive or hard-to-reverse actions. */
export function ConfirmDialog({
  open, onClose, onConfirm, title, children,
  confirmLabel = 'Confirm', tone = 'danger', busy,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={tone} onClick={onConfirm} busy={busy}>{confirmLabel}</Button>
        </>
      )}
    >
      <p className="text-[0.85rem]" style={{ color: 'var(--text-body)' }}>{children}</p>
    </Modal>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────

let toastSeq = 0;
const toastListeners = new Set();

/** Fire a toast from anywhere, including outside React. */
export function toast(message, tone = 'ok') {
  const entry = { id: (toastSeq += 1), message, tone };
  toastListeners.forEach((listener) => listener(entry));
}

export function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const listener = (entry) => {
      setItems((current) => [...current, entry]);
      setTimeout(() => setItems((current) => current.filter((i) => i.id !== entry.id)), 4200);
    };
    toastListeners.add(listener);
    return () => toastListeners.delete(listener);
  }, []);

  if (!items.length) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 print:hidden"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="animate-in pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2 text-[0.83rem] font-medium"
          style={{
            background: 'var(--surface-inverse)',
            color: 'var(--text-inverse)',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <Dot tone={item.tone} />
          {item.message}
        </div>
      ))}
    </div>,
    document.body
  );
}

// ── Misc ────────────────────────────────────────────────────────────────────

export function Avatar({ name, size = 36, tone = 'accent', className }) {
  const label = (name || '')
    .replace(/^(Ustadh|Ustadha|Imam)\s+/i, '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase()).join('');
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', className)}
      style={{
        width: size, height: size,
        fontSize: Math.max(10, size * 0.36),
        background: toneBackground(tone),
        color: toneColor(tone),
      }}
      aria-hidden="true"
    >
      {label || '·'}
    </span>
  );
}

/** Label/value pair used throughout detail panels. */
export function DataRow({ label, children, className }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <dt className="shrink-0 text-[0.78rem]" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="min-w-0 text-right text-[0.83rem] font-medium" style={{ color: 'var(--text-strong)' }}>
        {children ?? '—'}
      </dd>
    </div>
  );
}

export function Divider({ className, label }) {
  if (label) {
    return (
      <div className={cx('flex items-center gap-3', className)}>
        <span className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
        <span className="text-[0.72rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <span className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
      </div>
    );
  }
  return <div className={cx('h-px', className)} style={{ background: 'var(--border-subtle)' }} />;
}

/** Collapsible section, used for long reference content. */
export function Disclosure({ summary, defaultOpen = false, children, className }) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 py-2 text-left text-[0.85rem] font-semibold"
        style={{ color: 'var(--text-strong)' }}
      >
        {summary}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s', color: 'var(--text-muted)' }}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div id={id} className="pb-2">{children}</div>}
    </div>
  );
}

export { cx };
