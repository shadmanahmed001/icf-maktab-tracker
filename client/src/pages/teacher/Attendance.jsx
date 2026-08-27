/**
 * The register. Optimised for speed: every pupil defaults to present, so a
 * normal day is "mark the two absences and save". A row of tap targets per
 * pupil beats a dropdown on a phone.
 */
import { useEffect, useState } from 'react';
import { Check, Clock, X, ShieldQuestion, Save, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import { useSelectedClass } from '../../layout/portals';
import {
  Alert, AsyncSection, Badge, Button, Card, EmptyState, Field, Input, Modal,
  PageHeader, SectionHeading, toast, cx,
} from '../../ui';
import { AttendanceSummaryCard } from '../../features/progress';
import { ColumnChart } from '../../charts';
import { mediumDate, todayISO } from '../../lib/format';

const STATUSES = [
  { value: 'present', label: 'Present', icon: Check, tone: 'ok' },
  { value: 'late', label: 'Late', icon: Clock, tone: 'warn' },
  { value: 'absent', label: 'Absent', icon: X, tone: 'risk' },
  { value: 'excused', label: 'Excused', icon: ShieldQuestion, tone: 'info' },
];

export default function TeacherAttendance() {
  const { selectedId, selected } = useSelectedClass();
  const [date, setDate] = useState(todayISO());

  const query = useApi(
    () => api.teacher.attendance(selectedId, { date }),
    [selectedId, date],
    { skip: !selectedId }
  );

  return (
    <>
      <PageHeader
        eyebrow={selected?.name}
        title="Attendance"
        description="Everyone starts as present — mark only the exceptions, then save."
        actions={(
          <Field label="" className="w-40">
            <Input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Register date"
            />
          </Field>
        )}
      />

      <AsyncSection query={query} rows={6}>
        {(data) => (
          <RegisterScreen
            key={`${selectedId}-${date}`}
            data={data}
            classId={selectedId}
            date={date}
            onSaved={query.reload}
          />
        )}
      </AsyncSection>
    </>
  );
}

function RegisterScreen({ data, classId, date, onSaved }) {
  const { roster, summary, history } = data;

  // Local draft: pupils with no record default to present.
  const [draft, setDraft] = useState({});
  const [noteFor, setNoteFor] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const initial = {};
    for (const student of roster) {
      initial[student.id] = {
        status: student.status || 'present',
        minutes_late: student.minutes_late || 0,
        note: student.note || '',
      };
    }
    setDraft(initial);
    setDirty(false);
  }, [roster]);

  const alreadyRecorded = roster.some((s) => s.status);

  const setStatus = (studentId, status) => {
    setDraft((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        status,
        minutes_late: status === 'late' ? (current[studentId]?.minutes_late || 10) : 0,
      },
    }));
    setDirty(true);
  };

  const markAllPresent = () => {
    setDraft((current) => {
      const next = {};
      for (const id of Object.keys(current)) {
        next[id] = { ...current[id], status: 'present', minutes_late: 0 };
      }
      return next;
    });
    setDirty(true);
  };

  const save = useAction(
    () => api.teacher.saveAttendance(classId, {
      date,
      entries: roster.map((student) => ({
        student_id: student.id,
        status: draft[student.id]?.status || 'present',
        minutes_late: draft[student.id]?.minutes_late || 0,
        note: draft[student.id]?.note || '',
      })),
    }),
    {
      onSuccess: () => { toast('Register saved'); setDirty(false); onSaved(); },
    }
  );

  const counts = STATUSES.reduce((acc, s) => {
    acc[s.value] = Object.values(draft).filter((d) => d.status === s.value).length;
    return acc;
  }, {});

  if (roster.length === 0) {
    return <EmptyState title="No pupils in this class" description="Ask the office to enrol pupils into this class." />;
  }

  return (
    <>
      {/* Sticky action bar — the save button must never be hunted for */}
      <div
        className="sticky top-16 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3"
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <span className="flex flex-wrap gap-1.5">
          {STATUSES.map((status) => (
            <Badge key={status.value} tone={status.tone} size="sm">
              {counts[status.value]} {status.label.toLowerCase()}
            </Badge>
          ))}
        </span>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" icon={<Users size={14} />} onClick={markAllPresent}>
          All present
        </Button>
        <Button
          variant="primary"
          busy={save.busy}
          disabled={!dirty && alreadyRecorded}
          icon={<Save size={15} />}
          onClick={() => save.run().catch(() => {})}
        >
          {alreadyRecorded ? 'Save changes' : 'Save register'}
        </Button>
      </div>

      {save.error && <Alert tone="risk" className="mb-4">{save.error.message}</Alert>}
      {alreadyRecorded && !dirty && (
        <Alert tone="ok" className="mb-4">
          The register for {mediumDate(date)} is saved. Change any pupil below to correct it.
        </Alert>
      )}

      <Card padded={false} className="mb-5">
        <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {roster.map((student) => {
            const entry = draft[student.id] || { status: 'present' };
            return (
              <li key={student.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 sm:px-4">
                <div className="min-w-40 flex-1">
                  <p className="text-[0.87rem] font-medium" style={{ color: 'var(--text-strong)' }}>
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="num text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>
                    {student.student_code}
                    {entry.status === 'late' && entry.minutes_late ? ` · ${entry.minutes_late} min late` : ''}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </p>
                </div>

                <div className="flex gap-1.5" role="radiogroup" aria-label={`Attendance for ${student.first_name}`}>
                  {STATUSES.map((status) => {
                    const Icon = status.icon;
                    const active = entry.status === status.value;
                    return (
                      <button
                        key={status.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={status.label}
                        onClick={() => setStatus(student.id, status.value)}
                        className={cx(
                          'inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[0.74rem] font-semibold transition-colors',
                        )}
                        style={active
                          ? {
                            background: `var(--${status.tone}-soft)`,
                            color: `var(--${status.tone}-ink)`,
                            border: `1.5px solid var(--${status.tone})`,
                          }
                          : {
                            background: 'var(--surface-sunken)',
                            color: 'var(--text-muted)',
                            border: '1.5px solid transparent',
                          }}
                      >
                        <Icon size={14} strokeWidth={2.6} />
                        <span className="hidden sm:inline">{status.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setNoteFor(student)}
                    className="inline-flex h-9 items-center rounded-lg px-2 text-[0.74rem] font-semibold"
                    style={{ color: 'var(--accent-text)', background: 'var(--surface-sunken)' }}
                    title={`Add a note for ${student.first_name}`}
                  >
                    Note
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <AttendanceSummaryCard summary={summary} title="This term so far" />

        <Card>
          <SectionHeading title="Recent sessions" description="Present and late counts per session." />
          <ColumnChart
            data={[...history].reverse().map((row) => ({
              label: mediumDate(row.date),
              shortLabel: mediumDate(row.date).split(' ')[1],
              value: row.present + row.late,
              detail: row,
            }))}
            formatTooltip={(entry) => `${entry.label}: ${entry.detail.present} present, ${entry.detail.late} late, ${entry.detail.absent} absent`}
            tone="accent"
          />
        </Card>
      </div>

      {noteFor && (
        <NoteDialog
          student={noteFor}
          entry={draft[noteFor.id]}
          onClose={() => setNoteFor(null)}
          onSave={(patch) => {
            setDraft((current) => ({ ...current, [noteFor.id]: { ...current[noteFor.id], ...patch } }));
            setDirty(true);
            setNoteFor(null);
          }}
        />
      )}
    </>
  );
}

function NoteDialog({ student, entry, onClose, onSave }) {
  const [note, setNote] = useState(entry?.note || '');
  const [minutes, setMinutes] = useState(entry?.minutes_late || 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={`${student.first_name} ${student.last_name}`}
      description="Notes are visible to the office and to this pupil's guardians."
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave({ note: note.trim(), minutes_late: Number(minutes) || 0 })}>
            Apply
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        {entry?.status === 'late' && (
          <Field label="Minutes late">
            <Input type="number" min="0" max="240" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
        )}
        <Field label="Note" hint="For example, “Parent called ahead — family travel”.">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
