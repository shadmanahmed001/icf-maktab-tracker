/** What to practice at home, and how far the child has got. */
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedChild } from '../../layout/portals';
import { Alert, AsyncSection, Card, DataRow, PageHeader, SectionHeading } from '../../ui';
import { MemorizationPanel } from '../../features/progress';
import { ProgressRing } from '../../charts';

export default function FamilyMemorization() {
  const { selectedId } = useSelectedChild();
  const query = useApi(() => api.parent.child(selectedId), [selectedId], { skip: !selectedId });

  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="Memorization"
        description="The opening track of every lesson: a Sūrah, a Duʿā' and the Names of Allāh set for the term."
      />

      <AsyncSection query={query} rows={5}>
        {(data) => {
          const mastered = (data.memorization || []).filter((m) => m.status === 'mastered').length;
          const inProgress = (data.memorization || []).filter((m) => m.status === 'in_progress').length;

          return (
            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="flex flex-col items-center justify-center">
                <ProgressRing
                  value={Math.round((mastered / 3) * 100)}
                  size={124}
                  tone={mastered === 3 ? 'ok' : mastered === 0 ? 'risk' : 'warn'}
                  label={`${mastered} of 3 mastered`}
                  sublabel={inProgress ? `${inProgress} in progress` : undefined}
                />
              </Card>

              <Card className="lg:col-span-2">
                <SectionHeading
                  title={`This term's target`}
                  description={`${data.term.title} · Grade ${data.student.grade}. Verified by the class teacher.`}
                />
                <MemorizationPanel progress={data.memorization} standard={data.memorizationStandard} />

                <Alert tone="info" className="mt-4">
                  Ten minutes of practice a day is more effective than a long session once a week.
                  Start with the first few āyāt until they are fluent, then add the rest.
                </Alert>
              </Card>

              {data.memorizationStandard && (
                <Card className="lg:col-span-3">
                  <SectionHeading title="The full target, written out" />
                  <dl className="term">
                    <DataRow label="Sūrah">{data.memorizationStandard.surah}</DataRow>
                    <DataRow label="Duʿā'">{data.memorizationStandard.dua}</DataRow>
                    <DataRow label="Names of Allāh">{data.memorizationStandard.names_of_allah}</DataRow>
                  </dl>
                </Card>
              )}
            </div>
          );
        }}
      </AsyncSection>
    </>
  );
}
