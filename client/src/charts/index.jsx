/**
 * Chart components.
 *
 * Deliberately small and hand-rolled: every figure in this app is one of four
 * shapes, and hand-rolling them keeps the bundle free of a charting library
 * while letting each mark follow the house spec — thin marks, 4px rounded data
 * ends anchored to the baseline, a 2px surface gap between adjacent fills, and
 * recessive axes.
 *
 * Colour comes from the validated status tokens via `toneMark`. Every figure
 * carries a text label or legend, so identity is never colour alone.
 */
import { useId, useState } from 'react';
import { toneMark, toneBackground, cx } from '../ui';

const SURFACE_GAP = 2;

// ── Progress bar with an expected-pace marker ───────────────────────────────

/**
 * The core pacing figure: actual coverage as a filled bar, with a tick showing
 * where the class should be by today. The gap between them is the whole point,
 * so the tick is drawn on top of the fill rather than beside it.
 */
export function PacingBar({
  value, expected, tone = 'accent', height = 8, showExpected = true, label, className,
}) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const expectedClamped = expected === null || expected === undefined
    ? null : Math.max(0, Math.min(100, expected));

  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.74rem]">
          <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          <span className="num font-semibold" style={{ color: 'var(--text-strong)' }}>{clamped}%</span>
        </div>
      )}
      <div
        className="relative w-full overflow-hidden"
        style={{ height, borderRadius: height / 2, background: 'var(--surface-sunken)' }}
        role="img"
        aria-label={`${label ? `${label}: ` : ''}${clamped}% complete${
          expectedClamped !== null ? `, ${expectedClamped}% expected by today` : ''}`}
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-500"
          style={{
            width: `${clamped}%`,
            background: toneMark(tone),
            borderRadius: height / 2,
          }}
        />
        {showExpected && expectedClamped !== null && expectedClamped > 1 && (
          // A 2px surface-coloured gap keeps the tick legible against the fill.
          <div
            className="absolute inset-y-0"
            style={{
              left: `calc(${expectedClamped}% - 1px)`,
              width: 2,
              background: 'var(--text-strong)',
              opacity: 0.75,
              boxShadow: '0 0 0 2px var(--surface-card)',
            }}
            title={`Expected by today: ${expectedClamped}%`}
          />
        )}
      </div>
    </div>
  );
}

// ── Progress ring ───────────────────────────────────────────────────────────

/** A single headline percentage. Used where one number is the whole message. */
export function ProgressRing({
  value, size = 88, thickness = 8, tone = 'accent', label, sublabel, className,
}) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div className={cx('inline-flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="var(--surface-sunken)" strokeWidth={thickness}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={toneMark(tone)} strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="num font-semibold leading-none"
            style={{ fontSize: size * 0.26, color: 'var(--text-strong)' }}
          >
            {clamped}
            <span style={{ fontSize: size * 0.14, opacity: 0.65 }}>%</span>
          </span>
        </div>
      </div>
      {label && (
        <p className="mt-2 text-center text-[0.78rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
          {label}
        </p>
      )}
      {sublabel && (
        <p className="text-center text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>
      )}
    </div>
  );
}

// ── Stacked composition bar ─────────────────────────────────────────────────

/**
 * Composition of a whole — attendance across a term, mastery across a class.
 * Segments are separated by a 2px surface gap so adjacent fills never touch,
 * and the legend states each value in text.
 */
