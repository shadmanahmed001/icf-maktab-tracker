/**
 * Curriculum manager. The An-Nasīḥah syllabus ships pre-loaded, so this screen
 * is mostly for browsing and the occasional correction — the layout leads with
 * the reference view and keeps editing one click away.
 */
import { useState } from 'react';
import { Plus, Pencil, Archive } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import {
  Alert, AsyncSection, Badge, Button, Card, ConfirmDialog, DataRow, Field, IconButton,
  Input, Modal, PageHeader, SectionHeading, Select, Tabs, Textarea, toast, EmptyState,
} from '../../ui';
import { GENDER_TRACK } from '../../lib/format';

const BLANK = {
  grade: 1, gender_track: 'general', term_number: 1, day_of_week: 'Monday',
  subject: 'Fiqh', topic_title: '', expected_indicator: '', sequence_order: 1,
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SUBJECTS = ['Fiqh', 'Aḥādīth', 'Sīrah', 'Tārīkh', "ʿAqā'id", 'Akhlāq', 'Ādāb'];

export default function AdminCurriculum() {
  const [grade, setGrade] = useState(1);
  const [termNumber, setTermNumber] = useState(1);
  const [editing, setEditing] = useState(null);
  const [retiring, setRetiring] = useState(null);

  const terms = useApi(() => api.terms(), []);
  const curriculum = useApi(
    () => api.curriculum({ grade, term_number: termNumber }),
    [grade, termNumber]
  );

  const save = useAction(
    (payload) => (payload.id ? api.admin.updateTopic(payload.id, payload) : api.admin.createTopic(payload)),
    {
      onSuccess: () => { toast(editing?.id ? 'Standard updated' : 'Standard added'); setEditing(null); curriculum.reload(); },
    }
  );

  const retire = useAction((id) => api.admin.retireTopic(id), {
    onSuccess: () => { toast('Standard retired'); setRetiring(null); curriculum.reload(); },
  });

  const memorization = curriculum.data?.memorization?.[0] || null;

  return (
    <>
      <PageHeader
        eyebrow="Academic standards"
        title="Curriculum"
        description="The An-Nasīḥah syllabus for 2026–2027. Five strands per term, one per teaching day, with the observable indicator each pupil should reach."
        actions={(
          <Button
            variant="primary"
            icon={<Plus size={15} />}
            onClick={() => setEditing({ ...BLANK, grade, term_number: termNumber })}
          >
            Add standard
          </Button>
        )}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Grade" className="w-32">
          <Select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </Select>
        </Field>
      </div>

      {terms.data?.terms?.length ? (
        <Tabs
          value={termNumber}
          onChange={setTermNumber}
          tabs={terms.data.terms.map((t) => ({ value: t.term_number, label: t.title }))}
          className="mb-4"
        />
      ) : null}

      <AsyncSection query={curriculum} rows={5}>
        {(data) => {
          const term = terms.data?.terms?.find((t) => t.term_number === termNumber);
          return (
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                {term?.is_interlude && (
                  <Alert tone="info" title={term.title}>
                    {term.description} No new standards are introduced during the interlude.
                  </Alert>
                )}

                {data.topics.length === 0 ? (
                  <EmptyState
                    title="No standards for this grade and term"
                    description="Add the strands taught in this term, or choose a different term."
                    action={(
                      <Button variant="primary" onClick={() => setEditing({ ...BLANK, grade, term_number: termNumber })}>
                        Add standard
                      </Button>
                    )}
                  />
                ) : data.topics.map((topic) => (
                  <Card key={topic.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="term text-[0.9rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                            {topic.subject}
                          </span>
                          <Badge tone="neutral" size="sm">{topic.day_of_week}</Badge>
                          {topic.gender_track !== 'general' && (
                            <Badge tone="accent" size="sm">{GENDER_TRACK[topic.gender_track]} only</Badge>
                          )}
                        </p>
                        <p className="term text-[0.86rem]" style={{ color: 'var(--text-body)' }}>
                          {topic.topic_title}
                        </p>
                        <p className="term mt-1.5 text-[0.79rem] italic" style={{ color: 'var(--text-muted)' }}>
                          Expected by end of term: {topic.expected_indicator}
                        </p>
                      </div>
                      <span className="flex shrink-0 gap-0.5">
                        <IconButton label="Edit standard" onClick={() => setEditing(topic)}>
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton label="Retire standard" onClick={() => setRetiring(topic)}>
                          <Archive size={16} />
                        </IconButton>
                      </span>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="space-y-4">
                <Card>
                  <SectionHeading title="Memorization target" description={`Grade ${grade}, ${term?.title || ''}`} />
                  {memorization ? (
                    <dl className="term">
                      <DataRow label="Sūrah">{memorization.surah}</DataRow>
                      <DataRow label="Duʿā'">{memorization.dua}</DataRow>
                      <DataRow label="Names of Allāh">{memorization.names_of_allah}</DataRow>
                    </dl>
                  ) : (
                    <p className="text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
                      No memorization target recorded for this grade and term.
                    </p>
                  )}
                </Card>

                <Card>
                  <SectionHeading title="Weekly strand pattern" />
                  <ul className="space-y-1.5 text-[0.8rem]">
                    {[
                      ['Monday', 'Fiqh'],
                      ['Tuesday', 'Aḥādīth'],
                      ['Wednesday', 'Sīrah → Tārīkh from Term 3'],
                      ['Thursday', "ʿAqā'id"],
                      ['Friday', 'Akhlāq → Ādāb in Term 4'],
                    ].map(([day, strand]) => (
                      <li key={day} className="flex justify-between gap-3">
                        <span style={{ color: 'var(--text-muted)' }}>{day}</span>
                        <span className="term text-right font-medium" style={{ color: 'var(--text-strong)' }}>{strand}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                    Every lesson also opens with the memorization track — Sūrah, Duʿā' and the Names of Allāh.
                  </p>
                </Card>
              </div>
            </div>
          );
        }}
      </AsyncSection>

      {editing && (
        <TopicForm
          value={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={(payload) => save.run(payload).catch(() => {})}
          busy={save.busy}
          error={save.error?.message}
          terms={terms.data?.terms || []}
        />
      )}

      <ConfirmDialog
        open={Boolean(retiring)}
        onClose={() => setRetiring(null)}
        onConfirm={() => retire.run(retiring.id)}
        title="Retire this standard?"
        confirmLabel="Retire"
        busy={retire.busy}
      >
        It will stop counting towards class coverage. Lessons already logged against it keep their link,
        so past terms still read correctly.
      </ConfirmDialog>
    </>
  );
}

function TopicForm({ value, onChange, onClose, onSave, busy, error, terms }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const valid = value.topic_title?.trim() && value.expected_indicator?.trim();

  return (
    <Modal
      open
      onClose={onClose}
      title={value.id ? 'Edit standard' : 'Add a standard'}
      description="The indicator is what a pupil should observably be able to do by the end of the term."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={!valid}
            onClick={() => onSave({
              ...value,
              grade: Number(value.grade),
              term_number: Number(value.term_number),
              sequence_order: Number(value.sequence_order) || 1,
            })}
          >
            {value.id ? 'Save changes' : 'Add standard'}
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Grade" required>
            <Select value={value.grade} onChange={set('grade')}>
              {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </Select>
          </Field>
          <Field label="Term" required>
            <Select value={value.term_number} onChange={set('term_number')}>
              {terms.map((t) => <option key={t.term_number} value={t.term_number}>{t.title}</option>)}
            </Select>
          </Field>
          <Field label="Track">
            <Select value={value.gender_track} onChange={set('gender_track')}>
              <option value="general">All pupils</option>
              <option value="boys">Boys only</option>
              <option value="girls">Girls only</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Strand" required>
            <Select value={value.subject} onChange={set('subject')}>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Teaching day" required>
            <Select value={value.day_of_week} onChange={set('day_of_week')}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Order" hint="Within the term.">
            <Input type="number" min="1" max="99" value={value.sequence_order} onChange={set('sequence_order')} />
          </Field>
        </div>

        <Field label="Topic" required>
          <Textarea value={value.topic_title} onChange={set('topic_title')} rows={2} className="term" />
        </Field>
        <Field label="Expected indicator" required hint="Phrase it as an observable action: “Recite Ḥadīth 1 with its meaning”.">
          <Textarea value={value.expected_indicator} onChange={set('expected_indicator')} rows={2} className="term" />
        </Field>
        {error && <Alert tone="risk">{error}</Alert>}
      </div>
    </Modal>
  );
}
