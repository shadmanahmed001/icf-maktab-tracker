/** The student list: enrol, edit, move between classes, link guardians. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, UserMinus, Link2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi, useDebounced } from '../../lib/hooks';
import {
  Alert, AsyncSection, Badge, Button, Card, ConfirmDialog, Field, IconButton, Input,
  Modal, PageHeader, SearchInput, Select, Table, TableWrap, Td, Th, Tr, toast, EmptyState,
} from '../../ui';
import { mediumDate } from '../../lib/format';

const BLANK = {
  first_name: '', last_name: '', class_id: '', gender: 'male',
  date_of_birth: '', enrolled_on: '', notes: '',
};

export default function AdminStudents() {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const debounced = useDebounced(search, 250);

  const classes = useApi(() => api.admin.classes(), []);
  const students = useApi(
    () => api.admin.students({ q: debounced || undefined, class_id: classFilter || undefined }),
    [debounced, classFilter]
  );
  const parents = useApi(() => api.admin.users({ role: 'parent' }), []);

  const [editing, setEditing] = useState(null);
  const [linking, setLinking] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);

  const save = useAction(
    (payload) => (payload.id ? api.admin.updateStudent(payload.id, payload) : api.admin.createStudent(payload)),
    {
      onSuccess: () => { toast(editing?.id ? 'Student updated' : 'Student enrolled'); setEditing(null); students.reload(); },
    }
  );

  const withdraw = useAction((id) => api.admin.withdrawStudent(id), {
    onSuccess: () => { toast('Student withdrawn'); setWithdrawing(null); students.reload(); },
  });

  const classOptions = (classes.data || []).filter((c) => c.is_active);

  return (
    <>
      <PageHeader
        eyebrow="School structure"
        title="Students"
        description="The maktab class list. Withdrawing a student keeps their academic record for reference."
        actions={(
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing({ ...BLANK })}>
            Enrol student
          </Button>
        )}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or student code…"
          className="w-full max-w-xs"
        />
        <Select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="max-w-48"
          aria-label="Filter by class"
        >
          <option value="">All classes</option>
          {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <AsyncSection query={students} rows={6}>
        {(rows) => (rows.length === 0 ? (
          <EmptyState
            title="No students match"
            description="Try a different search, or enrol a new student."
            action={<Button variant="primary" onClick={() => setEditing({ ...BLANK })}>Enrol student</Button>}
          />
        ) : (
          <Card padded={false}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>
                {rows.length} {rows.length === 1 ? 'student' : 'students'}
              </p>
            </div>
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Code</Th>
                    <Th>Class</Th>
                    <Th>Guardians</Th>
                    <Th align="right">Enrolled</Th>
                    <Th align="right">Manage</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((student) => (
                    <Tr key={student.id}>
                      <Td>
                        <Link
                          to={`/admin/students/${student.id}`}
                          className="font-semibold hover:underline"
                          style={{ color: 'var(--text-strong)' }}
                        >
                          {student.first_name} {student.last_name}
                        </Link>
                      </Td>
                      <Td className="num text-[0.76rem]">{student.student_code}</Td>
                      <Td>{student.class_name || <span style={{ color: 'var(--warn-ink)' }}>Unassigned</span>}</Td>
                      <Td className="max-w-64">
                        {student.guardians.length === 0
                          ? <span style={{ color: 'var(--warn-ink)' }}>None linked</span>
                          : (
                            <span className="flex flex-wrap gap-1">
                              {student.guardians.map((g) => (
                                <Badge key={g.id} tone={g.is_primary ? 'accent' : 'neutral'} size="sm">
                                  {g.full_name}
                                </Badge>
                              ))}
                            </span>
                          )}
                      </Td>
                      <Td align="right" className="whitespace-nowrap text-[0.76rem]">
                        {mediumDate(student.enrolled_on)}
                      </Td>
                      <Td align="right">
                        <span className="flex justify-end gap-0.5">
                          <IconButton label="Link a guardian" onClick={() => setLinking(student)}>
                            <Link2 size={16} />
                          </IconButton>
                          <IconButton label="Edit student" onClick={() => setEditing(student)}>
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton label="Withdraw student" onClick={() => setWithdrawing(student)}>
                            <UserMinus size={16} />
                          </IconButton>
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        ))}
      </AsyncSection>

      {editing && (
        <StudentForm
          value={editing}
          classes={classOptions}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={(payload) => save.run(payload).catch(() => {})}
          busy={save.busy}
          error={save.error?.message}
        />
      )}

      {linking && (
        <GuardianDialog
          student={linking}
          parents={parents.data || []}
          onClose={() => setLinking(null)}
          onChanged={() => { students.reload(); parents.reload(); }}
        />
      )}

      <ConfirmDialog
        open={Boolean(withdrawing)}
        onClose={() => setWithdrawing(null)}
        onConfirm={() => withdraw.run(withdrawing.id)}
        title={`Withdraw ${withdrawing?.first_name} ${withdrawing?.last_name}?`}
        confirmLabel="Withdraw"
        busy={withdraw.busy}
      >
        They will no longer appear on attendance records or in teacher portals. Their attendance,
        assessments and reports are kept on file.
      </ConfirmDialog>
    </>
  );
}

function StudentForm({ value, classes, onChange, onClose, onSave, busy, error }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const valid = value.first_name?.trim() && value.last_name?.trim();

  return (
    <Modal
      open
      onClose={onClose}
      title={value.id ? `Edit ${value.first_name} ${value.last_name}` : 'Enrol a student'}
      description={value.id ? undefined : 'A student code is generated automatically.'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={!valid}
            onClick={() => onSave({
              ...value,
              class_id: value.class_id ? Number(value.class_id) : null,
              date_of_birth: value.date_of_birth || null,
              enrolled_on: value.enrolled_on || null,
            })}
          >
            {value.id ? 'Save changes' : 'Enrol'}
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required>
            <Input value={value.first_name} onChange={set('first_name')} />
          </Field>
          <Field label="Family name" required>
            <Input value={value.last_name} onChange={set('last_name')} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Class">
            <Select value={value.class_id ?? ''} onChange={set('class_id')}>
              <option value="">Not assigned</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Gender">
            <Select value={value.gender || ''} onChange={set('gender')}>
              <option value="">Not recorded</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date of birth">
            <Input type="date" value={value.date_of_birth || ''} onChange={set('date_of_birth')} />
          </Field>
          <Field label="Enrolled on">
            <Input type="date" value={value.enrolled_on || ''} onChange={set('enrolled_on')} />
          </Field>
        </div>
        <Field label="Notes" hint="Anything a teacher or substitute should know — kept internal to staff.">
          <Input value={value.notes || ''} onChange={set('notes')} />
        </Field>
        {error && <Alert tone="risk">{error}</Alert>}
      </div>
    </Modal>
  );
}

function GuardianDialog({ student, parents, onClose, onChanged }) {
  const [userId, setUserId] = useState('');
  const [relationship, setRelationship] = useState('father');
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState(null);

  const link = useAction(
    () => api.admin.linkGuardian(student.id, {
      user_id: Number(userId), relationship, is_primary: isPrimary,
    }),
    {
      onSuccess: () => { toast('Guardian linked'); setUserId(''); onChanged(); onClose(); },
      onError: (err) => setError(err.message),
    }
  );
  const unlink = useAction((id) => api.admin.unlinkGuardian(student.id, id), {
    onSuccess: () => { toast('Guardian unlinked'); onChanged(); },
  });

  const candidates = useMemo(() => {
    const linkedIds = new Set(student.guardians.map((g) => g.id));
    return parents.filter((p) => !linkedIds.has(p.id));
  }, [parents, student.guardians]);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Guardians for ${student.first_name} ${student.last_name}`}
      description="A linked guardian can see this child's progress in the family portal."
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4">
        {student.guardians.length > 0 && (
          <ul className="space-y-1.5">
            {student.guardians.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                style={{ background: 'var(--surface-sunken)' }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.83rem] font-medium" style={{ color: 'var(--text-strong)' }}>
                    {g.full_name}
                  </span>
                  <span className="block truncate text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>
                    {g.email}{g.phone ? ` · ${g.phone}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={g.is_primary ? 'accent' : 'neutral'} size="sm">{g.relationship}</Badge>
                  <IconButton label={`Unlink ${g.full_name}`} onClick={() => unlink.run(g.id)}>×</IconButton>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.9rem' }}>
          <Field label="Parent account" hint="Only accounts with the parent role appear here.">
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Choose an account…</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Relationship">
              <Select value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="grandparent">Grandparent</option>
              </Select>
            </Field>
            <Field label="Primary contact">
              <Select value={isPrimary ? '1' : '0'} onChange={(e) => setIsPrimary(e.target.value === '1')}>
                <option value="0">No</option>
                <option value="1">Yes</option>
              </Select>
            </Field>
          </div>
          {error && <Alert tone="risk">{error}</Alert>}
          <Button variant="primary" disabled={!userId} busy={link.busy} onClick={() => link.run().catch(() => {})}>
            Link guardian
          </Button>
        </div>
      </div>
    </Modal>
  );
}
