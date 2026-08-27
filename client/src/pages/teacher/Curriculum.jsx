/** Read-only curriculum reference, scoped to the teacher's own grade by default. */
import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedClass } from '../../layout/portals';
import {
  AsyncSection, Badge, Card, DataRow, EmptyState, Field, PageHeader,
  SectionHeading, Select, Tabs,
} from '../../ui';
import { GENDER_TRACK } from '../../lib/format';

export default function TeacherCurriculum() {
  const { selected } = useSelectedClass();
  const [grade, setGrade] = useState(selected?.grade || 1);
  const [termNumber, setTermNumber] = useState(null);

  const terms = useApi(() => api.terms(), []);
  const activeTerm = termNumber ?? terms.data?.currentTerm?.term_number ?? 1;

  const curriculum = useApi(
    () => api.curriculum({
      grade,
      term_number: activeTerm,
      gender_track: selected?.gender_track,
    }),
    [grade, activeTerm, selected?.gender_track]
  );

  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="Curriculum"
        description="The An-Nasīḥah syllabus. Your own grade is shown first — change the grade to see any other."
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
          value={activeTerm}
          onChange={setTermNumber}
          tabs={terms.data.terms.map((t) => ({ value: t.term_number, label: t.title }))}
          className="mb-4"
        />
      ) : null}

      <AsyncSection query={curriculum} rows={5}>
        {(data) => {
          const memorization = data.memorization?.[0];
          return (
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                {data.topics.length === 0 ? (
                  <EmptyState title="Nothing recorded for this grade and term" />
                ) : data.topics.map((topic) => (
                  <Card key={topic.id}>
                    <p className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="term text-[0.9rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                        {topic.subject}
                      </span>
                      <Badge tone="neutral" size="sm">{topic.day_of_week}</Badge>
                      {topic.gender_track !== 'general' && (
                        <Badge tone="accent" size="sm">{GENDER_TRACK[topic.gender_track]} only</Badge>
                      )}
                    </p>
                    <p className="term text-[0.86rem]" style={{ color: 'var(--text-body)' }}>{topic.topic_title}</p>
                    <p className="term mt-1.5 text-[0.79rem] italic" style={{ color: 'var(--text-muted)' }}>
                      Expected by end of term: {topic.expected_indicator}
                    </p>
                  </Card>
                ))}
              </div>

              <div>
                <Card>
                  <SectionHeading title="Memorization target" description={`Grade ${grade}`} />
                  {memorization ? (
                    <dl className="term">
                      <DataRow label="Sūrah">{memorization.surah}</DataRow>
                      <DataRow label="Duʿā'">{memorization.dua}</DataRow>
                      <DataRow label="Names of Allāh">{memorization.names_of_allah}</DataRow>
                    </dl>
                  ) : (
                    <p className="text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
                      Nothing recorded for this grade and term.
                    </p>
                  )}
                </Card>
              </div>
            </div>
          );
        }}
      </AsyncSection>
    </>
  );
}
