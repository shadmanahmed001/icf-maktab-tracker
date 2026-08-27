/**
 * Presentational pieces shared by the admin, teacher and parent views of a
 * student. The same figures must read identically to the office, the teacher
 * and the family — so they are built once here rather than three times.
 */
import { Check, Minus, Clock } from 'lucide-react';
import {
  Badge, Card, DataRow, EmptyState, SectionHeading, Table, TableWrap, Td, Th, Tr, cx,
} from '../ui';
import { CompositionBar, ProgressRing } from '../charts';
import {
  ATTENDANCE, MASTERY, MASTERY_ORDER, MEMORIZATION_ITEM, MEMORIZATION_STATUS,
  mediumDate, percent, SESSION_TYPES, LESSON_STATUS,
} from '../lib/format';

/** The four-band mastery scale, explained. Shown once per report view. */
export function MasteryScaleLegend({ className }) {
  return (
    <div className={cx('flex flex-wrap gap-x-4 gap-y-1.5', className)}>
      {MASTERY_ORDER.map((level) => (
        <span key={level} className="flex items-center gap-1.5 text-[0.74rem]">
          <Badge tone={MASTERY[level].tone} size="sm">{MASTERY[level].label}</Badge>
        </span>
      ))}
    </div>
  );
}

/** Subject-by-subject progress for one student in one term. */
export function AssessmentTable({ assessments, emptyHint, onEdit }) {
  if (!assessments.length) {
    return (
      <EmptyState
        title="No assessments recorded yet"
        description={emptyHint || 'Progress appears here once the teacher has assessed each subject.'}
      />
    );
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Subject</Th>
            <Th align="center">Progress</Th>
            <Th>Teacher&rsquo;s comment</Th>
            <Th align="right">Assessed</Th>
            {onEdit && <Th align="right">Edit</Th>}
          </tr>
        </thead>
        <tbody>
          {assessments.map((row) => (
            <Tr key={row.id ?? row.subject}>
              <Td className="term whitespace-nowrap font-medium" style={{ color: 'var(--text-strong)' }}>
                {row.subject}
              </Td>
              <Td align="center">
                <Badge tone={MASTERY[row.mastery_level]?.tone || 'neutral'} size="sm">
                  {MASTERY[row.mastery_level]?.label || row.mastery_level}
                </Badge>
              </Td>
              <Td className="term max-w-80 text-[0.79rem]">{row.comment || '—'}</Td>
              <Td align="right" className="whitespace-nowrap text-[0.76rem]">{mediumDate(row.assessed_on)}</Td>
              {onEdit && (
                <Td align="right">
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="text-[0.78rem] font-semibold hover:underline"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    Change
                  </button>
                </Td>
              )}
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

const MEM_ICON = { mastered: Check, in_progress: Clock, not_started: Minus };

/**
 * Memorization against the term's target. The target itself is shown even when
 * nothing is recorded, so a family always knows what their child is working on.
 */
export function MemorizationPanel({ progress, standard, onEdit, className }) {
  const byType = new Map((progress || []).map((p) => [p.item_type, p]));
  const items = ['surah', 'dua', 'names'];

  const targetFor = (type) => {
    if (!standard) return null;
    return { surah: standard.surah, dua: standard.dua, names: standard.names_of_allah }[type];
  };

  return (
    <div className={cx('space-y-2.5', className)}>
      {items.map((type) => {
        const record = byType.get(type);
        const status = record?.status || 'not_started';
        const Icon = MEM_ICON[status];
        const tone = MEMORIZATION_STATUS[status].tone;
        const label = record?.item_label || targetFor(type);

        return (
          <div
            key={type}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5"
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
                <span className="text-[0.78rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                  {MEMORIZATION_ITEM[type]}
                </span>
                <Badge tone={tone} size="sm">{MEMORIZATION_STATUS[status].label}</Badge>
                {record?.verified_on && (
                  <span className="text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                    verified {mediumDate(record.verified_on)}
                  </span>
                )}
              </p>
              <p className="term text-[0.8rem]" style={{ color: 'var(--text-body)' }}>
                {label || 'No target set for this term'}
              </p>
            </div>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(type, record, label)}
                className="shrink-0 text-[0.76rem] font-semibold hover:underline"
                style={{ color: 'var(--accent-text)' }}
              >
                Change
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Attendance summary: the headline rate plus its composition. */
export function AttendanceSummaryCard({ summary, title = 'Attendance', description, className }) {
  if (!summary) return null;
  const tone = summary.rate === null ? 'neutral'
    : summary.rate >= 95 ? 'ok' : summary.rate >= 85 ? 'warn' : 'risk';

  return (
    <Card className={className}>
      <SectionHeading title={title} description={description} />
      <div className="flex flex-wrap items-center gap-6">
        <ProgressRing value={summary.rate ?? 0} tone={tone} size={92} label="Present" sublabel="incl. late arrivals" />
        <div className="min-w-48 flex-1">
          <CompositionBar
            segments={[
              { label: ATTENDANCE.present.label, value: summary.present, tone: 'ok' },
              { label: ATTENDANCE.late.label, value: summary.late, tone: 'warn' },
              { label: ATTENDANCE.absent.label, value: summary.absent, tone: 'risk' },
              { label: ATTENDANCE.excused.label, value: summary.excused, tone: 'info' },
            ]}
            height={12}
          />
          <dl className="mt-3">
            <DataRow label="Sessions recorded">{summary.recorded}</DataRow>
            <DataRow label="Teaching days in range">{summary.sessions}</DataRow>
          </dl>
          <p className="mt-2 text-[0.74rem]" style={{ color: 'var(--text-muted)' }}>
            Excused absences notified in advance are not counted against the attendance rate.
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Day-by-day attendance records. */
export function AttendanceRecordList({ records, className }) {
  if (!records?.length) {
    return <EmptyState className={className} title="No attendance recorded yet" />;
  }
  return (
    <TableWrap className={className}>
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th align="center">Status</Th>
            <Th align="center">Minutes late</Th>
            <Th>Note</Th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <Tr key={record.date}>
              <Td className="whitespace-nowrap">{mediumDate(record.date)}</Td>
              <Td align="center">
                <Badge tone={ATTENDANCE[record.status]?.tone || 'neutral'} size="sm">
                  {ATTENDANCE[record.status]?.label || record.status}
                </Badge>
              </Td>
              <Td align="center" className="num">{record.minutes_late || '—'}</Td>
              <Td className="max-w-72 text-[0.79rem]">{record.note || '—'}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

/** Lessons a class covered — the parent-facing "what did they learn" view. */
export function LessonHistoryList({ lessons, className, showTeacher = true }) {
  if (!lessons?.length) {
    return <EmptyState className={className} title="No lessons recorded yet" description="Lessons appear here as teachers complete the daily log." />;
  }

  return (
    <ul className={cx('space-y-2', className)}>
      {lessons.map((lesson) => (
        <li
          key={lesson.id}
          className="rounded-xl px-3.5 py-3"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="term text-[0.86rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                {lesson.subject}
              </span>
              <Badge tone={LESSON_STATUS[lesson.status]?.tone || 'neutral'} size="sm">
                {LESSON_STATUS[lesson.status]?.label || lesson.status}
              </Badge>
              {lesson.session_type !== 'standard_lesson' && (
                <Badge tone="info" size="sm">{SESSION_TYPES[lesson.session_type] || lesson.session_type}</Badge>
              )}
            </p>
            <p className="text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
              {mediumDate(lesson.date)}
            </p>
          </div>

          <p className="term mt-1 text-[0.83rem]" style={{ color: 'var(--text-body)' }}>
            {lesson.topic_covered}
          </p>

          {lesson.expected_indicator && (
            <p className="term mt-1 text-[0.77rem] italic" style={{ color: 'var(--text-muted)' }}>
              What your child should be able to do: {lesson.expected_indicator}
            </p>
          )}

          {lesson.memorization_covered && (
            <p className="term mt-1.5 text-[0.77rem]" style={{ color: 'var(--accent-text)' }}>
              Memorization: {lesson.memorization_covered}
            </p>
          )}

          {showTeacher && (
            <p className="mt-1.5 text-[0.73rem]" style={{ color: 'var(--text-muted)' }}>
              Logged by {lesson.teacher_name}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * What the teacher has written about this child, presented as remarks rather
 * than as a column of a results table. Parents come looking for exactly this,
 * so it reads as prose with the subject and the judgement attached.
 */
export function TeacherComments({ assessments, childName, className }) {
  const withComments = (assessments || []).filter((a) => a.comment && a.comment.trim());

  if (!withComments.length) {
    return (
      <div
        className={cx('rounded-xl px-4 py-6 text-center', className)}
        style={{ background: 'var(--surface-sunken)' }}
      >
        <p className="text-[0.85rem] font-medium" style={{ color: 'var(--text-strong)' }}>
          No written comments yet this term
        </p>
        <p className="mt-1 text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>
          {childName ? `${childName}'s teacher` : 'The class teacher'} adds a remark for each subject
          as it is assessed. They will appear here and on the term report card.
        </p>
      </div>
    );
  }

  return (
    <ul className={cx('space-y-2.5', className)}>
      {withComments.map((entry) => (
        <li
          key={entry.id ?? entry.subject}
          className="rounded-xl px-3.5 py-3"
          style={{
            background: 'var(--surface-sunken)',
            borderLeft: `3px solid ${markForLevel(entry.mastery_level)}`,
          }}
        >
          <p className="mb-1 flex flex-wrap items-center gap-2">
            <span className="term text-[0.85rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
              {entry.subject}
            </span>
            <Badge tone={MASTERY[entry.mastery_level]?.tone || 'neutral'} size="sm">
              {MASTERY[entry.mastery_level]?.label || entry.mastery_level}
            </Badge>
            <span className="text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>
              {mediumDate(entry.assessed_on)}
              {entry.assessor ? ` \u00b7 ${entry.assessor}` : ''}
            </span>
          </p>
          <p className="term text-[0.85rem] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            &ldquo;{entry.comment}&rdquo;
          </p>
        </li>
      ))}
    </ul>
  );
}

/** The mark colour for an progress band, used for the remark's edge stripe. */
function markForLevel(level) {
  const tone = MASTERY[level]?.tone || 'neutral';
  return `var(--${tone})`;
}

/** Overall progress as a single headline, when one number is the message. */
export function OverallProgress({ overall, className }) {
  if (!overall) {
    return (
      <div className={cx('text-center', className)}>
        <p className="text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
          Not enough assessments recorded yet to give an overall level.
        </p>
      </div>
    );
  }
  return (
    <div className={cx('flex flex-col items-center', className)}>
      <ProgressRing
        value={overall.percent}
        tone={MASTERY[overall.level]?.tone || 'neutral'}
        size={104}
      />
      <Badge tone={MASTERY[overall.level]?.tone || 'neutral'} className="mt-2">{overall.label}</Badge>
      <p className="mt-1 text-center text-[0.74rem]" style={{ color: 'var(--text-muted)' }}>
        Averaged across all assessed subjects
      </p>
    </div>
  );
}

export { percent };
