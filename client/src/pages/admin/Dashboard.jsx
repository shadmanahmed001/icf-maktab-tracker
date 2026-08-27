/**
 * The administrator's morning view: is the maktab on pace, and what needs
 * doing today. Ordered so the actionable items sit above the reference data.
 */
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, GraduationCap, School, Users, ClipboardCheck, ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import {
  AsyncSection, Badge, Button, Card, EmptyState, PageHeader, SectionHeading,
  Table, TableWrap, Td, Th, Tr, Dot,
} from '../../ui';
import { CompositionBar, PacingBar, StatTile } from '../../charts';
import { ATTENDANCE, LESSON_STATUS, PACING, longDate, percent, pluralise, relativeDay } from '../../lib/format';

export default function AdminDashboard() {
  const query = useApi(() => api.admin.dashboard(), []);

  return (
    <AsyncSection query={query} rows={5}>
      {(data) => {
        const { stats, term, pacing, missingToday, attendanceToday, attendanceTerm } = data;
        const needsAttention = pacing
          .filter((p) => p.pacingStatus === 'behind' || p.pacingStatus === 'watch')
          .sort((a, b) => (a.progressPercent - a.expectedPercent) - (b.progressPercent - b.expectedPercent));

        return (
          <>
            <PageHeader
              eyebrow={`${term.title} · ${term.date_range}`}
              title={`Assalāmu ʿalaykum${data.dayName ? `, it's ${data.dayName}` : ''}`}
              description={
                data.expectedSubject
                  ? `Today's strand across the maktab is ${data.expectedSubject}. ${longDate(data.today)}.`
                  : `${longDate(data.today)} is not a teaching day.`
              }
              actions={(
                <Button as={Link} to="/admin/reports" variant="primary" icon={<Activity size={15} />}>
                  Board digest
                </Button>
              )}
            />

            {/* Headline figures */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="On track"
                value={`${stats.onTrack}/${stats.classes}`}
                sublabel="classes keeping pace"
                tone="ok"
                emphasis
                icon={<School size={17} />}
              />
              <StatTile
                label="Need attention"
                value={stats.watch + stats.behind}
                sublabel={stats.behind ? `${stats.behind} well behind` : 'slipping on pace or records'}
                tone={stats.behind ? 'risk' : 'warn'}
                emphasis={stats.watch + stats.behind > 0}
                icon={<AlertTriangle size={17} />}
              />
              <StatTile
                label="Students enrolled"
                value={stats.students}
                sublabel={`${pluralise(stats.teachers, 'teacher')} · ${pluralise(stats.parents, 'parent account')}`}
                icon={<GraduationCap size={17} />}
              />
              <StatTile
                label="Attendance this term"
                value={percent(attendanceTerm.rate)}
                sublabel={`${attendanceTerm.recorded.toLocaleString()} records`}
                tone="info"
                icon={<Users size={17} />}
              />
            </div>

            <SetupGaps setup={data.setup} />

            <div className="grid gap-5 lg:grid-cols-3">
              {/* Today's outstanding check-offs */}
              <Card className="lg:col-span-2">
                <SectionHeading
                  title="Today's check-off"
                  description={
                    data.expectedSubject
                      ? `${stats.classes - missingToday.length} of ${stats.classes} classes have recorded today's lesson.`
                      : 'No lesson is expected today.'
                  }
                  action={(
                    <Badge tone={missingToday.length === 0 ? 'ok' : 'warn'}>
                      {missingToday.length === 0 ? 'All recorded' : `${missingToday.length} outstanding`}
                    </Badge>
                  )}
                />

                {missingToday.length === 0 ? (
                  <div
                    className="flex items-center gap-3 rounded-lg px-4 py-4"
                    style={{ background: 'var(--ok-soft)', color: 'var(--ok-ink)' }}
                  >
                    <ClipboardCheck size={20} className="shrink-0" />
                    <p className="text-[0.85rem] font-medium">
                      Every class has logged today&rsquo;s lesson. Nothing to chase.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {missingToday.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                        style={{ background: 'var(--surface-sunken)' }}
                      >
                        <div className="min-w-0">
                          <Link
                            to={`/admin/classes/${item.id}`}
                            className="block truncate text-[0.85rem] font-semibold hover:underline"
                            style={{ color: 'var(--text-strong)' }}
                          >
                            {item.name}
                          </Link>
                          <p className="truncate text-[0.74rem]" style={{ color: 'var(--text-muted)' }}>
                            {item.teachers.map((t) => t.full_name).join(', ') || 'No teacher assigned'}
                          </p>
                        </div>
                        <Badge tone="warn" size="sm">Not logged</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Attendance today */}
              <Card>
                <SectionHeading
                  title="Attendance today"
                  description={attendanceToday.recorded ? `${attendanceToday.recorded} pupils marked` : 'Not yet taken'}
                />
                {attendanceToday.recorded === 0 ? (
                  <p className="py-6 text-center text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
                    No register has been taken yet today.
                  </p>
                ) : (
                  <>
                    <p className="num mb-3 text-3xl font-semibold" style={{ color: 'var(--text-strong)' }}>
                      {percent(attendanceToday.rate)}
                    </p>
                    <CompositionBar
                      segments={[
                        { label: ATTENDANCE.present.label, value: attendanceToday.present, tone: 'ok' },
                        { label: ATTENDANCE.late.label, value: attendanceToday.late, tone: 'warn' },
                        { label: ATTENDANCE.absent.label, value: attendanceToday.absent, tone: 'risk' },
                        { label: ATTENDANCE.excused.label, value: attendanceToday.excused, tone: 'info' },
                      ]}
                    />
                  </>
                )}
              </Card>
            </div>

            {/* Classes needing attention */}
            <Card className="mt-5">
              <SectionHeading
                title="Classes needing attention"
                description="Ranked by how far coverage sits behind where the term should be by today."
                action={(
                  <Button as={Link} to="/admin/pacing" variant="ghost" size="sm" icon={<ArrowRight size={14} />}>
                    Full radar
                  </Button>
                )}
              />
              {needsAttention.length === 0 ? (
                <EmptyState
                  title="Every class is on pace"
                  description="Coverage and daily record-keeping are both where they should be for this point in the term."
                />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Class</Th>
                        <Th>Teacher</Th>
                        <Th align="center">Status</Th>
                        <Th>Progress vs expected</Th>
                        <Th align="center">Check-offs</Th>
                        <Th>Next standard</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {needsAttention.map((row) => (
                        <Tr key={row.class.id}>
                          <Td>
                            <Link
                              to={`/admin/classes/${row.class.id}`}
                              className="font-semibold hover:underline"
                              style={{ color: 'var(--text-strong)' }}
                            >
                              {row.class.name}
                            </Link>
                          </Td>
                          <Td className="max-w-40 truncate">
                            {row.class.teachers.map((t) => t.full_name).join(', ') || '—'}
                          </Td>
                          <Td align="center">
                            <Badge tone={PACING[row.pacingStatus].tone} size="sm">
                              {PACING[row.pacingStatus].label}
                            </Badge>
                          </Td>
                          <Td className="min-w-44">
                            <PacingBar value={row.progressPercent} expected={row.expectedPercent} tone="accent" />
                            <p className="num mt-1 text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                              {row.progressPercent}% progress · {row.expectedPercent}% expected
                            </p>
                          </Td>
                          <Td align="center" className="num">
                            <span style={{ color: row.loggingPercent < 80 ? 'var(--warn-ink)' : 'var(--text-body)' }}>
                              {row.loggedSessions}/{row.expectedSessions}
                            </span>
                          </Td>
                          <Td className="max-w-56">
                            <span className="term line-clamp-2 text-[0.78rem]">
                              {row.nextTopic ? `${row.nextTopic.subject}: ${row.nextTopic.topic_title}` : 'Term complete'}
                            </span>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>

            {/* Live activity */}
            <Card className="mt-5">
              <SectionHeading
                title="Recent lesson logs"
                description="What teachers have recorded across the maktab, most recent first."
              />
              {data.recentActivity.length === 0 ? (
                <EmptyState title="No lessons logged yet" description="Records will appear here as teachers check off their lessons." />
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {data.recentActivity.map((log) => (
                    <li key={log.id} className="flex items-start gap-3 py-2.5">
                      <Dot tone={LESSON_STATUS[log.status]?.tone || 'neutral'} className="mt-1.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.83rem]" style={{ color: 'var(--text-strong)' }}>
                          <span className="font-semibold">{log.class_name}</span>
                          <span style={{ color: 'var(--text-muted)' }}> · {log.subject}</span>
                        </p>
                        <p className="term line-clamp-1 text-[0.78rem]" style={{ color: 'var(--text-muted)' }}>
                          {log.topic_covered}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[0.74rem] font-medium" style={{ color: 'var(--text-body)' }}>
                          {relativeDay(log.date)}
                        </p>
                        <p className="text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>{log.teacher_name}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      }}
    </AsyncSection>
  );
}

/**
 * The states in which the system quietly stops working for somebody: a class
 * nobody can record, a pupil on no register, a family with no way in. Shown
 * only when there is something to act on, so a configured school sees nothing.
 */
function SetupGaps({ setup }) {
  if (!setup) return null;

  const gaps = [
    {
      key: 'teacher',
      tone: 'risk',
      count: setup.classesWithoutTeacher.length,
      title: 'classes have no teacher assigned',
      detail: setup.classesWithoutTeacher.map((c) => c.name).join(', '),
      action: { to: '/admin/classes', label: 'Assign teachers' },
      why: 'Nobody can record their lessons or take their register.',
    },
    {
      key: 'class',
      tone: 'warn',
      count: setup.studentsWithoutClass.length,
      title: 'pupils are not in a class',
      detail: setup.studentsWithoutClass.map((s) => `${s.first_name} ${s.last_name}`).join(', '),
      action: { to: '/admin/students', label: 'Place pupils' },
      why: 'They will not appear on any register.',
    },
    {
      key: 'guardian',
      tone: 'warn',
      count: setup.studentsWithoutGuardian.length,
      title: 'pupils have no guardian linked',
      detail: setup.studentsWithoutGuardian
        .map((s) => `${s.first_name} ${s.last_name}`).slice(0, 8).join(', '),
      action: { to: '/admin/students', label: 'Link guardians' },
      why: 'Their family cannot see their progress.',
    },
  ].filter((gap) => gap.count > 0);

  const neverSignedIn = setup.teachersNeverSignedIn + setup.parentsNeverSignedIn;

  if (!gaps.length && neverSignedIn === 0) return null;

  return (
    <Card className="mb-5">
      <SectionHeading
        title="Needs setting up"
        description="Gaps that stop the system working for someone. This section disappears once they are cleared."
      />

      <ul className="space-y-2">
        {gaps.map((gap) => (
          <li
            key={gap.key}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg px-3.5 py-3"
            style={{ background: `var(--${gap.tone}-soft)` }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[0.85rem] font-semibold" style={{ color: `var(--${gap.tone}-ink)` }}>
                {gap.count} {gap.title}
              </p>
              <p className="text-[0.79rem]" style={{ color: `var(--${gap.tone}-ink)`, opacity: 0.9 }}>
                {gap.why} {gap.detail && <span className="opacity-80">— {gap.detail}</span>}
              </p>
            </div>
            <Button as={Link} to={gap.action.to} size="sm" variant="secondary" className="shrink-0">
              {gap.action.label}
            </Button>
          </li>
        ))}

        {neverSignedIn > 0 && (
          <li
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg px-3.5 py-3"
            style={{ background: 'var(--surface-sunken)' }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[0.85rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                {pluralise(neverSignedIn, 'account has', 'accounts have')} never been used
              </p>
              <p className="text-[0.79rem]" style={{ color: 'var(--text-muted)' }}>
                {[
                  setup.teachersNeverSignedIn && pluralise(setup.teachersNeverSignedIn, 'staff member'),
                  setup.parentsNeverSignedIn && pluralise(setup.parentsNeverSignedIn, 'parent'),
                ].filter(Boolean).join(' and ')}. They may still need their temporary password —
                you can reissue one at any time.
              </p>
            </div>
            <Button as={Link} to="/admin/people" size="sm" variant="secondary" className="shrink-0">
              Manage accounts
            </Button>
          </li>
        )}
      </ul>
    </Card>
  );
}
