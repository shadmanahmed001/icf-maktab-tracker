/**
 * "My class" — the three things a teacher looks after, on one screen.
 *
 * Students, the syllabus and homework used to be three separate nav items, which
 * made a teacher hunt for the one they wanted. They are the same subject seen
 * three ways, so they belong behind tabs on one page. The chosen tab lives in
 * the URL, so a link points where it says and a refresh stays put.
 */
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedClass } from '../../layout/portals';
import { PageHeader, Tabs } from '../../ui';

import StudentsPanel from './Roster';
import SyllabusPanel from './Coverage';
import HomeworkPanel from './Homework';

const TABS = [
  { value: 'students', label: 'Students & progress' },
  { value: 'syllabus', label: 'Syllabus coverage' },
  { value: 'homework', label: 'Homework' },
];

export default function TeacherMyClass() {
  const { selectedId, selected } = useSelectedClass();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'students';

  // Counts on the tabs so a teacher can see where the work is without clicking.
  const roster = useApi(() => api.teacher.roster(selectedId), [selectedId], { skip: !selectedId });
  const homework = useApi(() => api.teacher.homework(selectedId), [selectedId], { skip: !selectedId });

  const counts = {
    students: roster.data?.length ?? null,
    syllabus: null,
    homework: homework.data?.length ?? null,
  };

  return (
    <>
      <PageHeader
        eyebrow={selected?.name}
        title="My class"
        description="Your students, how far the syllabus has got, and the homework they have been set."
      />

      <Tabs
        value={tab}
        onChange={(value) => setParams(value === 'students' ? {} : { tab: value }, { replace: true })}
        tabs={TABS.map((t) => ({ ...t, count: counts[t.value] }))}
        className="mb-5"
      />

      {tab === 'students' && <StudentsPanel />}
      {tab === 'syllabus' && <SyllabusPanel />}
      {tab === 'homework' && <HomeworkPanel />}
    </>
  );
}
