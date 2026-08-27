/** Syllabus coverage for the term, plus the log history behind it. */
import { Check, Clock, Minus } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedClass } from '../../layout/portals';
import {
  AsyncSection, Badge, Card, DataRow, EmptyState, PageHeader, SectionHeading,
  Table, TableWrap, Td, Th, Tr,
} from '../../ui';
import { ProgressRing, StatTile } from '../../charts';
import {
  COVERAGE_STATE, LESSON_STATUS, MASTERY, PACING, mediumDate, SESSION_TYPES,
} from '../../lib/format';

const STATE_ICON = { achieved: Check, in_progress: Clock, pending: Minus };

export default function TeacherCoverage() {
  const { selectedId, selected } = useSelectedClass();
  const progress = useApi(() => api.teacher.progress(selectedId), [selectedId], { skip: !selectedId });
  const logs = useApi(() => api.teacher.logs(selectedId, { limit: 60 }), [selectedId], { skip: !selectedId });

  return (
    <>
      <PageHeader
        eyebrow={selected?.name}
        title="Syllabus coverage"
        description="Where each strand stands this term, and every check-off behind it."
      />

      <AsyncSection query={progress} rows={6}>
        {(data) => (
          <>
            <div className="mb-5 grid gap-4 lg:grid-cols-[auto_1fr]">
              <Card className="flex items-center justify-center">
                <ProgressRing
                  value={data.progressPercent}
                  label="Term progress"
                  sublabel={`${data.expectedPercent}% expected by today`}
                  tone={PACING[data.pacingStatus].tone}
                  size={112}
                />
              </Card>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Achieved" value={data.achievedCount} sublabel={`of ${data.requiredCount} standards`} tone="ok" />
                <StatTile label="Being taught" value={data.inProgressCount} sublabel="counts as half credit" tone="warn" />
                <StatTile label="Not started" value={data.pendingCount} sublabel="still to introduce" />
                <StatTile
                  label="Check-offs"
                  value={`${data.loggedSessions}/${data.expectedSessions}`}
                  sublabel={`${data.loggingPercent}% of sessions`}
                  tone={data.loggingPercent < 80 ? 'warn' : 'ok'}
                />
              </div>
            </div>

            {data.loggingPercent < 80 && (
              <Card className="mb-5" style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn)' }}>
                <p className="text-[0.85rem] font-semibold" style={{ color: 'var(--warn-ink)' }}>
                  {data.expectedSessions - data.loggedSessions} sessions have no check-off recorded
                </p>
                <p className="mt-1 text-[0.82rem]" style={{ color: 'var(--warn-ink)' }}>
                  The office reads pacing from these records, so gaps make the class look behind even when
                  it is not. You can backfill any past date from the check-off screen.
                </p>
              </Card>
            )}

            <Card className="mb-5">
              <SectionHeading title="The five strands" description="Each term's standard, and how far you have got." />
              <ul className="space-y-3">
                {data.coverage.map((topic) => {
                  const Icon = STATE_ICON[topic.state] || Minus;
                  const tone = COVERAGE_STATE[topic.state].tone;
                  return (
                    <li
                      key={topic.id}
                      className="flex gap-3 rounded-xl px-3.5 py-3"
                      style={{ background: 'var(--surface-sunken)' }}
                    >
                      <span
                        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ background: `var(--${tone === 'neutral' ? 'neutral' : tone}-soft)`, color: `var(--${tone}-ink)` }}
                      >
                        <Icon size={14} strokeWidth={2.6} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-2">
                          <span className="term text-[0.88rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                            {topic.subject}
                          </span>
                          <Badge tone={tone} size="sm">{COVERAGE_STATE[topic.state].label}</Badge>
                          <span className="num text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>
                            {topic.sessionCount} session{topic.sessionCount === 1 ? '' : 's'} · {topic.day_of_week}s
                          </span>
                        </p>
                        <p className="term mt-0.5 text-[0.84rem]" style={{ color: 'var(--text-body)' }}>
                          {topic.topic_title}
                        </p>
                        <p className="term mt-1 text-[0.78rem] italic" style={{ color: 'var(--text-muted)' }}>
                          Expected: {topic.expected_indicator}
                        </p>
                        {topic.log && (
                          <p className="mt-1 text-[0.74rem]" style={{ color: 'var(--text-muted)' }}>
                            Last recorded {mediumDate(topic.log.date)} — class judged{' '}
                            {MASTERY[topic.log.class_mastery]?.label.toLowerCase()}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {data.memorizationStandard && (
                <div className="mt-4 rounded-xl px-3.5 py-3" style={{ background: 'var(--accent-soft)' }}>
                  <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--accent-text)' }}>
                    Memorization target this term
                  </p>
                  <dl className="term" style={{ color: 'var(--accent-text)' }}>
                    <DataRow label="Sūrah">{data.memorizationStandard.surah}</DataRow>
                    <DataRow label="Duʿā'">{data.memorizationStandard.dua}</DataRow>
                    <DataRow label="Names of Allāh">{data.memorizationStandard.names_of_allah}</DataRow>
                  </dl>
                </div>
              )}
            </Card>

            <Card>
              <SectionHeading title="This week" />
              <div className="grid gap-2 sm:grid-cols-5">
                {data.week.map((day) => {
                  const config = {
                    completed: { tone: 'ok', label: 'Logged' },
                    partial: { tone: 'warn', label: 'Partial' },
                    not_taught: { tone: 'risk', label: 'Not taught' },
                    pending: { tone: 'neutral', label: 'No record' },
                  }[day.state];
                  return (
                    <div
                      key={day.date}
                      className="rounded-lg px-3 py-2.5"
                      style={{ background: 'var(--surface-sunken)' }}
                    >
                      <p className="text-[0.75rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                        {day.dayName.slice(0, 3)} {mediumDate(day.date).split(' ').slice(1).join(' ')}
                      </p>
                      <p className="term text-[0.78rem]" style={{ color: 'var(--text-body)' }}>{day.expectedSubject}</p>
                      <Badge tone={config.tone} size="sm" className="mt-1.5">{config.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </AsyncSection>

      <AsyncSection query={logs} rows={4}>
        {(rows) => (
          <Card className="mt-5">
            <SectionHeading title="Check-off history" description="Everything recorded for this class." />
            {rows.length === 0 ? (
              <EmptyState title="No lessons logged yet" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Strand</Th>
                      <Th>Topic</Th>
                      <Th>Session</Th>
                      <Th align="center">Status</Th>
                      <Th align="center">Class</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((log) => (
                      <Tr key={log.id}>
                        <Td className="whitespace-nowrap text-[0.76rem]">{mediumDate(log.date)}</Td>
                        <Td className="term whitespace-nowrap">{log.subject}</Td>
                        <Td className="term max-w-64"><span className="line-clamp-2">{log.topic_covered}</span></Td>
                        <Td className="whitespace-nowrap text-[0.76rem]">{SESSION_TYPES[log.session_type]}</Td>
                        <Td align="center">
                          <Badge tone={LESSON_STATUS[log.status]?.tone} size="sm">{LESSON_STATUS[log.status]?.label}</Badge>
                        </Td>
                        <Td align="center">
                          <Badge tone={MASTERY[log.class_mastery]?.tone} size="sm">{MASTERY[log.class_mastery]?.label}</Badge>
                        </Td>
                        <Td className="max-w-64 text-[0.77rem]"><span className="line-clamp-2">{log.notes || '—'}</span></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        )}
      </AsyncSection>
    </>
  );
}
