/** Homework set for the class — visible to families in their portal. */
import { useState } from 'react';
import { Plus, Trash2, NotebookPen } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import { useSelectedClass } from '../../layout/portals';
import {
  Alert, AsyncSection, Badge, Button, Card, ConfirmDialog, EmptyState, Field,
  IconButton, Input, Modal, Select, Textarea, toast,
} from '../../ui';
import { mediumDate, todayISO } from '../../lib/format';

const SUBJECTS = ['Fiqh', 'Aḥādīth', 'Sīrah', 'Tārīkh', "ʿAqā'id", 'Akhlāq', 'Ādāb', 'Memorization'];

export default function HomeworkPanel() {
  const { selectedId } = useSelectedClass();
  const query = useApi(() => api.teacher.homework(selectedId), [selectedId], { skip: !selectedId });

  const [creating, setCreating] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const save = useAction((payload) => api.teacher.createHomework(selectedId, payload), {
    onSuccess: () => { toast('Homework set — families can see it now'); setCreating(null); query.reload(); },
  });

  const remove = useAction((id) => api.teacher.deleteHomework(id), {
    onSuccess: () => { toast('Homework removed'); setDeleting(null); query.reload(); },
  });

  const today = todayISO();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.83rem]" style={{ color: 'var(--text-muted)' }}>
          What you set here appears in the family portal, so write it for a parent to read.
        </p>
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          onClick={() => setCreating({
            subject: 'Aḥādīth', title: '', instructions: '',
            assigned_date: today, due_date: '',
          })}
        >
          Set homework
        </Button>
      </div>

      <AsyncSection query={query} rows={4}>
        {(rows) => (rows.length === 0 ? (
          <EmptyState
            icon={<NotebookPen size={28} />}
            title="No homework set"
            description="Set homework and it appears immediately in the family portal."
            action={(
              <Button variant="primary" onClick={() => setCreating({
                subject: 'Aḥādīth', title: '', instructions: '', assigned_date: today, due_date: '',
              })}>
                Set homework
              </Button>
            )}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((item) => {
              const overdue = item.due_date && item.due_date < today;
              return (
                <Card key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="term text-[0.9rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                          {item.title}
                        </span>
                        <Badge tone="accent" size="sm" className="term">{item.subject}</Badge>
                        {item.due_date && (
                          <Badge tone={overdue ? 'neutral' : 'warn'} size="sm">
                            {overdue ? 'Due date passed' : `Due ${mediumDate(item.due_date)}`}
                          </Badge>
                        )}
                      </p>
                      {item.instructions && (
                        <p className="text-[0.83rem]" style={{ color: 'var(--text-body)' }}>{item.instructions}</p>
                      )}
                      <p className="mt-1.5 text-[0.73rem]" style={{ color: 'var(--text-muted)' }}>
                        Set {mediumDate(item.assigned_date)}{item.author ? ` by ${item.author}` : ''}
                      </p>
                    </div>
                    <IconButton label={`Delete ${item.title}`} onClick={() => setDeleting(item)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </Card>
              );
            })}
          </div>
        ))}
      </AsyncSection>

      {creating && (
        <Modal
          open
          onClose={() => setCreating(null)}
          title="Set homework"
          footer={(
            <>
              <Button variant="secondary" onClick={() => setCreating(null)} disabled={save.busy}>Cancel</Button>
              <Button
                variant="primary"
                busy={save.busy}
                disabled={!creating.title.trim()}
                onClick={() => save.run({
                  ...creating,
                  due_date: creating.due_date || null,
                }).catch(() => {})}
              >
                Set homework
              </Button>
            </>
          )}
        >
          <div className="space-y-3">
            <Field label="Subject" required>
              <Select
                value={creating.subject}
                onChange={(e) => setCreating({ ...creating, subject: e.target.value })}
                className="term"
              >
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="What to do" required hint="Keep it to one line — this is the headline parents see.">
              <Input
                value={creating.title}
                onChange={(e) => setCreating({ ...creating, title: e.target.value })}
                placeholder="Recite this week's ḥadīth with its meaning"
                className="term"
              />
            </Field>
            <Field label="Instructions for parents">
              <Textarea
                value={creating.instructions}
                onChange={(e) => setCreating({ ...creating, instructions: e.target.value })}
                rows={3}
                placeholder="Please practice with your child and sign the workbook page."
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Set on">
                <Input
                  type="date"
                  value={creating.assigned_date}
                  onChange={(e) => setCreating({ ...creating, assigned_date: e.target.value })}
                />
              </Field>
              <Field label="Due">
                <Input
                  type="date"
                  value={creating.due_date}
                  onChange={(e) => setCreating({ ...creating, due_date: e.target.value })}
                />
              </Field>
            </div>
            {save.error && <Alert tone="risk">{save.error.message}</Alert>}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.run(deleting.id)}
        title="Remove this homework?"
        confirmLabel="Remove"
        busy={remove.busy}
      >
        &ldquo;{deleting?.title}&rdquo; will disappear from the family portal.
      </ConfirmDialog>
    </>
  );
}
