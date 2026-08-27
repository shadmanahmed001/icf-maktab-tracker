/** One class in depth: pacing, the week, the syllabus and the roll. */
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock, Minus } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import {
  Alert, AsyncSection, Badge, Button, Card, DataRow, EmptyState, PageHeader,
  SectionHeading, Table, TableWrap, Td, Th, Tr,
} from '../../ui';
import { CompositionBar, ProgressRing, StatTile } from '../../charts';
import {
  ATTENDANCE, COVERAGE_STATE, GENDER_TRACK, LESSON_STATUS, MASTERY, PACING,
  mediumDate, percent, relativeDay, SESSION_TYPES,
} from '../../lib/format';

const STATE_ICON = { achieved: Check, in_progress: Clock, pending: Minus };

export default function AdminClassDetail() {
  const { classId } = useParams();
  const query = useApi(() => api.admin.classDetail(classId), [classId]);

  return (
    <>
      <Button as={Link} to="/admin/classes" variant="ghost" size="sm" icon={<ArrowLeft size={15} />} className="mb-3">
        All classes
      </Button>

      <AsyncSection query={query} rows={6}>
        {(data) => {
          const { progress, week, roster, logs, attendance, term } = data;
          const cls = progress.class;

          return (
            <>
              <PageHeader
                eyebrow={`${term.title} · ${GENDER_TRACK[cls.gender_track]} track`}
                title={cls.name}
                description={[
                  cls.room,
                  `${cls.student_count} pupils`,
                  cls.teachers.map((t) => t.full_name).join(', ') || 'No teacher assigned',
                ].filter(Boolean).join(' · ')}
                actions={<Badge tone={PACING[progress.pacingStatus].tone}>{PACING[progress.pacingStatus].label}</Badge>}
              />

              {cls.teachers.length === 0 && (
                <Alert
                  tone="risk"
                  title="No teacher is assigned to this class"
                  className="mb-5"
                  action={(
                    <Button as={Link} to="/admin/classes" size="sm" variant="secondary">
                      Assign one
                    </Button>
                  )}
                >
                  Until someone is assigned, nobody can record this class&rsquo;s lessons or take its
                  register, and it will keep showing as behind pace.
                </Alert>
              )}

              <div className="mb-5 grid gap-4 lg:grid-cols-[auto_1fr]">
                <Card className="flex items-center justify-center">
                  <ProgressRing
                    value={progress.progressPercent}
                    label="Term progress"
                    sublabel={`${progress.expectedPercent}% expected by today`}
                    tone={PACING[progress.pacingStatus].tone === 'ok' ? 'ok' : PACING[progress.pacingStatus].tone}
                    size={112}
                  />
                </Card>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Standards achieved" value={`${progress.achievedCount}/${progress.requiredCount}`} sublabel={`${progress.inProgressCount} being taught`} />
                  <StatTile label="Check-offs logged" value={`${progress.loggedSessions}/${progress.expectedSessions}`} sublabel={`${progress.loggingPercent}% of sessions`} tone={progress.loggingPercent < 80 ? 'warn' : 'ok'} />
                  <StatTile label="Attendance" value={percent(attendance.rate)} sublabel={`${attendance.absent} absences`} tone="info" />
                  <StatTile label="Last logged" value={progress.lastLoggedDate ? relativeDay(progress.lastLoggedDate) : '—'} sublabel={progress.lastLoggedDate ? mediumDate(progress.lastLoggedDate) : 'no records'} />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* Weekly matrix */}
                <Card>
                  <SectionHeading title="This week" description="One strand per weekday." />
                  <ul className="space-y-1.5">
                    {week.map((day) => {
                      const config = {
                        completed: { tone: 'ok', label: 'Logged' },
                        partial: { tone: 'warn', label: 'Partly covered' },
                        not_taught: { tone: 'risk', label: 'Not taught' },
                        pending: { tone: 'neutral', label: 'No record yet' },
                      }[day.state];
                      return (
                        <li
                          key={day.date}
                          className="flex items-center gap-3 rounded-lg px-3 py-2"
                          style={{ background: 'var(--surface-sunken)' }}
                        >
                          <span className="w-16 shrink-0 text-[0.78rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                            {day.dayName.slice(0, 3)}
                          </span>
                          <span className="term w-24 shrink-0 text-[0.78rem]" style={{ color: 'var(--text-body)' }}>
                            {day.expectedSubject}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[0.76rem]" style={{ color: 'var(--text-muted)' }}>
                            {day.log?.topic_covered || '—'}
                          </span>
                          <Badge tone={config.tone} size="sm">{config.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </Card>

                {/* Syllabus coverage */}
                <Card>
                  <SectionHeading
                    title="Term syllabus"
                    description="Each strand's standard, and how far the class has got with it."
                  />
                  <ul className="space-y-2.5">
                    {progress.coverage.map((topic) => {
                      const Icon = STATE_ICON[topic.state] || Minus;
                      const tone = COVERAGE_STATE[topic.state].tone;
                      return (
                        <li key={topic.id} className="flex gap-3">
                          <span
                            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                            style={{ background: `var(--${tone === 'neutral' ? 'neutral' : tone}-soft)`, color: `var(--${tone}-ink)` }}
                          >
                            <Icon size={13} strokeWidth={2.6} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-baseline gap-2">
                              <span className="term text-[0.82rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                                {topic.subject}
                              </span>
                              <Badge tone={tone} size="sm">{COVERAGE_STATE[topic.state].label}</Badge>
                              {topic.sessionCount > 0 && (
                                <span className="num text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                                  {topic.sessionCount} session{topic.sessionCount === 1 ? '' : 's'}
                                </span>
                              )}
                            </p>
                            <p className="term text-[0.78rem]" style={{ color: 'var(--text-body)' }}>
                              {topic.topic_title}
                            </p>
                            <p className="term text-[0.74rem] italic" style={{ color: 'var(--text-muted)' }}>
                              Expected: {topic.expected_indicator}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {progress.memorizationStandard && (
                    <div
                      className="mt-4 rounded-lg px-3 py-3"
                      style={{ background: 'var(--accent-soft)' }}
                    >
                      <p className="mb-1 text-[0.74rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--accent-text)' }}>
                        Memorization target
                      </p>
                      <dl className="term text-[0.79rem]" style={{ color: 'var(--accent-text)' }}>
                        <DataRow label="Sūrah">{progress.memorizationStandard.surah}</DataRow>
                        <DataRow label="Duʿā'">{progress.memorizationStandard.dua}</DataRow>
                        <DataRow label="Names of Allāh">{progress.memorizationStandard.names_of_allah}</DataRow>
                      </dl>
                    </div>
                  )}
                </Card>
              </div>

              {/* Roll */}
              <Card className="mt-5">
                <SectionHeading
                  title={`Roll — ${roster.length} pupils`}
                  description="Attendance shown for today."
                />
                {roster.length === 0 ? (
                  <EmptyState title="No pupils enrolled" description="Add students to this class from the Students screen." />
                ) : (
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Pupil</Th>
                          <Th>Code</Th>
                          <Th align="center">Today</Th>
                          <Th align="right">Enrolled</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((student) => (
                          <Tr key={student.id}>
                            <Td>
                              <Link
                                to={`/admin/students/${student.id}`}
                                className="font-medium hover:underline"
                                style={{ color: 'var(--text-strong)' }}
                              >
                                {student.first_name} {student.last_name}
                              </Link>
                            </Td>
                            <Td className="num text-[0.76rem]">{student.student_code}</Td>
                            <Td align="center">
                              {student.attendance_today
                                ? <Badge tone={ATTENDANCE[student.attendance_today].tone} size="sm">{ATTENDANCE[student.attendance_today].label}</Badge>
                                : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </Td>
                            <Td align="right" className="text-[0.76rem]">{mediumDate(student.enrolled_on)}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </Card>

              {/* Log history */}
              <Card className="mt-5">
                <SectionHeading title="Lesson log history" description="Most recent 40 records." />
                {logs.length === 0 ? (
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
                          <Th align="center">Class mastery</Th>
                          <Th>Logged by</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <Tr key={log.id}>
                            <Td className="whitespace-nowrap text-[0.76rem]">{mediumDate(log.date)}</Td>
                            <Td className="term whitespace-nowrap">{log.subject}</Td>
                            <Td className="term max-w-72"><span className="line-clamp-2">{log.topic_covered}</span></Td>
                            <Td className="whitespace-nowrap text-[0.76rem]">{SESSION_TYPES[log.session_type] || log.session_type}</Td>
                            <Td align="center">
                              <Badge tone={LESSON_STATUS[log.status]?.tone || 'neutral'} size="sm">
                                {LESSON_STATUS[log.status]?.label || log.status}
                              </Badge>
                            </Td>
                            <Td align="center">
                              <Badge tone={MASTERY[log.class_mastery]?.tone || 'neutral'} size="sm">
                                {MASTERY[log.class_mastery]?.label || log.class_mastery}
                              </Badge>
                            </Td>
                            <Td className="max-w-40 truncate text-[0.76rem]">{log.teacher_name}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </Card>

              {/* Attendance composition */}
              <Card className="mt-5">
                <SectionHeading title="Attendance this term" description={`${attendance.recorded} records across the term.`} />
                <CompositionBar
                  segments={[
                    { label: ATTENDANCE.present.label, value: attendance.present, tone: 'ok' },
                    { label: ATTENDANCE.late.label, value: attendance.late, tone: 'warn' },
                    { label: ATTENDANCE.absent.label, value: attendance.absent, tone: 'risk' },
                    { label: ATTENDANCE.excused.label, value: attendance.excused, tone: 'info' },
                  ]}
                  height={12}
                />
              </Card>
            </>
          );
        }}
      </AsyncSection>
    </>
  );
}
