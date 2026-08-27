/**
 * Reports. The board digest is designed to be printed and read aloud at the
 * weekly Shūrā meeting, so its print layout is a first-class concern rather
 * than an afterthought.
 */
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import {
  AsyncSection, Badge, Button, Card, EmptyState, PageHeader, SectionHeading,
  SegmentedControl, Table, TableWrap, Td, Th, Tr,
} from '../../ui';
import { CompositionBar } from '../../charts';
import { ATTENDANCE, PACING, longDate, mediumDate, percent } from '../../lib/format';

export default function AdminReports() {
  const [report, setReport] = useState('digest');

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Reports"
        description="Printable summaries for the Maktab Board and the office."
        actions={(
          <>
            <SegmentedControl
              ariaLabel="Choose a report"
              value={report}
              onChange={setReport}
              options={[
                { value: 'digest', label: 'Board digest' },
                { value: 'attendance', label: 'Attendance' },
              ]}
            />
            <Button variant="primary" icon={<Printer size={15} />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        )}
      />

      {report === 'digest' ? <BoardDigest /> : <AttendanceReport />}
    </>
  );
}

function BoardDigest() {
  const query = useApi(() => api.admin.boardDigest(), []);

  return (
    <AsyncSection query={query} rows={6}>
      {(data) => (
        <Card>
          {/* Print masthead — only visible on paper */}
          <div className="mb-4 hidden print:block">
            <h1 className="text-lg font-bold">Islamic Center of Fremont — Daily Maktab</h1>
            <p className="text-sm">
              Weekly Standards & Pacing Digest · {data.term.title} · Week beginning {longDate(data.weekOf)}
            </p>
          </div>

          <SectionHeading
            title={`${data.term.title} — pacing digest`}
            description={`Week beginning ${longDate(data.weekOf)}. ${data.term.date_range}.`}
            action={(
              <span className="flex gap-2 print:hidden">
                <Badge tone="ok">{data.totals.onTrack} on track</Badge>
                <Badge tone="warn">{data.totals.watch} need attention</Badge>
                <Badge tone="risk">{data.totals.behind} behind</Badge>
              </span>
            )}
          />

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Class</Th>
                  <Th>Teacher</Th>
                  <Th align="center">Pupils</Th>
                  <Th align="center">Standards</Th>
                  <Th align="center">Coverage</Th>
                  <Th align="center">Expected</Th>
                  <Th align="center">Check-offs</Th>
                  <Th align="center">Attendance</Th>
                  <Th align="center">Status</Th>
                  <Th>Next standard to teach</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const logged = row.week.filter((d) => d.log).length;
                  return (
                    <Tr key={row.classId}>
                      <Td className="whitespace-nowrap font-semibold" style={{ color: 'var(--text-strong)' }}>
                        {row.className}
                      </Td>
                      <Td className="max-w-40 truncate text-[0.78rem]">{row.teachers || '—'}</Td>
                      <Td align="center" className="num">{row.students}</Td>
                      <Td align="center" className="num">{row.covered}/{row.required}</Td>
                      <Td align="center" className="num">{row.completionPercent}%</Td>
                      <Td align="center" className="num" style={{ color: 'var(--text-muted)' }}>{row.expectedPercent}%</Td>
                      <Td align="center" className="num">{logged}/{row.week.length}</Td>
                      <Td align="center" className="num">{percent(row.attendance.rate)}</Td>
                      <Td align="center">
                        <Badge tone={PACING[row.pacingStatus].tone} size="sm">
                          {PACING[row.pacingStatus].label}
                        </Badge>
                      </Td>
                      <Td className="term max-w-64 text-[0.78rem]">{row.nextTopic}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[0.8rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                Attendance across the term
              </p>
              <CompositionBar
                segments={[
                  { label: ATTENDANCE.present.label, value: data.totals.attendance.present, tone: 'ok' },
                  { label: ATTENDANCE.late.label, value: data.totals.attendance.late, tone: 'warn' },
                  { label: ATTENDANCE.absent.label, value: data.totals.attendance.absent, tone: 'risk' },
                  { label: ATTENDANCE.excused.label, value: data.totals.attendance.excused, tone: 'info' },
                ]}
                height={12}
              />
            </div>
            <div>
              <p className="mb-2 text-[0.8rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                Summary for the board
              </p>
              <ul className="space-y-1 text-[0.82rem]" style={{ color: 'var(--text-body)' }}>
                <li>{data.rows.length} classes are running this term.</li>
                <li>
                  {data.totals.onTrack} on track, {data.totals.watch} need attention,{' '}
                  {data.totals.behind} behind pace.
                </li>
                <li>Attendance across the term stands at {percent(data.totals.attendance.rate)}.</li>
              </ul>
            </div>
          </div>

          <p className="mt-5 text-[0.72rem]" style={{ color: 'var(--text-muted)' }}>
            Generated {new Date(data.generatedAt).toLocaleString()} from the ICF Maktab Tracker.
          </p>
        </Card>
      )}
    </AsyncSection>
  );
}

function AttendanceReport() {
  const query = useApi(() => api.admin.attendanceReport(), []);

  return (
    <AsyncSection query={query} rows={6}>
      {(data) => (
        <div className="space-y-5">
          <Card>
            <div className="mb-4 hidden print:block">
              <h1 className="text-lg font-bold">Islamic Center of Fremont — Daily Maktab</h1>
              <p className="text-sm">Attendance report · {longDate(data.from)} to {longDate(data.to)}</p>
            </div>

            <SectionHeading
              title="Attendance by class"
              description={`${mediumDate(data.from)} to ${mediumDate(data.to)} · overall ${percent(data.overall.rate)}`}
            />
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Class</Th>
                    <Th align="center">Rate</Th>
                    <Th align="center">Present</Th>
                    <Th align="center">Late</Th>
                    <Th align="center">Absent</Th>
                    <Th align="center">Excused</Th>
                    <Th>Composition</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.byClass.map((row) => (
                    <Tr key={row.id}>
                      <Td className="whitespace-nowrap font-semibold" style={{ color: 'var(--text-strong)' }}>
                        {row.name}
                      </Td>
                      <Td align="center" className="num font-semibold">{percent(row.summary.rate)}</Td>
                      <Td align="center" className="num">{row.summary.present}</Td>
                      <Td align="center" className="num">{row.summary.late}</Td>
                      <Td align="center" className="num">{row.summary.absent}</Td>
                      <Td align="center" className="num">{row.summary.excused}</Td>
                      <Td className="min-w-44">
                        <CompositionBar
                          showLegend={false}
                          height={8}
                          segments={[
                            { label: 'Present', value: row.summary.present, tone: 'ok' },
                            { label: 'Late', value: row.summary.late, tone: 'warn' },
                            { label: 'Absent', value: row.summary.absent, tone: 'risk' },
                            { label: 'Excused', value: row.summary.excused, tone: 'info' },
                          ]}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          <Card>
            <SectionHeading
              title="Pupils to follow up"
              description="Two or more unexplained absences in this range. Excused absences are not counted."
            />
            {data.concerns.length === 0 ? (
              <EmptyState title="No attendance concerns" description="No pupil has two or more unexplained absences in this range." />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Pupil</Th>
                      <Th>Class</Th>
                      <Th align="center">Absences</Th>
                      <Th align="center">Late arrivals</Th>
                      <Th align="center">Sessions recorded</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.concerns.map((row) => (
                      <Tr key={row.id}>
                        <Td className="font-medium" style={{ color: 'var(--text-strong)' }}>
                          {row.first_name} {row.last_name}
                        </Td>
                        <Td>{row.class_name || '—'}</Td>
                        <Td align="center">
                          <Badge tone={row.absences >= 4 ? 'risk' : 'warn'} size="sm">{row.absences}</Badge>
                        </Td>
                        <Td align="center" className="num">{row.lates}</Td>
                        <Td align="center" className="num">{row.recorded}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>
      )}
    </AsyncSection>
  );
}
