/** Every lesson the child's class has covered this term. */
import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedChild } from '../../layout/portals';
import { AsyncSection, PageHeader, Tabs, SegmentedControl } from '../../ui';
import { LessonHistoryList } from '../../features/progress';

export default function FamilyLessons() {
  const { selectedId } = useSelectedChild();
  const [termNumber, setTermNumber] = useState(null);
  const [subject, setSubject] = useState('all');

  const terms = useApi(() => api.terms(), []);
  const query = useApi(
    () => api.parent.lessons(selectedId, termNumber === null ? {} : { term_number: termNumber }),
    [selectedId, termNumber],
    { skip: !selectedId }
  );

  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="Lessons covered"
        description="What was taught, and what your child should be able to do as a result."
      />

      {terms.data?.terms?.length ? (
        <Tabs
          value={termNumber ?? terms.data.currentTerm?.term_number ?? 1}
          onChange={setTermNumber}
          tabs={terms.data.terms.map((t) => ({ value: t.term_number, label: t.title }))}
          className="mb-4"
        />
      ) : null}

      <AsyncSection query={query} rows={5}>
        {(data) => {
          const subjects = [...new Set(data.lessons.map((l) => l.subject))];
          const filtered = subject === 'all' ? data.lessons : data.lessons.filter((l) => l.subject === subject);

          return (
            <>
              {subjects.length > 1 && (
                <div className="mb-4 overflow-x-auto">
                  <SegmentedControl
                    ariaLabel="Filter by subject"
                    value={subject}
                    onChange={setSubject}
                    size="sm"
                    options={[
                      { value: 'all', label: `All (${data.lessons.length})` },
                      ...subjects.map((s) => ({
                        value: s,
                        label: `${s} (${data.lessons.filter((l) => l.subject === s).length})`,
                      })),
                    ]}
                  />
                </div>
              )}

              <LessonHistoryList lessons={filtered} />
            </>
          );
        }}
      </AsyncSection>
    </>
  );
}
