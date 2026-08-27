/**
 * The term report card — the artefact that replaces the paper one, so it has
 * to print cleanly on a single sheet.
 */
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedChild } from '../../layout/portals';
import {
  AsyncSection, Button, Card, DataRow, PageHeader, SectionHeading, Tabs,
} from '../../ui';
import {
  AssessmentTable, MasteryScaleLegend, MemorizationPanel, OverallAttainment,
} from '../../features/progress';
import { ATTENDANCE, longDate, percent } from '../../lib/format';
import { CompositionBar } from '../../charts';

export default function FamilyReportCard() {
  const { selectedId } = useSelectedChild();
  const [termNumber, setTermNumber] = useState(null);

  const terms = useApi(() => api.terms(), []);
  const query = useApi(
    () => api.parent.reportCard(selectedId, termNumber === null ? {} : { term_number: termNumber }),
    [selectedId, termNumber],
    { skip: !selectedId }
  );

  return (
    <>
      <PageHeader
        eyebrow="End of term"
        title="Report card"
        description="Attainment in each strand, memorization and attendance for the term."
        actions={(
          <Button variant="primary" icon={<Printer size={15} />} onClick={() => window.print()}>
            Print
          </Button>
        )}
      />

      {terms.data?.terms?.length ? (
        <Tabs
          value={termNumber ?? terms.data.currentTerm?.term_number ?? 1}
          onChange={setTermNumber}
          tabs={terms.data.terms.map((t) => ({ value: t.term_number, label: t.title }))}
          className="mb-4 print:hidden"
        />
      ) : null}

      <AsyncSection query={query} rows={6}>
        {(data) => {
          const { student, term, assessments, memorization, memorizationStandard, attendance, overall, teachers } = data;
          return (
            <Card>
              {/* Print masthead */}
              <div className="mb-5 hidden border-b pb-4 print:block">
                <h1 className="text-lg font-bold">Islamic Center of Fremont — Daily Maktab</h1>
                <p className="text-sm">An-Nasīḥah Islamic Studies · Academic Year 2026–2027</p>
              </div>

              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <dl>
                  <DataRow label="Pupil">{student.first_name} {student.last_name}</DataRow>
                  <DataRow label="Student code">{student.student_code}</DataRow>
                  <DataRow label="Class">{student.class_name}</DataRow>
                  <DataRow label="Teacher">
                    {teachers.map((t) => t.full_name).join(', ') || '—'}
                  </DataRow>
                </dl>
                <dl>
                  <DataRow label="Term">{term.title}</DataRow>
                  <DataRow label="Period">{term.date_range}</DataRow>
                  <DataRow label="Attendance">{percent(attendance.rate)}</DataRow>
                  <DataRow label="Sessions recorded">{attendance.recorded}</DataRow>
                </dl>
              </div>

              <div className="mb-5 grid gap-5 sm:grid-cols-[auto_1fr]">
                <div className="flex justify-center">
                  <OverallAttainment overall={overall} />
                </div>
                <div>
                  <p className="mb-2 text-[0.8rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                    Attendance across the term
                  </p>
                  <CompositionBar
                    height={12}
                    segments={[
                      { label: ATTENDANCE.present.label, value: attendance.present, tone: 'ok' },
                      { label: ATTENDANCE.late.label, value: attendance.late, tone: 'warn' },
                      { label: ATTENDANCE.absent.label, value: attendance.absent, tone: 'risk' },
                      { label: ATTENDANCE.excused.label, value: attendance.excused, tone: 'info' },
                    ]}
                  />
                  <p className="mt-2 text-[0.76rem]" style={{ color: 'var(--text-muted)' }}>
                    Excused absences notified to the office in advance are not counted against the rate.
                  </p>
                </div>
              </div>

              <SectionHeading
                title="Attainment by strand"
                description="Each teacher's judgement against the term's standard."
                action={<MasteryScaleLegend className="print:hidden" />}
              />
              <AssessmentTable
                assessments={assessments}
                emptyHint="Your child's teacher has not recorded assessments for this term yet."
              />

              <div className="mt-5">
                <SectionHeading title="Memorization" description={`Target for ${term.title}.`} />
                <MemorizationPanel progress={memorization} standard={memorizationStandard} />
              </div>

              <div className="mt-6 border-t pt-4 text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                <p>
                  Generated {longDate(new Date().toISOString().slice(0, 10))} from the ICF Maktab Tracker.
                  Attainment is recorded against the observable indicators in the An-Nasīḥah syllabus for
                  Grade {student.grade}.
                </p>
                <p className="mt-2 hidden print:block">
                  Signed: ______________________________ (Class teacher) &nbsp;&nbsp;&nbsp;
                  ______________________________ (Maktab Director)
                </p>
              </div>
            </Card>
          );
        }}
      </AsyncSection>
    </>
  );
}
