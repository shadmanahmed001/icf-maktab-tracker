/**
 * The light / dark switch.
 *
 * Deliberately a labelled two-position switch rather than a bare icon. An
 * unlabelled sun or moon is a small guessing game — does it show the current
 * state or the one I would get if I pressed it? — and the people using this are
 * teachers on a phone between classes. The label says what pressing it does.
 *
 * On narrow screens the word drops away and the icon carries it, but the
 * accessible name stays the full sentence either way.
 */
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { cx } from '../ui';

export function ThemeToggle({ className, compact = false }) {
  const { isDark, toggle } = useTheme();

  // Name the destination, not the current state: pressing it is the whole
  // point, and "Switch to light mode" cannot be misread the way a moon can.
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      // Exposes the state to assistive tech and to the tests, which assert on
      // this rather than on colours.
      aria-pressed={isDark}
      data-theme-toggle={isDark ? 'dark' : 'light'}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg transition-colors',
        'hover:bg-black/5 dark:hover:bg-white/10',
        compact ? 'h-9 w-9 justify-center' : 'h-9 px-2.5',
        className
      )}
      style={{ color: 'var(--text-muted)' }}
    >
      <Icon size={17} strokeWidth={2} />
      {!compact && (
        <span className="hidden text-[0.76rem] font-semibold sm:inline">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
}
