/**
 * The pacing radar: every class, every strand, in one grid.
 *
 * Two views because they answer different questions — "who is behind?" (the
 * class list) and "which strand slipped this week?" (the weekly matrix).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus, Clock, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import {
  AsyncSection, Badge, Card, PageHeader, SectionHeading, SegmentedControl,
  Table, TableWrap, Td, Th, Tr, Tabs, EmptyState,
} from '../../ui';
import { PacingBar, StatTile } from '../../charts';
import { PACING, mediumDate, percent } from '../../lib/format';

/** One cell of the weekly matrix. */
function DayCell({ day }) {
  const config = {
    completed: { icon: Check, tone: 'ok', label: 'Logged' },
    partial: { icon: Clock, tone: 'warn', label: 'Partly covered' },
    not_taught: { icon: X, tone: 'risk', label: 'Not taught' },
    pending: { icon: Minus, tone: 'neutral', label: 'No record' },
  }[day.state] || { icon: Minus, tone: 'neutral', label: 'No record' };
  const Icon = config.icon;

  const isFuture = day.date > new Date().toISOString().slice(0, 10);
  const tone = isFuture && day.state === 'pending' ? 'neutral' : config.tone;

  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-md"
      style={{
        background: `color-mix(in srgb, var(--${tone === 'neutral' ? 'neutral' : tone}-soft) 100%, transparent)`,
        color: `var(--${tone}-ink)`,
        opacity: isFuture ? 0.45 : 1,
      }}
      title={`${day.dayName} ${mediumDate(day.date)} — ${day.expectedSubject || 'no strand'}: ${
        isFuture ? 'upcoming' : config.label}${day.log ? ` (${day.log.teacher_name})` : ''}`}
    >
      <Icon size={14} strokeWidth={2.6} />
    </span>
  );
}

export default function AdminPacing() {
  const [view, setView] = useState('classes');
  const [termNumber, setTermNumber] = useState(null);

  const dashboard = useApi(() => api.admin.dashboard(), []);
  const digest = useApi(
    () => api.admin.boardDigest(termNumber === null ? {} : { term_number: termNumber }),
    [termNumber]
  );

  const terms = dashboard.data?.terms || [];

  return (
    <>
      <PageHeader
        eyebrow="Standards oversight"
        title="Pacing radar"
        description="Coverage against the term plan, and whether the daily record is actually being kept."
        actions={(
          <SegmentedControl
            ariaLabel="Choose a view"
            value={view}
            onChange={setView}
            options={[
              { value: 'classes', label: 'By class' },
              { value: 'week', label: 'This week' },
              { value: 'strands', label: 'By strand' },
            ]}
          />
        )}
      />

      {terms.length > 0 && (
        <div className="mb-4">
          <Tabs
            value={termNumber ?? dashboard.data?.term?.term_number ?? 1}
            onChange={(value) => setTermNumber(value)}
            tabs={terms.map((t) => ({ value: t.term_number, label: t.title }))}
          />
        </div>
      )}

      <AsyncSection query={digest} rows={6}>
        {(data) => {
          const rows = data.rows;
          return (
            <>
              <div className="mb-5 grid grid-cols-3 gap-3">
                <StatTile label="On track" value={data.totals.onTrack} tone="ok" emphasis />
                <StatTile label="Needs attention" value={data.totals.watch} tone="warn" emphasis={data.totals.watch > 0} />
                <StatTile label="Behind pace" value={data.totals.behind} tone="risk" emphasis={data.totals.behind > 0} />
              </div>

              {view === 'classes' && <ClassView rows={rows} />}
              {view === 'week' && <WeekView rows={rows} weekOf={data.weekOf} />}
              {view === 'strands' && <StrandView rows={rows} />}

              <Card className="mt-5">
                <SectionHeading title="Reading this screen" />
                <dl className="grid gap-3 text-[0.82rem] sm:grid-cols-3">
                  <div>
                    <dt className="font-semibold" style={{ color: 'var(--text-strong)' }}>Progress</dt>
                    <dd style={{ color: 'var(--text-muted)' }}>
                      Standards achieved in full, with half credit for a standard currently being
                      taught. Each of the five strands is taught across the whole term, so a class
                      can be on pace with none finished yet.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold" style={{ color: 'var(--text-strong)' }}>Expected</dt>
                    <dd style={{ color: 'var(--text-muted)' }}>
                      How much of the term has elapsed. The gap between progress and expected is
                      what the status reflects, with tolerance so one missed week is not a flag.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold" style={{ color: 'var(--text-strong)' }}>Check-offs</dt>
                    <dd style={{ color: 'var(--text-muted)' }}>
                      Daily records kept against teaching days that have passed. A class teaching
                      well but not checking off is flagged on this alone — the office cannot see
                      what was never recorded.
                    </dd>
                  </div>
                </dl>
              </Card>
            </>
          );
        }}
      </AsyncSection>
    </>
  );
}

