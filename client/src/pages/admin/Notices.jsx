/** Notices to the whole maktab, to staff, to families, or to one class. */
import { useState } from 'react';
import { Plus, Pencil, Trash2, Pin } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import {
  Alert, AsyncSection, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field,
  IconButton, Input, Modal, PageHeader, Select, Textarea, toast,
} from '../../ui';
import { AUDIENCE, mediumDate, timeAgo } from '../../lib/format';

const BLANK = { title: '', body: '', audience: 'all', class_id: '', is_pinned: false, expires_on: '' };

export default function AdminNotices() {
  const notices = useApi(() => api.admin.allAnnouncements(), []);
  const classes = useApi(() => api.admin.classes(), []);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const save = useAction(
    (payload) => (payload.id
      ? api.admin.updateAnnouncement(payload.id, payload)
      : api.admin.createAnnouncement(payload)),
    {
      onSuccess: () => { toast(editing?.id ? 'Notice updated' : 'Notice posted'); setEditing(null); notices.reload(); },
    }
  );

  const remove = useAction((id) => api.admin.deleteAnnouncement(id), {
    onSuccess: () => { toast('Notice deleted'); setDeleting(null); notices.reload(); },
  });

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Notices"
        description="Notices appear in the relevant portals. Teachers-only notices are never visible to families."
        actions={(
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing({ ...BLANK })}>
            Post a notice
          </Button>
        )}
      />

      <AsyncSection query={notices} rows={4}>
        {(rows) => (rows.length === 0 ? (
          <EmptyState
            title="No notices posted"
            description="Post a notice to reach staff, families, or one class."
            action={<Button variant="primary" onClick={() => setEditing({ ...BLANK })}>Post a notice</Button>}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((notice) => (
              <Card key={notice.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mb-1 flex flex-wrap items-center gap-2">
                      {notice.is_pinned === 1 && <Pin size={13} style={{ color: 'var(--accent)' }} />}
                      <span className="text-[0.93rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                        {notice.title}
                      </span>
                      <Badge tone={notice.audience === 'all' ? 'accent' : 'neutral'} size="sm">
                        {notice.audience === 'class' && notice.class_name
                          ? notice.class_name
                          : AUDIENCE[notice.audience]}
                      </Badge>
                    </p>
                    <p className="whitespace-pre-line text-[0.83rem] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                      {notice.body}
                    </p>
                    <p className="mt-2 text-[0.73rem]" style={{ color: 'var(--text-muted)' }}>
                      {notice.author ? `${notice.author} · ` : ''}posted {timeAgo(notice.created_at)}
                      {notice.expires_on ? ` · expires ${mediumDate(notice.expires_on)}` : ''}
                    </p>
                  </div>
                  <span className="flex shrink-0 gap-0.5">
                    <IconButton label="Edit notice" onClick={() => setEditing({
                      ...notice,
                      is_pinned: notice.is_pinned === 1,
                      class_id: notice.class_id ?? '',
                      expires_on: notice.expires_on ?? '',
                    })}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton label="Delete notice" onClick={() => setDeleting(notice)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </AsyncSection>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? 'Edit notice' : 'Post a notice'}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={save.busy}>Cancel</Button>
              <Button
                variant="primary"
                busy={save.busy}
                disabled={!editing.title.trim() || !editing.body.trim()
                  || (editing.audience === 'class' && !editing.class_id)}
                onClick={() => save.run({
                  ...editing,
                  class_id: editing.class_id ? Number(editing.class_id) : null,
                  expires_on: editing.expires_on || null,
                }).catch(() => {})}
              >
                {editing.id ? 'Save changes' : 'Post notice'}
              </Button>
            </>
          )}
        >
          <div className="space-y-3">
            <Field label="Title" required>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="Message" required>
              <Textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={5}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Who can see this" required>
                <Select value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value })}>
                  <option value="all">Everyone</option>
                  <option value="teachers">Teachers only</option>
                  <option value="parents">Parents only</option>
                  <option value="class">One class</option>
                </Select>
              </Field>
              {editing.audience === 'class' && (
                <Field label="Class" required>
                  <Select value={editing.class_id} onChange={(e) => setEditing({ ...editing, class_id: e.target.value })}>
                    <option value="">Choose a class…</option>
                    {(classes.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
              )}
            </div>
            <Field label="Stop showing after" hint="Leave blank to keep the notice up indefinitely.">
              <Input
                type="date"
                value={editing.expires_on}
                onChange={(e) => setEditing({ ...editing, expires_on: e.target.value })}
              />
            </Field>
            <Checkbox
              label="Pin to the top"
              description="Pinned notices appear above all others in every portal."
              checked={editing.is_pinned}
              onChange={(e) => setEditing({ ...editing, is_pinned: e.target.checked })}
            />
            {save.error && <Alert tone="risk">{save.error.message}</Alert>}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.run(deleting.id)}
        title="Delete this notice?"
        confirmLabel="Delete"
        busy={remove.busy}
      >
        &ldquo;{deleting?.title}&rdquo; will be removed from every portal. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
