/** One student's full record, as the office sees it. */
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import {
  AsyncSection, Badge, Button, Card, PageHeader, SectionHeading, Tabs,
} from '../../ui';
import {
  AssessmentTable, AttendanceRecordList, AttendanceSummaryCard,
  MasteryScaleLegend, MemorizationPanel, OverallProgress,
} from '../../features/progress';
import { mediumDate } from '../../lib/format';
import { useState } from 'react';

export default function AdminStudentDetail() {
  const { studentId } = useParams();
  const [termNumber, setTermNumber] = useState(null);
  const query = useApi(
    () => api.admin.studentDetail(studentId, termNumber === null ? {} : { term_number: termNumber }),
    [studentId, termNumber]
  );
  const terms = useApi(() => api.terms(), []);

  return (
    <>
      <Button as={Link} to="/admin/students" variant="ghost" size="sm" icon={<ArrowLeft size={15} />} className="mb-3">
        All students
      </Button>

      <AsyncSection query={query} rows={6}>
        {(data) => {
          const { student, term, assessments, memorization, memorizationStandard, attendance, overall, guardians, attendanceRecent } = data;
          return (
            <>
              <PageHeader
                eyebrow={`${student.student_code} · ${term.title}`}
                title={`${student.first_name} ${student.last_name}`}
                description={[
                  student.class_name,
                  student.room,
                  student.date_of_birth ? `Born ${mediumDate(student.date_of_birth)}` : null,
                  student.is_active ? null : 'Withdrawn',
                ].filter(Boolean).join(' · ')}
                actions={student.class_id ? (
                  <Button as={Link} to={`/admin/classes/${student.class_id}`} variant="secondary" size="sm">
                    View class
                  </Button>
                ) : null}
              />

              {terms.data?.terms?.length ? (
                <div className="mb-4">
                  <Tabs
                    value={termNumber ?? term.term_number}
                    onChange={setTermNumber}
                    tabs={terms.data.terms.map((t) => ({ value: t.term_number, label: t.title }))}
                  />
                </div>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-3">
                <Card>
                  <SectionHeading title="Overall progress" />
                  <OverallProgress overall={overall} />
                </Card>

                <Card className="lg:col-span-2">
                  <SectionHeading title="Guardians" description="Who can see this child in the family portal." />
                  {guardians.length === 0 ? (
                    <p className="text-[0.82rem]" style={{ color: 'var(--warn-ink)' }}>
                      No guardian is linked — this family cannot see their child&rsquo;s progress yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {guardians.map((g) => (
                        <li
                          key={g.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                          style={{ background: 'var(--surface-sunken)' }}
                        >
                          <div className="min-w-0">
                            <p className="text-[0.85rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                              {g.full_name}
                              <Badge tone={g.is_primary ? 'accent' : 'neutral'} size="sm" className="ml-2">
                                {g.relationship}
                              </Badge>
                            </p>
                            <p className="flex flex-wrap gap-3 text-[0.76rem]" style={{ color: 'var(--text-muted)' }}>
                              <span className="flex items-center gap-1"><Mail size={12} />{g.email}</span>
                              {g.phone && <span className="flex items-center gap-1"><Phone size={12} />{g.phone}</span>}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {student.notes && (
                    <div className="mt-4 rounded-lg px-3 py-2.5" style={{ background: 'var(--warn-soft)' }}>
                      <p className="text-[0.74rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--warn-ink)' }}>
                        Staff note
                      </p>
                      <p className="text-[0.82rem]" style={{ color: 'var(--warn-ink)' }}>{student.notes}</p>
                    </div>
                  )}
                </Card>
              </div>

              <Card className="mt-5">
                <SectionHeading
                  title={`Progress — ${term.title}`}
                  description="One judgment per subject, recorded by the class teacher."
                  action={<MasteryScaleLegend />}
                />
                <AssessmentTable assessments={assessments} />
              </Card>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <Card>
                  <SectionHeading title="Memorization" description={`Target for ${term.title}.`} />
                  <MemorizationPanel progress={memorization} standard={memorizationStandard} />
                </Card>

                <AttendanceSummaryCard summary={attendance} description={`Across ${term.title}.`} />
              </div>

              <Card className="mt-5">
                <SectionHeading title="Recent attendance" description="Last 30 recorded sessions." />
                <AttendanceRecordList records={attendanceRecent} />
              </Card>
            </>
          );
        }}
      </AsyncSection>
    </>
  );
}