export function CompositionBar({
  segments, height = 10, className, showLegend = true, total: totalOverride,
}) {
  const [hovered, setHovered] = useState(null);
  const total = totalOverride ?? segments.reduce((sum, s) => sum + (s.value || 0), 0);

  if (!total) {
    return (
      <div className={className}>
        <div
          style={{ height, borderRadius: height / 2, background: 'var(--surface-sunken)' }}
          role="img"
          aria-label="No data recorded yet"
        />
        {showLegend && (
          <p className="mt-2 text-[0.74rem]" style={{ color: 'var(--text-muted)' }}>
            Nothing recorded yet
          </p>
        )}
      </div>
    );
  }

  const visible = segments.filter((s) => (s.value || 0) > 0);

  return (
    <div className={className}>
      <div
        className="flex w-full overflow-hidden"
        style={{ height, borderRadius: height / 2, background: 'var(--surface-sunken)', gap: SURFACE_GAP }}
        role="img"
        aria-label={visible.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {visible.map((segment) => (
          <div
            key={segment.label}
            onMouseEnter={() => setHovered(segment.label)}
            onMouseLeave={() => setHovered(null)}
            title={`${segment.label}: ${segment.value} (${Math.round((segment.value / total) * 100)}%)`}
            style={{
              flexGrow: segment.value,
              flexBasis: 0,
              background: toneMark(segment.tone),
              opacity: hovered && hovered !== segment.label ? 0.55 : 1,
              transition: 'opacity 0.15s',
            }}
          />
        ))}
      </div>

      {showLegend && (
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-1.5 text-[0.74rem]">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: toneMark(segment.tone) }}
                aria-hidden="true"
              />
              <span style={{ color: 'var(--text-muted)' }}>{segment.label}</span>
              <span className="num font-semibold" style={{ color: 'var(--text-strong)' }}>{segment.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Column chart ────────────────────────────────────────────────────────────

/**
 * Daily counts over a short window — attendance per session, lessons per week.
 * Bars are anchored to the baseline with rounded tops only, and hovering any
 * column reveals its exact figures.
 */
export function ColumnChart({
  data, height = 120, tone = 'accent', valueKey = 'value', labelKey = 'label',
  className, formatTooltip,
}) {
  const [active, setActive] = useState(null);
  const titleId = useId();
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));

  if (!data.length) {
    return (
      <p className="py-8 text-center text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>
        No sessions recorded in this range yet.
      </p>
    );
  }

  return (
    <div className={cx('relative', className)}>
      <div className="flex items-end gap-1" style={{ height }} role="img" aria-labelledby={titleId}>
        {data.map((entry, index) => {
          const value = entry[valueKey] || 0;
          const barHeight = Math.max(value > 0 ? 3 : 1, (value / max) * (height - 18));
          const isActive = active === index;
          return (
            <div
              key={entry[labelKey] ?? index}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              tabIndex={0}
            >
              <div
                className="w-full transition-opacity"
                style={{
                  height: barHeight,
                  maxWidth: 26,
                  background: value > 0 ? toneMark(tone) : 'var(--border-subtle)',
                  borderRadius: '4px 4px 0 0',
                  opacity: active !== null && !isActive ? 0.5 : 1,
                }}
              />
              <span
                className="num w-full truncate text-center text-[0.62rem]"
                style={{ color: isActive ? 'var(--text-strong)' : 'var(--text-muted)' }}
              >
                {entry.shortLabel ?? entry[labelKey]}
              </span>
            </div>
          );
        })}
      </div>

      <p id={titleId} className="sr-only">
        {data.map((d) => `${d[labelKey]}: ${d[valueKey]}`).join(', ')}
      </p>

      {active !== null && (
        <div
          className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.74rem]"
          style={{
            background: 'var(--surface-inverse)',
            color: 'var(--text-inverse)',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          {formatTooltip
            ? formatTooltip(data[active])
            : `${data[active][labelKey]}: ${data[active][valueKey]}`}
        </div>
      )}
    </div>
  );
}

// ── Sparkline ───────────────────────────────────────────────────────────────

/** A compact trend, for inline use in a table row or stat tile. */
export function Sparkline({ values, width = 96, height = 26, tone = 'accent', className }) {
  if (!values || values.length < 2) {
    return <span className={cx('inline-block', className)} style={{ width, height }} />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - 2 - ((value - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      width={width} height={height} className={className}
      role="img" aria-label={`Trend: ${values.join(', ')}`}
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={toneMark(tone)}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(values.length - 1) * step}
        cy={height - 2 - ((values[values.length - 1] - min) / span) * (height - 4)}
        r="2.5"
        fill={toneMark(tone)}
        stroke="var(--surface-card)"
        strokeWidth="2"
      />
    </svg>
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────────

/**
 * A single figure with its label. Per the form heuristic this is the right
 * answer when the data is one number — no plot is added just to fill space.
 */
export function StatTile({
  label, value, sublabel, tone = 'neutral', icon, trend, onClick, className, emphasis = false,
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'flex flex-col items-start gap-1 rounded-xl p-3.5 text-left sm:p-4',
        onClick && 'transition-colors hover:brightness-[0.98]',
        className
      )}
      style={{
        background: emphasis ? toneBackground(tone) : 'var(--surface-card)',
        border: `1px solid ${emphasis ? 'transparent' : 'var(--border-subtle)'}`,
        boxShadow: emphasis ? 'none' : 'var(--shadow-card)',
      }}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span
          className="text-[0.72rem] font-semibold uppercase tracking-[0.05em]"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </span>
        {icon && <span style={{ color: toneMark(tone) }}>{icon}</span>}
      </div>
      <span
        className="num text-2xl font-semibold leading-tight"
        style={{ color: emphasis ? toneMark(tone) : 'var(--text-strong)' }}
      >
        {value}
      </span>
      {(sublabel || trend) && (
        <span className="flex items-center gap-1.5 text-[0.74rem]" style={{ color: 'var(--text-muted)' }}>
          {trend}
          {sublabel}
        </span>
      )}
    </Tag>
  );
}

// ── Distribution across ordered bands ───────────────────────────────────────

/**
 * Mastery across a class. The bands are ordered, so they read left to right in
 * curriculum order with the count stated on each — the ordering carries the
 * meaning, and colour only reinforces it.
 */
export function BandDistribution({ bands, className, height = 34 }) {
  const total = bands.reduce((sum, b) => sum + b.value, 0);
  return (
    <div className={className}>
      <div className="flex gap-1.5">
        {bands.map((band) => {
          const share = total ? (band.value / total) * 100 : 0;
          return (
            <div key={band.label} className="min-w-0 flex-1">
              <div
                className="flex items-end justify-center rounded-md px-1"
                style={{
                  height,
                  background: toneBackground(band.tone),
                  borderBottom: `3px solid ${toneMark(band.tone)}`,
                }}
                title={`${band.label}: ${band.value}${total ? ` (${Math.round(share)}%)` : ''}`}
              >
                <span
                  className="num pb-1 text-[0.85rem] font-semibold"
                  style={{ color: 'var(--text-strong)' }}
                >
                  {band.value}
                </span>
              </div>
              <p
                className="mt-1 truncate text-center text-[0.66rem] font-medium"
                style={{ color: 'var(--text-muted)' }}
                title={band.label}
              >
                {band.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
