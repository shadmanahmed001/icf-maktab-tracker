/**
 * One student, as their teacher works with them: record progress per subject,
 * verify memorization, and message the family — all without leaving the page.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import {
  Alert, AsyncSection, Button, Card, DataRow, Field, Modal, PageHeader,
  SectionHeading, Select, Textarea, toast,
} from '../../ui';
import {
  AssessmentTable, AttendanceRecordList, AttendanceSummaryCard,
  MasteryScaleLegend, MemorizationPanel, OverallProgress,
} from '../../features/progress';
import { MASTERY, MASTERY_ORDER, MEMORIZATION_ITEM, mediumDate } from '../../lib/format';

const SUBJECTS = ['Fiqh', 'Aḥādīth', 'Sīrah', 'Tārīkh', "ʿAqā'id", 'Akhlāq', 'Ādāb'];

export default function TeacherStudentDetail() {
  const { studentId } = useParams();
  const query = useApi(() => api.teacher.student(studentId), [studentId]);

  const [assessing, setAssessing] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [messaging, setMessaging] = useState(null);

  return (
    <>
      <Button as={Link} to="/teacher/roster" variant="ghost" size="sm" icon={<ArrowLeft size={15} />} className="mb-3">
        Back to the class list
      </Button>

      <AsyncSection query={query} rows={6}>
        {(data) => {
          const { student, term, assessments, memorization, memorizationStandard, attendance, overall, guardians, attendanceRecent } = data;
          const assessedSubjects = new Set(assessments.map((a) => a.subject));

          return (
            <>
              <PageHeader
                eyebrow={`${student.student_code} · ${term.title}`}
                title={`${student.first_name} ${student.last_name}`}
                description={[
                  student.class_name,
                  student.date_of_birth ? `Born ${mediumDate(student.date_of_birth)}` : null,
                ].filter(Boolean).join(' · ')}
                actions={guardians.length > 0 && (
                  <Button
                    variant="secondary"
                    icon={<MessageSquare size={15} />}
                    onClick={() => setMessaging({ student, guardians })}
                  >
                    Message the family
                  </Button>
                )}
              />

              {student.notes && (
                <Alert tone="warn" title="Note from the office" className="mb-4">{student.notes}</Alert>
              )}

              <div className="grid gap-5 lg:grid-cols-3">
                <Card>
                  <SectionHeading title="Overall progress" />
                  <OverallProgress overall={overall} />
                </Card>

                <Card className="lg:col-span-2">
                  <SectionHeading
                    title="Progress by subject"
                    description="Your judgment for this term. Tap a subject to record or change it."
                    action={<MasteryScaleLegend />}
                  />
                  <AssessmentTable
                    assessments={assessments}
                    onEdit={(row) => setAssessing({ ...row, term_number: term.term_number })}
                    emptyHint="Record your first judgment using the buttons below."
                  />

                  <div className="mt-4">
                    <p className="mb-2 text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>
                      Record a subject
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECTS.map((subject) => (
                        <Button
                          key={subject}
                          size="sm"
                          variant={assessedSubjects.has(subject) ? 'ghost' : 'soft'}
                          className="term"
                          onClick={() => setAssessing({
                            subject,
                            term_number: term.term_number,
                            mastery_level: 'secure',
                            comment: '',
                          })}
                        >
                          {subject}
                          {assessedSubjects.has(subject) ? ' ✓' : ''}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <Card>
                  <SectionHeading
                    title="Memorization"
                    description={`Target for ${term.title}. Tap to record what you have heard.`}
                  />
                  <MemorizationPanel
                    progress={memorization}
                    standard={memorizationStandard}
                    onEdit={(type, record, label) => setVerifying({
                      item_type: type,
                      item_label: record?.item_label || label || '',
                      status: record?.status || 'in_progress',
                      term_number: term.term_number,
                    })}
                  />
                </Card>

                <AttendanceSummaryCard summary={attendance} title="Attendance this term" />
              </div>

              <Card className="mt-5">
                <SectionHeading title="Guardians" />
                {guardians.length === 0 ? (
                  <p className="text-[0.82rem]" style={{ color: 'var(--warn-ink)' }}>
                    No guardian is linked to this student — ask the office to link the family.
                  </p>
                ) : (
                  <dl>
                    {guardians.map((g) => (
                      <DataRow key={g.id} label={`${g.full_name} (${g.relationship})`}>
                        {g.email}{g.phone ? ` · ${g.phone}` : ''}
                      </DataRow>
                    ))}
                  </dl>
                )}
              </Card>

              <Card className="mt-5">
                <SectionHeading title="Recent attendance" />
                <AttendanceRecordList records={attendanceRecent} />
              </Card>

              {assessing && (
                <AssessmentDialog
                  studentId={student.id}
                  value={assessing}
                  onChange={setAssessing}
                  onClose={() => setAssessing(null)}
                  onSaved={() => { setAssessing(null); query.reload(); }}
                />
              )}

              {verifying && (
                <MemorizationDialog
                  studentId={student.id}
                  value={verifying}
                  onChange={setVerifying}
                  onClose={() => setVerifying(null)}
                  onSaved={() => { setVerifying(null); query.reload(); }}
                />
              )}

              {messaging && (
                <MessageDialog
                  target={messaging}
                  onClose={() => setMessaging(null)}
                />
              )}
            </>
          );
        }}
      </AsyncSection>
    </>
  );
}

function AssessmentDialog({ studentId, value, onChange, onClose, onSaved }) {
  const save = useAction(
    () => api.teacher.saveAssessment(studentId, {
      term_number: value.term_number,
      subject: value.subject,
      mastery_level: value.mastery_level,
      comment: value.comment || '',
    }),
    { onSuccess: () => { toast(`${value.subject} recorded`); onSaved(); } }
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={value.subject}
      description="Your judgment of where this student stands on this subject for the term."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.busy}>Cancel</Button>
          <Button variant="primary" busy={save.busy} onClick={() => save.run().catch(() => {})}>Save</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>Progress</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MASTERY_ORDER.map((level) => {
              const active = value.mastery_level === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChange({ ...value, mastery_level: level })}
                  className="rounded-lg px-2 py-2.5 text-[0.79rem] font-semibold"
                  style={active
                    ? {
                      background: `var(--${MASTERY[level].tone}-soft)`,
                      color: `var(--${MASTERY[level].tone}-ink)`,
                      border: `1.5px solid var(--${MASTERY[level].tone})`,
                    }
                    : { background: 'var(--surface-card)', color: 'var(--text-body)', border: '1.5px solid var(--border-subtle)' }}
                >
                  {MASTERY[level].label}
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label="Comment for the family"
          hint="This appears on the term report card, so write it for the parent to read."
        >
          <Textarea
            value={value.comment || ''}
            onChange={(e) => onChange({ ...value, comment: e.target.value })}
            rows={3}
          />
        </Field>

        {save.error && <Alert tone="risk">{save.error.message}</Alert>}
      </div>
    </Modal>
  );
}

function MemorizationDialog({ studentId, value, onChange, onClose, onSaved }) {
  const save = useAction(
    () => api.teacher.saveMemorization(studentId, {
      term_number: value.term_number,
      item_type: value.item_type,
      item_label: value.item_label,
      status: value.status,
    }),
    { onSuccess: () => { toast('Memorization progress recorded'); onSaved(); } }
  );

  const OPTIONS = [
    { value: 'not_started', label: 'Not started', tone: 'neutral' },
    { value: 'in_progress', label: 'In progress', tone: 'warn' },
    { value: 'mastered', label: 'Mastered', tone: 'ok' },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={MEMORIZATION_ITEM[value.item_type]}
      description="Marking an item mastered stamps today's date as the verification."
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.busy}>Cancel</Button>
          <Button variant="primary" busy={save.busy} onClick={() => save.run().catch(() => {})}>Save</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label="Item" hint="Defaults to this term's target for the grade.">
          <Textarea
            value={value.item_label}
            onChange={(e) => onChange({ ...value, item_label: e.target.value })}
            rows={2}
            className="term"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>Progress</p>
          <div className="grid grid-cols-3 gap-2">
            {OPTIONS.map((option) => {
              const active = value.status === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...value, status: option.value })}
                  className="rounded-lg px-2 py-2.5 text-[0.78rem] font-semibold"
                  style={active
                    ? {
                      background: `var(--${option.tone}-soft)`,
                      color: `var(--${option.tone}-ink)`,
                      border: `1.5px solid var(--${option.tone})`,
                    }
                    : { background: 'var(--surface-card)', color: 'var(--text-body)', border: '1.5px solid var(--border-subtle)' }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {save.error && <Alert tone="risk">{save.error.message}</Alert>}
      </div>
    </Modal>
  );
}

function MessageDialog({ target, onClose }) {
  const [parentId, setParentId] = useState(target.guardians[0]?.id ?? '');
  const [subject, setSubject] = useState('Term 1 progress');
  const [body, setBody] = useState('');

  const send = useAction(
    () => api.teacher.startThread({
      student_id: target.student.id,
      parent_id: Number(parentId),
      subject,
      body: body.trim(),
    }),
    { onSuccess: () => { toast('Message sent'); onClose(); } }
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Message about ${target.student.first_name}`}
      description="Replies arrive in your Parent messages inbox."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={send.busy}>Cancel</Button>
          <Button
            variant="primary"
            busy={send.busy}
            disabled={!body.trim() || !parentId}
            icon={<Send size={15} />}
            onClick={() => send.run().catch(() => {})}
          >
            Send
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label="Send to" required>
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            {target.guardians.map((g) => (
              <option key={g.id} value={g.id}>{g.full_name} ({g.relationship})</option>
            ))}
          </Select>
        </Field>
        <Field label="Subject">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option>Term 1 progress</option>
            <option>Memorization at home</option>
            <option>Attendance</option>
            <option>Homework</option>
            <option>General</option>
          </Select>
        </Field>
        <Field label="Message" required>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
        </Field>
        {send.error && <Alert tone="risk">{send.error.message}</Alert>}
      </div>
    </Modal>
  );
}
