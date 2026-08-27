/** Class register: create, edit, staff and archive the twelve maktab classes. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Archive, UserPlus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import {
  Alert, AsyncSection, Badge, Button, Card, ConfirmDialog, Field, IconButton, Input,
  Modal, PageHeader, SearchInput, Select, Table, TableWrap, Td, Th, Tr, toast,
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
                          ? <span style={{ color: 'var(--warn-ink)' }}>None assigned</span>
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

function StaffingDialog({ classRow, teachers, onClose, onChanged }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('lead');
  const [error, setError] = useState(null);

  const assign = useAction(
    () => api.admin.assignTeacher(classRow.id, { user_id: Number(userId), role }),
    {
      onSuccess: () => { toast('Teacher assigned'); setUserId(''); onChanged(); },
      onError: (err) => setError(err.message),
    }
  );
  const unassign = useAction((id) => api.admin.unassignTeacher(classRow.id, id), {
    onSuccess: () => { toast('Teacher unassigned'); onChanged(); },
  });

  if (!classRow) return null;
  const assignedIds = new Set(classRow.teachers.map((t) => t.id));
  const candidates = teachers.filter((t) => !assignedIds.has(t.id));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Teachers for ${classRow.name}`}
      description="A lead teacher owns the daily check-off; assistants and substitutes can also log lessons."
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>Assigned</p>
          {classRow.teachers.length === 0 ? (
            <p className="text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>Nobody is assigned to this class yet.</p>
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
          <p className="text-[0.78rem] font-semibold" style={{ color: 'var(--text-body)' }}>Assign someone</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Teacher">
              <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Choose a teacher…</option>
                {candidates.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
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
            busy={assign.busy}
            onClick={() => assign.run().catch(() => {})}
            icon={<UserPlus size={15} />}
          >
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
}
