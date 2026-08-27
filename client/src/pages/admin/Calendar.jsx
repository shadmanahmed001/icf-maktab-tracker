/** Terms and the academic calendar, including the Ramaḍān interlude. */
import { useState } from 'react';
import { CalendarCheck, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import {
  Alert, AsyncSection, Badge, Button, Card, Field, Input, Modal, PageHeader,
  SectionHeading, Textarea, toast,
} from '../../ui';
import { PacingBar } from '../../charts';
import { longDate, todayISO } from '../../lib/format';

export default function AdminCalendar() {
  const query = useApi(() => api.terms(), []);
  const [editing, setEditing] = useState(null);

  const setCurrent = useAction((termNumber) => api.admin.setCurrentTerm(termNumber), {
    onSuccess: () => { toast('Active term updated'); query.reload(); },
  });

  const save = useAction((payload) => api.admin.updateTerm(payload.id, payload), {
    onSuccess: () => { toast('Term updated'); setEditing(null); query.reload(); },
  });

  const today = todayISO();

  return (
    <>
      <PageHeader
        eyebrow="Academic calendar"
        title="Terms & calendar"
        description="Four teaching terms plus the Ramaḍān interlude. The active term is what every portal reports against."
      />

      <AsyncSection query={query} rows={5}>
        {(data) => (
          <div className="space-y-4">
            {data.terms.map((term) => {
              const isCurrent = term.is_current === 1;
              const started = today >= term.start_date;
              const ended = today > term.end_date;
              const totalDays = Math.max(
                1,
                Math.round((new Date(term.end_date) - new Date(term.start_date)) / 86400000)
              );
              const elapsed = ended ? totalDays
                : started ? Math.round((new Date(today) - new Date(term.start_date)) / 86400000)
                  : 0;
              const percentElapsed = Math.round((elapsed / totalDays) * 100);

              return (
                <Card key={term.id} className={isCurrent ? 'ring-1' : undefined}
                  style={isCurrent ? {
                    background: 'var(--surface-card)',
                    border: '1px solid var(--accent)',
                    boxShadow: 'var(--shadow-raised)',
                  } : undefined}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-[1rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                          {term.title}
                        </span>
                        {isCurrent && <Badge tone="accent">Active term</Badge>}
                        {term.is_interlude === 1 && <Badge tone="info">Interlude · revision only</Badge>}
                        {ended && !isCurrent && <Badge tone="neutral">Completed</Badge>}
                        {!started && <Badge tone="neutral">Upcoming</Badge>}
                      </p>
                      <p className="mt-0.5 text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
                        {longDate(term.start_date)} — {longDate(term.end_date)}
                      </p>
                      {term.description && (
                        <p className="mt-1.5 max-w-2xl text-[0.82rem]" style={{ color: 'var(--text-body)' }}>
                          {term.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {!isCurrent && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<CalendarCheck size={14} />}
                          busy={setCurrent.busy}
                          onClick={() => setCurrent.run(term.term_number)}
                        >
                          Make active
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditing(term)}>
                        Edit
                      </Button>
                    </div>
                  </div>

                  {started && (
                    <div className="mt-4">
                      <PacingBar
                        value={percentElapsed}
                        expected={null}
                        label="Term elapsed"
                        tone={ended ? 'neutral' : 'accent'}
                      />
                    </div>
                  )}
                </Card>
              );
            })}

            <Card>
              <SectionHeading
                title="How pacing uses the calendar"
                description="Why a class can be flagged even when nothing has gone wrong."
              />
              <p className="text-[0.83rem] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                Each class is compared against how much of the active term has elapsed. A class 40% of
                the way through the term is expected to have covered roughly 40% of its standards, with
                half credit for a standard currently being taught. Separately, the number of daily
                daily logs recorded is compared against the teaching days that have passed — a class
                can be teaching perfectly well and still be flagged if nobody is completing the attendance.
                The radar reports whichever of the two signals is worse.
              </p>
            </Card>
          </div>
        )}
      </AsyncSection>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={`Edit ${editing.title}`}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={save.busy}>Cancel</Button>
              <Button variant="primary" busy={save.busy} onClick={() => save.run(editing).catch(() => {})}>
                Save changes
              </Button>
            </>
          )}
        >
          <div className="space-y-3">
            <Field label="Title" required>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="Date range (as displayed)" required>
              <Input value={editing.date_range} onChange={(e) => setEditing({ ...editing, date_range: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start date" required>
                <Input type="date" value={editing.start_date} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
              </Field>
              <Field label="End date" required>
                <Input type="date" value={editing.end_date} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} />
            </Field>
            {save.error && <Alert tone="risk">{save.error.message}</Alert>}
          </div>
        </Modal>
      )}
    </>
  );
}
