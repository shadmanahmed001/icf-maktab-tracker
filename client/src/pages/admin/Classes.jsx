/** Class register: create, edit, staff and archive the twelve maktab classes. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Archive, UserPlus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import {
  Alert, AsyncSection, Badge, Button, Card, ConfirmDialog, Field, IconButton, Input,
  Modal, PageHeader, SearchInput, SegmentedControl, Select, Table, TableWrap,
  Td, Th, Tr, toast,
} from '../../ui';
import { GENDER_TRACK, mediumDate } from '../../lib/format';

const BLANK = { name: '', grade: 1, gender_track: 'boys', room: '', academic_year: '2026-2027' };

export default function AdminClasses() {
  const classes = useApi(() => api.admin.classes(), []);
  const teachers = useApi(() => api.admin.users({ role: 'teacher' }), []);

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [staffing, setStaffing] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [error, setError] = useState(null);

  const save = useAction(
    (payload) => (payload.id ? api.admin.updateClass(payload.id, payload) : api.admin.createClass(payload)),
    {
      onSuccess: () => {
        toast(editing?.id ? 'Class updated' : 'Class created');
        setEditing(null);
        classes.reload();
      },
      onError: (err) => setError(err.message),
    }
  );

  const archive = useAction((id) => api.admin.archiveClass(id), {
    onSuccess: () => { toast('Class archived'); setArchiving(null); classes.reload(); },
    onError: (err) => { setError(err.message); setArchiving(null); },
  });

  const filtered = (classes.data || []).filter((c) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return c.name.toLowerCase().includes(needle)
      || (c.room || '').toLowerCase().includes(needle)
      || c.teachers.some((t) => t.full_name.toLowerCase().includes(needle));
  });

  return (
    <>
      <PageHeader
        eyebrow="School structure"
        title="Classes"
        description="Grades 1–6, split by track. Archiving keeps every past lesson log and register intact."
        actions={(
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => { setError(null); setEditing({ ...BLANK }); }}>
            New class
          </Button>
        )}
      />

      {error && <Alert tone="risk" className="mb-4" action={<Button size="sm" variant="secondary" onClick={() => setError(null)}>Dismiss</Button>}>{error}</Alert>}

      <div className="mb-4 max-w-xs">
        <SearchInput value={search} onChange={setSearch} placeholder="Search class, room or teacher…" />
      </div>

      <AsyncSection query={classes} rows={5}>
        {() => (
          <Card padded={false}>
            <TableWrap className="rounded-xl border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Class</Th>
                    <Th>Track</Th>
                    <Th>Room</Th>
                    <Th>Teachers</Th>
                    <Th align="center">Pupils</Th>
                    <Th align="center">Logs</Th>
                    <Th align="right">Last logged</Th>
                    <Th align="right">Manage</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <Tr key={row.id} className={row.is_active ? undefined : 'opacity-55'}>
                      <Td>
                        <Link
                          to={`/admin/classes/${row.id}`}
                          className="font-semibold hover:underline"
                          style={{ color: 'var(--text-strong)' }}
                        >
                          {row.name}
                        </Link>
                        {!row.is_active && <Badge tone="neutral" size="sm" className="ml-2">Archived</Badge>}
                      </Td>
                      <Td>{GENDER_TRACK[row.gender_track]}</Td>
                      <Td>{row.room || '—'}</Td>
                      <Td className="max-w-56">
                        {row.teachers.length === 0
                          ? (
                            <Button
                              size="sm"
                              variant="soft"
                              icon={<UserPlus size={14} />}
                              onClick={() => setStaffing(row)}
                            >
                              Assign a teacher
                            </Button>
                          )
                          : (
                            <span className="flex flex-wrap gap-1">
                              {row.teachers.map((t) => (
                                <Badge key={t.id} tone={t.role === 'lead' ? 'accent' : 'neutral'} size="sm">
                                  {t.full_name}
                                </Badge>
                              ))}
                            </span>
                          )}
                      </Td>
                      <Td align="center" className="num">{row.student_count}</Td>
                      <Td align="center" className="num">{row.log_count}</Td>
                      <Td align="right" className="text-[0.76rem]">
                        {row.last_logged_date ? mediumDate(row.last_logged_date) : '—'}
                      </Td>
                      <Td align="right">
                        <span className="flex justify-end gap-0.5">
                          <IconButton label={`Assign teachers to ${row.name}`} onClick={() => setStaffing(row)}>
                            <UserPlus size={16} />
                          </IconButton>
                          <IconButton label={`Edit ${row.name}`} onClick={() => { setError(null); setEditing(row); }}>
                            <Pencil size={16} />
                          </IconButton>
                          {row.is_active && (
                            <IconButton label={`Archive ${row.name}`} onClick={() => setArchiving(row)}>
                              <Archive size={16} />
                            </IconButton>
                          )}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}
      </AsyncSection>

      <ClassForm
        value={editing}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSave={(payload) => save.run(payload).catch(() => {})}
        busy={save.busy}
        error={save.error?.message}
      />

      <StaffingDialog
        classRow={staffing}
        teachers={teachers.data || []}
        onClose={() => setStaffing(null)}
        onChanged={() => { classes.reload(); teachers.reload(); }}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() => archive.run(archiving.id)}
        title={`Archive ${archiving?.name}?`}
        confirmLabel="Archive class"
        busy={archive.busy}
      >
        The class will stop appearing in the pacing radar and teacher portals. Its lesson logs,
        registers and reports are kept. Students must be moved to another class first.
      </ConfirmDialog>
    </>
  );
}

function ClassForm({ value, onChange, onClose, onSave, busy, error }) {
  if (!value) return null;
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });

  return (
    <Modal
      open
      onClose={onClose}
      title={value.id ? `Edit ${value.name}` : 'New class'}
      description="Grade and track decide which curriculum standards apply."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="primary"
            busy={busy}
            onClick={() => onSave({
              ...value,
              grade: Number(value.grade),
            })}
            disabled={!value.name?.trim()}
          >
            {value.id ? 'Save changes' : 'Create class'}
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label="Class name" required hint="For example, “Grade 3 Girls”.">
          <Input value={value.name} onChange={set('name')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grade" required>
            <Select value={value.grade} onChange={set('grade')}>
              {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </Select>
          </Field>
          <Field label="Track" required>
            <Select value={value.gender_track} onChange={set('gender_track')}>
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
              <option value="general">Mixed</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Room">
            <Input value={value.room || ''} onChange={set('room')} placeholder="Room 105" />
          </Field>
          <Field label="Academic year">
            <Input value={value.academic_year || '2026-2027'} onChange={set('academic_year')} />
          </Field>
        </div>
        {error && <Alert tone="risk">{error}</Alert>}
      </div>
    </Modal>
  );
}

/**
 * Staffing a class.
 *
 * Assigning a teacher used to require the account to exist already, which meant
 * leaving this screen, creating it under Staff & families, and coming back. A
 * new teacher can now be created and assigned in one step, which is how an
 * administrator actually thinks about it: "put this person on Grade 3".
 */
