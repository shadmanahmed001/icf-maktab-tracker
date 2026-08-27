/** Homework set for the child's class. */
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useSelectedChild } from '../../layout/portals';
import {
  AsyncSection, Badge, Card, EmptyState, PageHeader,
} from '../../ui';
import { mediumDate, todayISO } from '../../lib/format';

export default function FamilyHomework() {
  const { selectedId } = useSelectedChild();
  const query = useApi(() => api.parent.child(selectedId), [selectedId], { skip: !selectedId });
  const today = todayISO();

  return (
    <>
      <PageHeader
        eyebrow="From the maktab"
        title="Homework"
        description="Set by the class teacher. Please help your child complete it before the due date."
      />

      <AsyncSection query={query} rows={4}>
        {(data) => (data.homework.length === 0 ? (
          <EmptyState
            title="No homework set"
            description="Homework set by the class teacher will appear here."
          />
        ) : (
          <div className="space-y-3">
            {data.homework.map((item) => {
              const overdue = item.due_date && item.due_date < today;
              return (
                <Card key={item.id}>
                  <p className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="term text-[0.92rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                      {item.title}
                    </span>
                    <Badge tone="accent" size="sm" className="term">{item.subject}</Badge>
                    {item.due_date && (
                      <Badge tone={overdue ? 'neutral' : 'warn'} size="sm">
                        {overdue ? `Was due ${mediumDate(item.due_date)}` : `Due ${mediumDate(item.due_date)}`}
                      </Badge>
                    )}
                  </p>
                  {item.instructions && (
                    <p className="text-[0.85rem] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                      {item.instructions}
                    </p>
                  )}
                  <p className="mt-2 text-[0.73rem]" style={{ color: 'var(--text-muted)' }}>
                    Set {mediumDate(item.assigned_date)}{item.author ? ` by ${item.author}` : ''}
                  </p>
                </Card>
              );
            })}
          </div>
        ))}
      </AsyncSection>
    </>
  );
}
