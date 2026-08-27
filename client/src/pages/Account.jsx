/** Every role's own account page: contact details and password. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAction } from '../lib/hooks';
import {
  Alert, Button, Card, DataRow, Field, Input, PageHeader, SectionHeading, toast,
} from '../ui';
import { ThemeToggle } from '../features/ThemeToggle';

const ROLE_LABEL = { admin: 'Administrator', teacher: 'Teacher', parent: 'Parent / Guardian' };

export default function Account() {
  const { user, refresh } = useAuth();
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone || '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState(null);

  const saveProfile = useAction(
    () => api.updateProfile({ full_name: fullName.trim(), phone: phone.trim() }),
    {
      onSuccess: async () => {
        toast('Your details have been saved');
        await refresh();
      },
    }
  );

  const changePassword = useAction(
    () => api.changePassword(current, next),
    {
      onSuccess: () => {
        toast('Your password has been changed');
        setCurrent(''); setNext(''); setConfirm(''); setPasswordError(null);
      },
      onError: (err) => setPasswordError(err.message),
    }
  );

  const submitPassword = (event) => {
    event.preventDefault();
    setPasswordError(null);
    if (next.length < 8) {
      setPasswordError('Choose a password of at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setPasswordError('The two new passwords do not match.');
      return;
    }
    changePassword.run().catch(() => { /* surfaced via passwordError */ });
  };

  const home = { admin: '/admin', teacher: '/teacher', parent: '/family' }[user.role] || '/';

  return (
    <div data-portal={user.role === 'parent' ? 'parent' : user.role} className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* This page renders outside the portal shell, so it carries its own
            copy of the switch — otherwise appearance would be unreachable from
            the one screen a person visits to change their own settings. */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button as={Link} to={home} variant="ghost" size="sm" icon={<ArrowLeft size={15} />}>
            Back to your portal
          </Button>
          <ThemeToggle />
        </div>

        <PageHeader
          eyebrow="Your account"
          title={user.full_name}
          description="Update how the maktab can reach you, and change your password."
        />

        {user.must_change_password ? (
          <Alert tone="warn" title="Set your own password" className="mb-5">
            You are signed in with a temporary password issued by the office. Please choose your own below.
          </Alert>
        ) : null}

        <div className="space-y-5">
          <Card>
            <SectionHeading title="Account details" />
            <dl className="mb-4">
              <DataRow label="Email address">{user.email}</DataRow>
              <DataRow label="Role">{ROLE_LABEL[user.role]}</DataRow>
              {user.title && <DataRow label="Position">{user.title}</DataRow>}
            </dl>

            <div className="space-y-3">
              <Field label="Full name" required>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Phone number" hint="Used by the office if they need to reach you about your class or child.">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(510) 555-0100" />
              </Field>
              {saveProfile.error && <Alert tone="risk">{saveProfile.error.message}</Alert>}
              <Button
                variant="primary"
                busy={saveProfile.busy}
                onClick={() => saveProfile.run().catch(() => {})}
                disabled={!fullName.trim()}
              >
                Save details
              </Button>
            </div>
          </Card>

          <Card>
            <SectionHeading
              title="Password"
              description="At least 8 characters. Your teaching PIN, if you have one, is unchanged."
            />
            <form onSubmit={submitPassword} className="space-y-3">
              <Field label="Current password or PIN" required>
                <Input
                  type="password" autoComplete="current-password"
                  value={current} onChange={(e) => setCurrent(e.target.value)} required
                />
              </Field>
              <Field label="New password" required>
                <Input
                  type="password" autoComplete="new-password"
                  value={next} onChange={(e) => setNext(e.target.value)} required
                />
              </Field>
              <Field label="Confirm new password" required>
                <Input
                  type="password" autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                />
              </Field>
              {passwordError && <Alert tone="risk">{passwordError}</Alert>}
              <Button type="submit" variant="primary" busy={changePassword.busy} icon={<KeyRound size={15} />}>
                Change password
              </Button>
            </form>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <p className="text-[0.8rem] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Your sign-in details are stored only as an irreversible hash — nobody at the maktab,
                including the office, can read your password. If you forget it, ask the office to
                issue a new temporary one.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