function StaffingDialog({ classRow, teachers, onClose, onChanged }) {
  const [mode, setMode] = useState('existing');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('lead');
  const [draft, setDraft] = useState({ full_name: '', email: '', pin: '' });
  const [error, setError] = useState(null);
  const [credential, setCredential] = useState(null);

  const assignExisting = useAction(
    () => api.admin.assignTeacher(classRow.id, { user_id: Number(userId), role }),
    {
      onSuccess: () => { toast('Teacher assigned'); setUserId(''); onChanged(); },
      onError: (err) => setError(err.message),
    }
  );

  /** Create the account, then put them straight on this class. */
  const createAndAssign = useAction(
    async () => {
      const created = await api.admin.createUser({
        full_name: draft.full_name.trim(),
        email: draft.email.trim(),
        role: 'teacher',
        title: `${classRow.name} Teacher`,
        pin: draft.pin.trim() || undefined,
      });
      await api.admin.assignTeacher(classRow.id, { user_id: created.user.id, role });
      return created;
    },
    {
      onSuccess: (created) => {
        toast(`${created.user.full_name} added to ${classRow.name}`);
        setCredential({
          name: created.user.full_name,
          email: created.user.email,
          password: created.temporaryPassword,
        });
        setDraft({ full_name: '', email: '', pin: '' });
        setMode('existing');
        onChanged();
      },
      onError: (err) => setError(err.message),
    }
  );

  const unassign = useAction((id) => api.admin.unassignTeacher(classRow.id, id), {
    onSuccess: () => { toast('Teacher unassigned'); onChanged(); },
  });

  if (!classRow) return null;
  const assignedIds = new Set(classRow.teachers.map((t) => t.id));
  const candidates = teachers.filter((t) => !assignedIds.has(t.id));
  const newTeacherValid = draft.full_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim());

  return (
    <Modal
      open
      onClose={onClose}
      title={`Teachers for ${classRow.name}`}
      description="The lead teacher owns the daily check-off. Assistants and substitutes can also log lessons and take the register."
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4">
        {/* One-time credential for a teacher just created */}
        {credential && (
          <Alert tone="warn" title={`Sign-in details for ${credential.name}`}>
            <p className="mt-1">
              Email <strong>{credential.email}</strong>, temporary password{' '}
              <strong className="num">{credential.password}</strong>.
            </p>
            <p className="mt-1 text-[0.78rem] opacity-90">
              Shown once only — pass it on now. They will be asked to choose their own password.
            </p>
          </Alert>
        )}

        <div>
          <p className="mb-2 text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>
            Currently assigned
          </p>
          {classRow.teachers.length === 0 ? (
            <div
              className="rounded-lg px-3 py-3 text-[0.82rem]"
              style={{ background: 'var(--warn-soft)', color: 'var(--warn-ink)' }}
            >
              Nobody is assigned to this class yet, so no one can record its lessons or register.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {classRow.teachers.map((teacher) => (
                <li
                  key={teacher.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                  style={{ background: 'var(--surface-sunken)' }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[0.83rem] font-medium" style={{ color: 'var(--text-strong)' }}>
                      {teacher.full_name}
                    </span>
                    <span className="block truncate text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>
                      {teacher.email}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={teacher.role === 'lead' ? 'accent' : 'neutral'} size="sm">{teacher.role}</Badge>
                    <IconButton label={`Unassign ${teacher.full_name}`} onClick={() => unassign.run(teacher.id)}>
                      <X size={15} />
                    </IconButton>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.9rem' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>
              Add a teacher
            </p>
            <SegmentedControl
              ariaLabel="Choose how to add a teacher"
              size="sm"
              value={mode}
              onChange={(next) => { setMode(next); setError(null); }}
              options={[
                { value: 'existing', label: 'Existing staff' },
                { value: 'new', label: 'New teacher' },
              ]}
            />
          </div>

          {mode === 'existing' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Teacher">
                  <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                    <option value="">Choose a teacher…</option>
                    {candidates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                        {t.classes?.length ? ` — already on ${t.classes.map((c) => c.name).join(', ')}` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Role">
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="lead">Lead</option>
                    <option value="assistant">Assistant</option>
                    <option value="substitute">Substitute</option>
                  </Select>
                </Field>
              </div>
              {error && <Alert tone="risk">{error}</Alert>}
              <Button
                variant="primary"
                disabled={!userId}
                busy={assignExisting.busy}
                onClick={() => assignExisting.run().catch(() => {})}
                icon={<UserPlus size={15} />}
              >
                Assign to {classRow.name}
              </Button>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input
                    value={draft.full_name}
                    onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                    placeholder="Ustadh Ahmad Sulaiman"
                  />
                </Field>
                <Field label="Email address" required hint="This is how they sign in.">
                  <Input
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    autoCapitalize="none"
                    spellCheck="false"
                    placeholder="ahmad.sulaiman@icfbayarea.com"
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Teaching PIN" hint="Optional. Lets them sign in on a phone with 4 digits.">
                  <Input
                    value={draft.pin}
                    onChange={(e) => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '') })}
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="1014"
                  />
                </Field>
                <Field label="Role on this class">
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="lead">Lead</option>
                    <option value="assistant">Assistant</option>
                    <option value="substitute">Substitute</option>
                  </Select>
                </Field>
              </div>
              {error && <Alert tone="risk">{error}</Alert>}
              <Button
                variant="primary"
                disabled={!newTeacherValid}
                busy={createAndAssign.busy}
                onClick={() => createAndAssign.run().catch(() => {})}
                icon={<UserPlus size={15} />}
              >
                Create account and assign
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