function ClassView({ rows }) {
  return (
    <Card padded={false}>
      <TableWrap className="rounded-xl border-0">
        <Table>
          <thead>
            <tr>
              <Th>Class</Th>
              <Th>Teacher</Th>
              <Th align="center">Pupils</Th>
              <Th align="center">Status</Th>
              <Th>Progress vs expected</Th>
              <Th align="center">Standards</Th>
              <Th align="center">Attendance</Th>
              <Th align="right">Last logged</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.classId}>
                <Td>
                  <Link
                    to={`/admin/classes/${row.classId}`}
                    className="font-semibold hover:underline"
                    style={{ color: 'var(--text-strong)' }}
                  >
                    {row.className}
                  </Link>
                  <p className="text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>{row.room}</p>
                </Td>
                <Td className="max-w-40 truncate text-[0.78rem]">{row.teachers || '—'}</Td>
                <Td align="center" className="num">{row.students}</Td>
                <Td align="center">
                  <Badge tone={PACING[row.pacingStatus].tone} size="sm">
                    {PACING[row.pacingStatus].label}
                  </Badge>
                </Td>
                <Td className="min-w-48">
                  <PacingBar value={row.progressPercent} expected={row.expectedPercent} />
                  <p className="num mt-1 text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                    {row.progressPercent}% progress · {row.expectedPercent}% of term elapsed
                  </p>
                </Td>
                <Td align="center" className="num">
                  {row.covered}/{row.required}
                  {row.inProgress > 0 && (
                    <span className="block text-[0.68rem]" style={{ color: 'var(--text-muted)' }}>
                      +{row.inProgress} under way
                    </span>
                  )}
                </Td>
                <Td align="center" className="num">{percent(row.attendance.rate)}</Td>
                <Td align="right" className="text-[0.76rem]">
                  {row.lastLoggedDate ? mediumDate(row.lastLoggedDate) : '—'}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </Card>
  );
}

function WeekView({ rows, weekOf }) {
  const days = rows[0]?.week || [];
  return (
    <Card>
      <SectionHeading
        title="Five-strand weekly matrix"
        description={`Week beginning ${mediumDate(weekOf)}. One strand per weekday — a gap means no check-off was recorded.`}
      />
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Class</Th>
              {days.map((day) => (
                <Th key={day.date} align="center">
                  <span className="block">{day.dayName.slice(0, 3)}</span>
                  <span className="block font-normal normal-case" style={{ opacity: 0.75 }}>
                    {day.expectedSubject}
                  </span>
                </Th>
              ))}
              <Th align="center">Logged</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const logged = row.week.filter((d) => d.log).length;
              return (
                <Tr key={row.classId}>
                  <Td>
                    <Link
                      to={`/admin/classes/${row.classId}`}
                      className="font-semibold hover:underline"
                      style={{ color: 'var(--text-strong)' }}
                    >
                      {row.className}
                    </Link>
                  </Td>
                  {row.week.map((day) => (
                    <Td key={day.date} align="center"><DayCell day={day} /></Td>
                  ))}
                  <Td align="center">
                    <Badge tone={logged === row.week.length ? 'ok' : logged === 0 ? 'risk' : 'warn'} size="sm">
                      {logged}/{row.week.length}
                    </Badge>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.74rem]" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5"><Check size={13} style={{ color: 'var(--ok-ink)' }} /> Logged</span>
        <span className="flex items-center gap-1.5"><Clock size={13} style={{ color: 'var(--warn-ink)' }} /> Partly covered</span>
        <span className="flex items-center gap-1.5"><X size={13} style={{ color: 'var(--risk-ink)' }} /> Not taught</span>
        <span className="flex items-center gap-1.5"><Minus size={13} /> No record</span>
      </div>
    </Card>
  );
}

/** Coverage of each of the five strands, across all classes. */
function StrandView({ rows }) {
  const byStrand = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      for (const day of row.week) {
        if (!day.expectedSubject) continue;
        const entry = map.get(day.expectedSubject) || { subject: day.expectedSubject, logged: 0, expected: 0 };
        entry.expected += 1;
        if (day.log) entry.logged += 1;
        map.set(day.expectedSubject, entry);
      }
    }
    return [...map.values()];
  }, [rows]);

  if (!byStrand.length) {
    return <EmptyState title="No strand data for this week" description="The weekly matrix fills in as lessons are logged." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {byStrand.map((strand) => {
        const share = strand.expected ? Math.round((strand.logged / strand.expected) * 100) : 0;
        return (
          <Card key={strand.subject}>
            <p className="term text-[0.92rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
              {strand.subject}
            </p>
            <p className="mb-3 text-[0.76rem]" style={{ color: 'var(--text-muted)' }}>
              {strand.logged} of {strand.expected} class sessions logged this week
            </p>
            <PacingBar value={share} expected={null} tone={share >= 90 ? 'ok' : share >= 70 ? 'warn' : 'risk'} />
            <p className="num mt-2 text-2xl font-semibold" style={{ color: 'var(--text-strong)' }}>{share}%</p>
          </Card>
        );
      })}
    </div>
  );
}
