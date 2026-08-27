/**
 * The daily log — the screen this whole system lives or dies by.
 *
 * Design intent: a teacher on a phone, between classes, should be able to
 * record the lesson in a handful of taps. So everything is pre-filled from the
 * curriculum (today's subject, the standard due, the memorization target) and
 * every choice is a tap target rather than a dropdown or free text. Free text
 * is optional and sits below the save button's line of sight.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, ClipboardCheck, Clock, X, UserCheck, ChevronRight, Info, RotateCcw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import { useSelectedClass } from '../../layout/portals';
import {
  Alert, AsyncSection, Badge, Button, Card, Disclosure, Field, Input, PageHeader,
  SectionHeading, Textarea, toast, cx,
} from '../../ui';
import { PacingBar } from '../../charts';
import {
  COVERAGE_STATE, MASTERY, MASTERY_ORDER, PACING, longDate, mediumDate,
  SESSION_TYPES, todayISO,
} from '../../lib/format';

const SESSION_OPTIONS = [
  { value: 'standard_lesson', label: 'Regular lesson' },
  { value: 'practical_demo', label: 'Practical demo' },
  { value: 'oral_testing', label: 'Oral testing' },
  { value: 'revision', label: 'Revision' },
];

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Taught in full', tone: 'ok', icon: Check },
  { value: 'partial', label: 'Partly covered', tone: 'warn', icon: Clock },
  { value: 'not_taught', label: 'Not taught', tone: 'risk', icon: X },
];

/** Large, thumb-sized choice buttons — the core interaction of this screen. */
function ChoiceRow({ label, hint, options, value, onChange, columns = 'auto' }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>
        {label}
        {hint && <span className="ml-2 font-normal" style={{ color: 'var(--text-muted)' }}>{hint}</span>}
      </p>
      <div
        className={cx('grid gap-2', columns === 'auto' ? 'grid-cols-2 sm:grid-cols-4' : columns)}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => {
          const active = option.value === value;
          const Icon = option.icon;
          const tone = option.tone || 'accent';
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[0.81rem] font-semibold transition-colors"
              style={active
                ? {
                  background: `var(--${tone === 'accent' ? 'accent' : tone}-soft)`,
                  color: `var(--${tone === 'accent' ? 'accent-text' : `${tone}-ink`})`,
                  border: `1.5px solid var(--${tone === 'accent' ? 'accent' : tone})`,
                }
                : {
                  background: 'var(--surface-card)',
                  color: 'var(--text-body)',
                  border: '1.5px solid var(--border-subtle)',
                }}
            >
              {Icon && <Icon size={15} strokeWidth={2.4} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TeacherToday() {
  const { selectedId, selected } = useSelectedClass();
  const [date, setDate] = useState(todayISO());

  const query = useApi(
    () => api.teacher.today(selectedId, { date }),
    [selectedId, date],
    { skip: !selectedId }
  );

  return (
    <AsyncSection query={query} rows={6}>
      {(data) => (
        <CheckOffScreen
          data={data}
          date={date}
          onDateChange={setDate}
          onSaved={query.reload}
          className={selected?.name}
        />
      )}
    </AsyncSection>
  );
}

function CheckOffScreen({ data, date, onDateChange, onSaved, className }) {
  const { suggestedTopic, existingLog, coverage, memorizationStandard, progress, roster, recentHandovers } = data;

  // The form starts either from the saved log for this date, or from the
  // curriculum standard that is due next.
  const [topicId, setTopicId] = useState(null);
  const [sessionType, setSessionType] = useState('standard_lesson');
  const [status, setStatus] = useState('completed');
  const [mastery, setMastery] = useState('secure');
  const [topicCovered, setTopicCovered] = useState('');
  const [memorization, setMemorization] = useState('');
  const [notes, setNotes] = useState('');
  const [handover, setHandover] = useState('');
  const [editing, setEditing] = useState(false);

  const defaultMemorization = memorizationStandard
    ? `${memorizationStandard.surah} • ${memorizationStandard.names_of_allah}`
    : '';

  // Reset the form whenever the class or date changes.
  useEffect(() => {
    if (existingLog) {
      setTopicId(existingLog.topic_id);
      setSessionType(existingLog.session_type);
      setStatus(existingLog.status);
      setMastery(existingLog.class_mastery);
      setTopicCovered(existingLog.topic_covered);
      setMemorization(existingLog.memorization_covered || '');
      setNotes(existingLog.notes || '');
      setHandover(existingLog.handover_note || '');
      setEditing(false);
    } else {
      setTopicId(suggestedTopic?.id ?? null);
      setSessionType('standard_lesson');
      setStatus('completed');
      setMastery('secure');
      setTopicCovered(suggestedTopic?.topic_title || '');
      setMemorization(defaultMemorization);
      setNotes('');
      setHandover('');
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingLog?.id, suggestedTopic?.id, date, data.class.id]);

  const activeTopic = useMemo(
    () => coverage.find((t) => t.id === topicId) || suggestedTopic || null,
    [coverage, topicId, suggestedTopic]
  );

  const save = useAction(
    () => api.teacher.saveLesson({
      class_id: data.class.id,
      topic_id: topicId,
      date,
      subject: activeTopic?.subject || data.expectedSubject || 'Fiqh',
      session_type: sessionType,
      topic_covered: topicCovered.trim(),
      expected_indicator: activeTopic?.expected_indicator || '',
      memorization_covered: memorization.trim(),
      status,
      class_mastery: mastery,
      notes: notes.trim(),
      handover_note: handover.trim(),
    }),
    {
      onSuccess: (result) => {
        toast(result.created ? 'Lesson recorded — jazākum Allāhu khayran' : 'Lesson log updated');
        setEditing(false);
        onSaved();
      },
    }
  );

  const attendanceTaken = roster.filter((s) => s.attendance_status).length;
  const isToday = date === todayISO();

  return (
    <>
      <PageHeader
        eyebrow={`${data.term.title} · ${data.dayName}`}
        title={isToday ? "Today's lesson" : `Daily log for ${mediumDate(date)}`}
        description={
          data.expectedSubject
            ? `${longDate(date)} — today's subject for ${className} is ${data.expectedSubject}.`
            : `${longDate(date)} is not a teaching day, but you can still record a session.`
        }
        actions={(
          <Field label="" className="w-40">
            <Input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(event) => onDateChange(event.target.value)}
              aria-label="Choose a date"
            />
          </Field>
        )}
      />

      {/* Saved state — the common case on a second visit */}
      {existingLog && !editing && (
        <Alert
          tone="ok"
          title={`${data.expectedSubject || existingLog.subject} recorded for ${mediumDate(date)}`}
          className="mb-4"
          action={<Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => setEditing(true)}>Change</Button>}
        >
          <p className="term">{existingLog.topic_covered}</p>
          <p className="mt-0.5 text-[0.78rem] opacity-85">
            {SESSION_TYPES[existingLog.session_type]} · class judged{' '}
            {MASTERY[existingLog.class_mastery]?.label.toLowerCase()} · logged by {existingLog.teacher_name}
          </p>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* The form */}
          <Card>
            <SectionHeading
              title={existingLog && !editing ? 'Recorded lesson' : 'Record the lesson'}
              description={
                existingLog && !editing
                  ? undefined
                  : 'Pre-filled from the curriculum — change only what differs from the plan.'
              }
            />

            {/* The standard being taught */}
            {activeTopic ? (
              <div
                className="mb-4 rounded-xl px-3.5 py-3"
                style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}
              >
                <p className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className="text-[0.68rem] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    {activeTopic.subject} · standard due
                  </span>
                  <Badge tone={COVERAGE_STATE[activeTopic.state]?.tone || 'neutral'} size="sm">
                    {COVERAGE_STATE[activeTopic.state]?.label}
                  </Badge>
                </p>
                <p className="term text-[0.88rem] font-semibold" style={{ color: 'var(--accent-text)' }}>
                  {activeTopic.topic_title}
                </p>
                <p className="term mt-1 text-[0.79rem]" style={{ color: 'var(--accent-text)', opacity: 0.85 }}>
                  Expected by end of term: {activeTopic.expected_indicator}
                </p>
              </div>
            ) : (
              <Alert tone="info" className="mb-4">
                Every standard for this term has been achieved. Log a revision or oral testing session below.
              </Alert>
            )}

            <fieldset
              disabled={Boolean(existingLog) && !editing}
              className={cx('space-y-4', existingLog && !editing && 'opacity-60')}
            >
              <ChoiceRow
                label="What kind of session?"
                options={SESSION_OPTIONS}
                value={sessionType}
                onChange={setSessionType}
              />

              <ChoiceRow
                label="Was it taught?"
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                columns="grid-cols-1 sm:grid-cols-3"
              />

              <ChoiceRow
                label="How did the class do?"
                hint="This is what marks the standard achieved."
                options={MASTERY_ORDER.map((level) => ({
                  value: level,
                  label: MASTERY[level].label,
                  tone: MASTERY[level].tone,
                }))}
                value={mastery}
                onChange={setMastery}
              />

              <Field
                label="Topic covered"
                required
                hint="Pre-filled from the syllabus. Adjust if you taught something different."
              >
                <Textarea
                  value={topicCovered}
                  onChange={(e) => setTopicCovered(e.target.value)}
                  rows={2}
                  className="term"
                />
              </Field>

              <Field label="Memorization covered" hint="The opening track — Sūrah, Duʿā' and Names of Allāh.">
                <Input value={memorization} onChange={(e) => setMemorization(e.target.value)} className="term" />
              </Field>

              <Disclosure summary="Add notes or a handover for a substitute (optional)">
                <div className="space-y-3 pt-1">
                  <Field label="Lesson notes" hint="Anything worth remembering about how the class went.">
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </Field>
                  <Field
                    label="Handover note"
                    hint="Shown prominently to whoever teaches this class next — use it when you will be away."
                  >
                    <Textarea value={handover} onChange={(e) => setHandover(e.target.value)} rows={2} />
                  </Field>
                </div>
              </Disclosure>
            </fieldset>

            {save.error && <Alert tone="risk" className="mt-4">{save.error.message}</Alert>}

            {(!existingLog || editing) && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  busy={save.busy}
                  disabled={!topicCovered.trim()}
                  icon={<ClipboardCheck size={17} />}
                  onClick={() => save.run().catch(() => {})}
                >
                  {existingLog ? 'Update the record' : 'Save the daily log'}
                </Button>
                {existingLog && (
                  <Button variant="ghost" onClick={() => setEditing(false)} disabled={save.busy}>Cancel</Button>
                )}
              </div>
            )}
          </Card>

          <OfficeNotices />

          {/* Notes for the next teacher left by others */}
          {recentHandovers.length > 0 && (
            <Card>
              <SectionHeading
                title="Notes for the next teacher"
                description="Left by whoever last covered this class."
              />
              <ul className="space-y-2">
                {recentHandovers.map((note, index) => (
                  <li
                    key={`${note.date}-${index}`}
                    className="rounded-lg px-3 py-2.5"
                    style={{ background: 'var(--warn-soft)' }}
                  >
                    <p className="mb-0.5 text-[0.73rem] font-semibold" style={{ color: 'var(--warn-ink)' }}>
                      {mediumDate(note.date)} · {note.subject} · {note.teacher_name}
                    </p>
                    <p className="text-[0.82rem]" style={{ color: 'var(--warn-ink)' }}>{note.handover_note}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <Card>
            <SectionHeading title="Where the class stands" />
            <PacingBar
              value={progress.progressPercent}
              expected={progress.expectedPercent}
              label="Term progress"
              height={10}
            />
            <div className="mt-3 space-y-1.5 text-[0.8rem]">
              <p className="flex justify-between gap-3">
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <Badge tone={PACING[progress.pacingStatus].tone} size="sm">
                  {PACING[progress.pacingStatus].label}
                </Badge>
              </p>
              <p className="flex justify-between gap-3">
                <span style={{ color: 'var(--text-muted)' }}>Standards achieved</span>
                <span className="num font-semibold" style={{ color: 'var(--text-strong)' }}>
                  {progress.coveredCount} of {progress.requiredCount}
                </span>
              </p>
              <p className="flex justify-between gap-3">
                <span style={{ color: 'var(--text-muted)' }}>Expected by today</span>
                <span className="num font-semibold" style={{ color: 'var(--text-strong)' }}>
                  {progress.expectedPercent}%
                </span>
              </p>
            </div>
            <Button as={Link} to="/teacher/roster?tab=syllabus" variant="ghost" size="sm" className="mt-3" icon={<ChevronRight size={14} />}>
              Full syllabus coverage
            </Button>
          </Card>

          <Card>
            <SectionHeading title="Attendance" description={`${data.class.student_count} students in this class.`} />
            {attendanceTaken > 0 ? (
              <Alert tone="ok">
                Attendance recorded for {attendanceTaken} of {roster.length} students on {mediumDate(date)}.
              </Alert>
            ) : (
              <Alert tone="warn">No attendance has been taken for {mediumDate(date)} yet.</Alert>
            )}
            <Button
              as={Link}
              to="/teacher/attendance"
              variant={attendanceTaken > 0 ? 'secondary' : 'primary'}
              className="mt-3 w-full"
              icon={<UserCheck size={15} />}
            >
              {attendanceTaken > 0 ? 'Review the attendance' : 'Take the attendance'}
            </Button>
          </Card>

          {memorizationStandard && (
            <Card>
              <SectionHeading title="Memorization target" description={`${data.term.title}, Grade ${data.class.grade}.`} />
              <dl className="term space-y-2 text-[0.82rem]">
                {[
                  ['Sūrah', memorizationStandard.surah],
                  ["Duʿā'", memorizationStandard.dua],
                  ['Names of Allāh', memorizationStandard.names_of_allah],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      {label}
                    </dt>
                    <dd style={{ color: 'var(--text-body)' }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          <Card>
            <div className="flex items-start gap-2.5">
              <Info size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <p className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                A subject counts as achieved once you record it as taught in full and judge the class
                <em> secure</em> or <em>mastered</em>. Until then it shows as being taught, which still
                counts towards your pacing.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/**
 * Notices from the office, on the screen a teacher opens every day. They used
 * to have their own nav item, which meant nobody read them.
 */
function OfficeNotices() {
  const query = useApi(() => api.announcements({ limit: 3 }), []);
  const notices = query.data?.announcements || [];
  if (!notices.length) return null;

  return (
    <Card>
      <SectionHeading
        title="From the office"
        description="The most recent notices for staff and for your class."
        action={(
          <Button as={Link} to="/teacher/notices" variant="ghost" size="sm">All notices</Button>
        )}
      />
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
    </Card>
  );
}
