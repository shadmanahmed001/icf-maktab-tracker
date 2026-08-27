/** The class roll with each pupil's standing at a glance. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedClass } from '../../layout/portals';
import {
  AsyncSection, Badge, Card, EmptyState, SearchInput,
  Table, TableWrap, Td, Th, Tr, Avatar,
} from '../../ui';
import { BandDistribution } from '../../charts';
import { percent, pluralise } from '../../lib/format';

export default function PupilsPanel() {
  const { selectedId } = useSelectedClass();
  const [search, setSearch] = useState('');
  const query = useApi(() => api.teacher.roster(selectedId), [selectedId], { skip: !selectedId });

  return (
    <>
      <div className="mb-4 max-w-xs">
        <SearchInput value={search} onChange={setSearch} placeholder="Search pupil…" />
      </div>

      <AsyncSection query={query} rows={6}>
        {(roster) => {
          const needle = search.trim().toLowerCase();
          const filtered = needle
            ? roster.filter((s) => `${s.first_name} ${s.last_name} ${s.student_code}`.toLowerCase().includes(needle))
            : roster;

          if (!roster.length) {
            return <EmptyState title="No pupils enrolled" description="Ask the office to enrol pupils into this class." />;
          }

          const assessedTotal = roster.reduce((sum, s) => sum + s.assessedCount, 0);
          const lowAttendance = roster.filter((s) => (s.attendanceRate ?? 100) < 85);

          return (
            <>
              <div className="mb-5 grid gap-4 lg:grid-cols-2">
                <Card>
                  <p className="mb-2 text-[0.8rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                    Memorization mastered, by pupil count
                  </p>
                  <BandDistribution
                    bands={[0, 1, 2, 3].map((count) => ({
                      label: count === 3 ? 'All three' : `${count} item${count === 1 ? '' : 's'}`,
                      value: roster.filter((s) => s.memorizedCount === count).length,
                      tone: count === 3 ? 'ok' : count === 0 ? 'risk' : 'warn',
                    }))}
                  />
                  <p className="mt-2 text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                    Sūrah, Duʿā' and Names of Allāh for this term.
                  </p>
                </Card>

                <Card>
                  <p className="mb-2 text-[0.8rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                    Where to look first
                  </p>
                  <ul className="space-y-1.5 text-[0.82rem]" style={{ color: 'var(--text-body)' }}>
                    <li>
                      {pluralise(roster.length, 'pupil')} on the roll,{' '}
                      {pluralise(assessedTotal, 'strand assessment')} recorded.
                    </li>
                    <li>
                      {lowAttendance.length === 0
                        ? 'No pupil is below 85% attendance.'
                        : `${lowAttendance.length} pupil${lowAttendance.length === 1 ? '' : 's'} below 85% attendance: ${
                          lowAttendance.slice(0, 3).map((s) => s.first_name).join(', ')}${lowAttendance.length > 3 ? '…' : ''}`}
                    </li>
                    <li>
                      {(() => {
                        const none = roster.filter((s) => s.memorizedCount === 0).length;
                        if (none === 0) return 'Every pupil has mastered at least one memorization item.';
                        return `${pluralise(none, 'pupil has', 'pupils have')} not yet mastered any `
                          + 'memorization item this term.';
                      })()}
                    </li>
                  </ul>
                </Card>
              </div>

              <Card padded={false}>
                <TableWrap className="rounded-xl border-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Pupil</Th>
                        <Th align="center">Attendance</Th>
                        <Th align="center">Absences</Th>
                        <Th align="center">Strands assessed</Th>
                        <Th align="center">Memorization</Th>
                        <Th>Guardians</Th>
                        <Th align="right" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((student) => (
                        <Tr key={student.id}>
                          <Td>
                            <Link
                              to={`/teacher/roster/${student.id}`}
                              className="flex items-center gap-2.5 font-semibold hover:underline"
                              style={{ color: 'var(--text-strong)' }}
                            >
                              <Avatar name={`${student.first_name} ${student.last_name}`} size={30} />
                              <span>
                                {student.first_name} {student.last_name}
                                <span className="num block text-[0.7rem] font-normal" style={{ color: 'var(--text-muted)' }}>
                                  {student.student_code}
                                </span>
                              </span>
                            </Link>
                          </Td>
                          <Td align="center" className="num">
                            <span style={{
                              color: (student.attendanceRate ?? 100) < 85 ? 'var(--risk-ink)' : 'var(--text-body)',
                              fontWeight: (student.attendanceRate ?? 100) < 85 ? 600 : 400,
                            }}>
                              {percent(student.attendanceRate)}
                            </span>
                          </Td>
                          <Td align="center" className="num">{student.absences}</Td>
                          <Td align="center" className="num">{student.assessedCount}</Td>
                          <Td align="center">
                            <Badge
                              tone={student.memorizedCount === 3 ? 'ok' : student.memorizedCount === 0 ? 'neutral' : 'warn'}
                              size="sm"
                            >
                              {student.memorizedCount}/3
                            </Badge>
                          </Td>
                          <Td className="max-w-52 truncate text-[0.78rem]">
                            {student.guardians.map((g) => g.full_name).join(', ') || (
                              <span style={{ color: 'var(--warn-ink)' }}>None linked</span>
                            )}
                          </Td>
                          <Td align="right">
                            <Link
                              to={`/teacher/roster/${student.id}`}
                              className="inline-flex items-center gap-1 text-[0.78rem] font-semibold hover:underline"
                              style={{ color: 'var(--accent-text)' }}
                            >
                              Open <ChevronRight size={14} />
                            </Link>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </Card>
            </>
          );
        }}
      </AsyncSection>
    </>
  );
}
