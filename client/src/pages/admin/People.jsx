/** Staff and family accounts: create, edit, reset credentials. */
import { useState } from 'react';
import { Plus, KeyRound, Pencil, Hash, Copy } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi, useDebounced } from '../../lib/hooks';
import {
  Alert, AsyncSection, Badge, Button, Card, Field, IconButton, Input, Modal,
  PageHeader, SearchInput, Select, Table, TableWrap, Tabs, Td, Th, Tr, toast, EmptyState,
} from '../../ui';
import { timeAgo } from '../../lib/format';

const ROLE_TABS = [
  { value: 'teacher', label: 'Teachers' },
  { value: 'parent', label: 'Parents' },
  { value: 'admin', label: 'Administrators' },
];

const BLANK = { full_name: '', email: '', role: 'teacher', phone: '', title: '', pin: '' };

export default function AdminPeople() {
  const [role, setRole] = useState('teacher');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 250);

  const users = useApi(
    () => api.admin.users({ role, q: debounced || undefined, include_inactive: 'true' }),
    [role, debounced]
  );

  const [editing, setEditing] = useState(null);
  const [credential, setCredential] = useState(null);
  const [pinFor, setPinFor] = useState(null);

  const save = useAction(
    (payload) => (payload.id ? api.admin.updateUser(payload.id, payload) : api.admin.createUser(payload)),
    {
      onSuccess: (result) => {
        setEditing(null);
        users.reload();
        if (result?.temporaryPassword) {
          setCredential({ name: result.user.full_name, email: result.user.email, password: result.temporaryPassword });
        } else {
          toast('Account updated');
        }
      },
    }
  );

  const reset = useAction((user) => api.admin.resetPassword(user.id), {
    onSuccess: () => users.reload(),
  });

  const doReset = async (user) => {
    const result = await reset.run(user);
    setCredential({ name: user.full_name, email: user.email, password: result.temporaryPassword });
  };

  return (
    <>
      <PageHeader
        eyebrow="Accounts"
        title="Staff & families"
        description="Create accounts, reset forgotten passwords and set teaching PINs. Passwords are only ever shown once, here."
        actions={(
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing({ ...BLANK, role })}>
            New account
          </Button>
        )}
      />

      <Tabs value={role} onChange={setRole} tabs={ROLE_TABS} className="mb-4" />

      <div className="mb-4 max-w-xs">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
      </div>

      <AsyncSection query={users} rows={6}>
        {(rows) => (rows.length === 0 ? (
          <EmptyState title="No accounts found" description="Try a different search, or create an account." />
        ) : (
          <Card padded={false}>
            <TableWrap className="rounded-xl border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>{role === 'parent' ? 'Children' : role === 'teacher' ? 'Classes' : 'Position'}</Th>
                    <Th>Phone</Th>
                    <Th align="right">Last signed in</Th>
                    <Th align="right">Manage</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => (
                    <Tr key={user.id} className={user.is_active ? undefined : 'opacity-55'}>
                      <Td>
                        <span className="font-semibold" style={{ color: 'var(--text-strong)' }}>{user.full_name}</span>
                        {!user.is_active && <Badge tone="neutral" size="sm" className="ml-2">Disabled</Badge>}
                        {user.must_change_password ? <Badge tone="warn" size="sm" className="ml-2">Temp password</Badge> : null}
                      </Td>
                      <Td className="text-[0.78rem]">{user.email}</Td>
                      <Td className="max-w-64">
                        {role === 'parent' && (
                          user.children.length
                            ? <span className="flex flex-wrap gap-1">{user.children.map((c) => (
                              <Badge key={c.id} tone="neutral" size="sm">{c.first_name} {c.last_name}</Badge>
                            ))}</span>
                            : <span style={{ color: 'var(--warn-ink)' }}>No children linked</span>
                        )}
                        {role === 'teacher' && (
                          user.classes.length
                            ? <span className="flex flex-wrap gap-1">{user.classes.map((c) => (
                              <Badge key={c.id} tone={c.role === 'lead' ? 'accent' : 'neutral'} size="sm">{c.name}</Badge>
                            ))}</span>
                            : <span style={{ color: 'var(--warn-ink)' }}>No class assigned</span>
                        )}
                        {role === 'admin' && (user.title || '—')}
                      </Td>
                      <Td className="whitespace-nowrap text-[0.78rem]">{user.phone || '—'}</Td>
                      <Td align="right" className="whitespace-nowrap text-[0.76rem]">
                        {user.last_login_at ? timeAgo(user.last_login_at) : 'Never'}
                      </Td>
                      <Td align="right">
                        <span className="flex justify-end gap-0.5">
                          {user.role === 'teacher' && (
                            <IconButton label={`Set a PIN for ${user.full_name}`} onClick={() => setPinFor(user)}>
                              <Hash size={16} />
                            </IconButton>
                          )}
                          <IconButton label={`Reset password for ${user.full_name}`} onClick={() => doReset(user)}>
                            <KeyRound size={16} />
                          </IconButton>
                          <IconButton label={`Edit ${user.full_name}`} onClick={() => setEditing(user)}>
                            <Pencil size={16} />
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
        <AccountForm
          value={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={(payload) => save.run(payload).catch(() => {})}
          busy={save.busy}
          error={save.error?.message}
        />
      )}

      {credential && <CredentialDialog credential={credential} onClose={() => setCredential(null)} />}
      {pinFor && <PinDialog user={pinFor} onClose={() => setPinFor(null)} />}
    </>
  );
}

function AccountForm({ value, onChange, onClose, onSave, busy, error }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const valid = value.full_name?.trim() && value.email?.trim();

  return (
    <Modal
      open
      onClose={onClose}
      title={value.id ? `Edit ${value.full_name}` : 'New account'}
      description={value.id ? undefined : 'A one-time temporary password is generated for you to pass on.'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={!valid} onClick={() => onSave(value)}>
            {value.id ? 'Save changes' : 'Create account'}
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label="Full name" required>
          <Input value={value.full_name} onChange={set('full_name')} placeholder="Ustadh Ahmad Sulaiman" />
        </Field>
        <Field label="Email address" required hint="This is the sign-in identifier.">
          <Input type="email" value={value.email} onChange={set('email')} autoCapitalize="none" spellCheck="false" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role" required>
            <Select value={value.role} onChange={set('role')} disabled={Boolean(value.id)}>
              <option value="teacher">Teacher</option>
              <option value="parent">Parent / Guardian</option>
              <option value="admin">Administrator</option>
            </Select>
          </Field>
          <Field label="Phone">
            <Input value={value.phone || ''} onChange={set('phone')} inputMode="tel" />
          </Field>
        </div>
        <Field label="Position" hint="Shown in the portal header, e.g. “Grade 3 Boys Teacher”.">
          <Input value={value.title || ''} onChange={set('title')} />
        </Field>
        {!value.id && value.role === 'teacher' && (
          <Field label="Teaching PIN" hint="Optional. A short numeric code for quick sign-in on a phone.">
            <Input value={value.pin || ''} onChange={set('pin')} inputMode="numeric" placeholder="1014" />
          </Field>
        )}
        {value.id && (
          <Field label="Account status">
            <Select value={value.is_active ? '1' : '0'} onChange={(e) => onChange({ ...value, is_active: e.target.value === '1' })}>
              <option value="1">Active</option>
              <option value="0">Disabled — cannot sign in</option>
            </Select>
          </Field>
        )}
        {error && <Alert tone="risk">{error}</Alert>}
      </div>
    </Modal>
  );
}

/** Shows a freshly generated credential once — it cannot be retrieved later. */
function CredentialDialog({ credential, onClose }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${credential.email} / ${credential.password}`);
      toast('Copied to clipboard');
    } catch {
      toast('Copy the details manually — clipboard access was blocked', 'warn');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Temporary password"
      description="Pass these details to the account holder. They will be asked to choose their own password."
      size="sm"
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      <div className="space-y-3">
        <Alert tone="warn">
          This password is shown once and is not stored in readable form. If it is lost,
          issue another reset.
        </Alert>
        <div className="rounded-lg px-3 py-3" style={{ background: 'var(--surface-sunken)' }}>
          <p className="text-[0.78rem]" style={{ color: 'var(--text-muted)' }}>{credential.name}</p>
          <p className="mt-1 text-[0.83rem] font-medium" style={{ color: 'var(--text-strong)' }}>{credential.email}</p>
          <p className="num mt-2 text-lg font-semibold tracking-wide" style={{ color: 'var(--accent-text)' }}>
            {credential.password}
          </p>
        </div>
        <Button variant="secondary" icon={<Copy size={15} />} onClick={copy}>Copy email and password</Button>
      </div>
    </Modal>
  );
}

function PinDialog({ user, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const save = useAction(() => api.admin.setPin(user.id, pin), {
    onSuccess: () => { toast(`PIN set for ${user.full_name}`); onClose(); },
    onError: (err) => setError(err.message),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Teaching PIN — ${user.full_name}`}
      description="A 4–12 digit code they can use instead of a password when signing in on a phone."
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.busy}>Cancel</Button>
          <Button
            variant="primary"
            busy={save.busy}
            disabled={!/^\d{4,12}$/.test(pin)}
            onClick={() => save.run().catch(() => {})}
          >
            Set PIN
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label="PIN" required hint="Digits only.">
          <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={12} />
        </Field>
        {error && <Alert tone="risk">{error}</Alert>}
      </div>
    </Modal>
  );
}
