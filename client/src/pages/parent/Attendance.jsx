/** Attendance for the term, session by session. */
import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedChild } from '../../layout/portals';
import { Alert, AsyncSection, Card, PageHeader, SectionHeading, Tabs } from '../../ui';
import { AttendanceRecordList, AttendanceSummaryCard } from '../../features/progress';
import { mediumDate } from '../../lib/format';

export default function FamilyAttendance() {
  const { selectedId, selected } = useSelectedChild();
  const [termNumber, setTermNumber] = useState(null);

  const terms = useApi(() => api.terms(), []);
  const query = useApi(
    () => api.parent.attendance(selectedId, termNumber === null ? {} : { term_number: termNumber }),
    [selectedId, termNumber],
    { skip: !selectedId }
  );

  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="Attendance"
        description="Taken by the class teacher at the start of every session."
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
        {(data) => (
          <div className="space-y-5">
            <AttendanceSummaryCard
              summary={data.summary}
              title="Summary"
              description={`${mediumDate(data.from)} to ${mediumDate(data.to)}`}
            />

            {data.summary.absent >= 3 && (
              <Alert tone="warn" title="Please get in touch">
                {selected?.first_name} has {data.summary.absent} unexplained absences this term.
                If any of these should have been excused, message the class teacher and the office
                will update the record.
              </Alert>
            )}

            <Card>
              <SectionHeading title="Session by session" description="Most recent first." />
              <AttendanceRecordList records={data.records} />
            </Card>
          </div>
        )}
      </AsyncSection>
    </>
  );
}
