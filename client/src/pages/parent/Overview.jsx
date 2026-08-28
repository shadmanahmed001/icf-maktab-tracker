/**
 * The family's progress page.
 *
 * A parent has three questions: how is my child doing, have they been
 * attending, and what has the teacher said. So the page answers those in that
 * order and puts everything else — memorization detail, lessons covered,
 * homework — below, reachable but not competing for attention.
 */
import { Link } from 'react-router-dom';
import {
  NotebookPen, Award, ChevronRight, MessageSquare, BookOpen, Megaphone,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedChild } from '../../layout/portals';
import {
  Alert, AsyncSection, Badge, Button, Card, EmptyState, PageHeader, SectionHeading,
} from '../../ui';
import { CompositionBar, PacingBar, ProgressRing } from '../../charts';
import {
  MemorizationPanel, OverallProgress, TeacherComments,
} from '../../features/progress';
import { ATTENDANCE, longDate, mediumDate, pluralize } from '../../lib/format';

export default function FamilyProgress() {
  const { selectedId } = useSelectedChild();
  const home = useApi(() => api.parent.home(), []);
  // The detail call carries the assessments, and with them the teacher's remarks.
  const detail = useApi(
    () => api.parent.child(selectedId),
    [selectedId],
    { skip: !selectedId }
  );

  return (
    <AsyncSection query={home} rows={6}>
      {(data) => {
        const child = data.children.find((c) => c.id === selectedId) || data.children[0];
        if (!child) {
          return (
            <EmptyState
              title="No children linked"
              description="Ask the maktab office to link your children to this account."
            />
          );
        }

        const attendanceTone = child.attendance?.rate === null ? 'neutral'
          : child.attendance.rate >= 95 ? 'ok' : child.attendance.rate >= 85 ? 'warn' : 'risk';
        const mastered = (child.memorization || []).filter((m) => m.status === 'mastered').length;

        return (
          <>
            <PageHeader
              eyebrow={`${data.term.title} · ${child.class_name || 'No class'}`}
              title={`How ${child.first_name} is doing`}
              description={
                data.expectedSubject
                  ? `Today is ${longDate(data.date)} — the class is studying ${data.expectedSubject}.`
                  : `${longDate(data.date)} is not a teaching day.`
              }
              actions={(
                <Button as={Link} to="/family/report" variant="primary" icon={<Award size={15} />}>
                  Term report card
                </Button>
              )}
            />

            {data.unreadMessages > 0 && (
              <Alert
                tone="info"
                className="mb-5"
                action={<Button as={Link} to="/family/messages" size="sm" variant="secondary">Read</Button>}
              >
                You have {pluralize(data.unreadMessages, 'unread message')} from the maktab.
              </Alert>
            )}

            {/* 1. The three headline figures */}
            <div className="mb-5 grid gap-4 lg:grid-cols-3">
              <Card>
                <SectionHeading title="Progress" description="Across all subjects assessed this term." />
                <OverallProgress overall={child.overall} />
              </Card>

              <Card>
                <SectionHeading
                  title="Attendance"
                  description={`${child.attendance?.recorded || 0} sessions recorded.`}
                />
                <div className="flex flex-col items-center">
                  <ProgressRing value={child.attendance?.rate ?? 0} tone={attendanceTone} size={104} />
                  <p className="mt-2 text-center text-[0.78rem]" style={{ color: 'var(--text-muted)' }}>
                    {child.attendance?.absent || 0} unexplained{' '}
                    {child.attendance?.absent === 1 ? 'absence' : 'absences'}
                    {child.attendance?.late ? `, ${child.attendance.late} late` : ''}
                  </p>
                </div>
                <div className="mt-3">
                  <CompositionBar
                    height={8}
                    showLegend={false}
                    segments={[
                      { label: ATTENDANCE.present.label, value: child.attendance?.present || 0, tone: 'ok' },
                      { label: ATTENDANCE.late.label, value: child.attendance?.late || 0, tone: 'warn' },
                      { label: ATTENDANCE.absent.label, value: child.attendance?.absent || 0, tone: 'risk' },
                      { label: ATTENDANCE.excused.label, value: child.attendance?.excused || 0, tone: 'info' },
                    ]}
                  />
                </div>
                <Button
                  as={Link}
                  to="/family/attendance"
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full"
                  icon={<ChevronRight size={14} />}
                >
                  Session by session
                </Button>
              </Card>

              <Card>
                <SectionHeading title="Memorization" description="Sūrah, Duʿā' and Names of Allāh." />
                <div className="flex flex-col items-center">
                  <ProgressRing
                    value={Math.round((mastered / 3) * 100)}
                    tone={mastered === 3 ? 'ok' : mastered === 0 ? 'risk' : 'warn'}
                    size={104}
                  />
                  <Badge tone={mastered === 3 ? 'ok' : mastered === 0 ? 'neutral' : 'warn'} className="mt-2">
                    {mastered} of 3 mastered
                  </Badge>
                </div>
                <Button
                  as={Link}
                  to="/family/memorization"
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full"
                  icon={<ChevronRight size={14} />}
                >
                  See what to practice
                </Button>
              </Card>
            </div>

            {/* 2. What the teacher has said */}
            <Card className="mb-5">
              <SectionHeading
                title="What the teacher says"
                description={`${child.first_name}'s teacher writes a remark for each subject as it is assessed.`}
                action={(
                  <Button
                    as={Link}
                    to="/family/messages"
                    variant="secondary"
                    size="sm"
                    icon={<MessageSquare size={14} />}
                  >
                    Reply to the teacher
                  </Button>
                )}
              />
              <AsyncSection query={detail} rows={3}>
                {(full) => (
                  <TeacherComments assessments={full.assessments} childName={child.first_name} />
                )}
              </AsyncSection>
            </Card>

            {/* 3. Everything else, in one column */}
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeading
                  title="What the class is working on"
                  description="Progress through this term's five subjects."
                />
                {child.classProgress ? (
                  <>
                    <PacingBar
                      value={child.classProgress.completionPercent}
                      expected={child.classProgress.expectedPercent}
                      label="Syllabus covered"
                      height={10}
                    />
                    <p className="mt-2 text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>
                      {child.classProgress.coveredCount} of {child.classProgress.requiredCount} standards
                      completed, with {child.classProgress.expectedPercent}% of the term elapsed.
                    </p>
                  </>
                ) : (
                  <p className="text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
                    {child.first_name} is not assigned to a class yet.
                  </p>
                )}

                {child.lastLesson && (
                  <div className="mt-4 rounded-lg px-3.5 py-3" style={{ background: 'var(--surface-sunken)' }}>
                    <p
                      className="mb-0.5 text-[0.72rem] font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Most recent lesson · {mediumDate(child.lastLesson.date)}
                    </p>
                    <p className="term text-[0.85rem] font-medium" style={{ color: 'var(--text-strong)' }}>
                      {child.lastLesson.subject}
                    </p>
                    <p className="term text-[0.82rem]" style={{ color: 'var(--text-body)' }}>
                      {child.lastLesson.topic_covered}
                    </p>
                  </div>
                )}

                <Button
                  as={Link}
                  to="/family/lessons"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  icon={<BookOpen size={14} />}
                >
                  Every lesson covered
                </Button>
              </Card>

              <Card>
                <SectionHeading title="Memorization target this term" description={`Grade ${child.grade}.`} />
                <MemorizationPanel
                  progress={child.memorization}
                  standard={child.memorizationStandard}
                />
              </Card>

              <Card>
                <SectionHeading
                  title="Homework"
                  description={child.openHomework.length ? 'Currently set for the class.' : undefined}
                />
                {child.openHomework.length === 0 ? (
                  <p className="text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
                    No homework is currently set.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {child.openHomework.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5"
                        style={{ background: 'var(--surface-sunken)' }}
                      >
                        <span className="min-w-0">
                          <span className="term block text-[0.83rem] font-medium" style={{ color: 'var(--text-strong)' }}>
                            {item.title}
                          </span>
                          <span className="term block text-[0.74rem]" style={{ color: 'var(--text-muted)' }}>
                            {item.subject}
                          </span>
                        </span>
                        {item.due_date && (
                          <Badge tone="warn" size="sm">Due {mediumDate(item.due_date)}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  as={Link}
                  to="/family/homework"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  icon={<NotebookPen size={14} />}
                >
                  All homework
                </Button>
              </Card>

              <OfficeNotices teachers={child.teachers} />
            </div>
          </>
        );
      }}
    </AsyncSection>
  );
}

/** Notices from the maktab, plus who to contact — both lost their nav items. */
function OfficeNotices({ teachers }) {
  const query = useApi(() => api.announcements({ limit: 3 }), []);
  const notices = query.data?.announcements || [];

  return (
    <Card>
      <SectionHeading
        title="From the maktab"
        description="Notices for families and for your child's class."
        action={(
          <Button as={Link} to="/family/notices" variant="ghost" size="sm" icon={<Megaphone size={14} />}>
            All notices
          </Button>
        )}
      />

      {notices.length === 0 ? (
        <p className="text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
          No notices at the moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {notices.map((notice) => (
            <li key={notice.id} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-sunken)' }}>
              <p className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className="text-[0.84rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                  {notice.title}
                </span>
                {notice.is_pinned === 1 && <Badge tone="accent" size="sm">Pinned</Badge>}
              </p>
              <p className="line-clamp-2 text-[0.8rem]" style={{ color: 'var(--text-body)' }}>
                {notice.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {teachers?.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="mb-1.5 text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>
            Your child&rsquo;s {teachers.length === 1 ? 'teacher' : 'teachers'}
          </p>
          <ul className="space-y-1">
            {teachers.map((teacher) => (
              <li key={teacher.id} className="flex items-baseline justify-between gap-3 text-[0.82rem]">
                <span style={{ color: 'var(--text-strong)' }}>{teacher.full_name}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {teacher.role === 'lead' ? 'Class teacher' : teacher.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
