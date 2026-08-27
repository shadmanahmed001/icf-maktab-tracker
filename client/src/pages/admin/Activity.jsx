/** The audit trail — who changed what, and when. */
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import {
  AsyncSection, Badge, Card, EmptyState, PageHeader,
  Table, TableWrap, Td, Th, Tr,
} from '../../ui';
import { auditLabel, timeAgo } from '../../lib/format';

/** Failed sign-ins are worth a warning tone; ordinary work is not. */
const toneFor = (action) => {
  if (action === 'auth.login_failed') return 'risk';
  if (action.startsWith('auth.')) return 'neutral';
  if (action.includes('deleted') || action.includes('withdrawn') || action.includes('archived')) return 'warn';
  if (action.includes('password') || action.includes('pin')) return 'info';
  return 'accent';
};

export default function AdminActivity() {
  const query = useApi(() => api.admin.audit({ limit: 150 }), []);

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Activity log"
        description="Every change made in the system, with who made it. Useful when a record looks wrong and you need to know why."
      />

      <AsyncSection query={query} rows={6}>
        {(rows) => (rows.length === 0 ? (
          <EmptyState title="No activity recorded yet" />
        ) : (
          <Card padded={false}>
            <TableWrap className="rounded-xl border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Who</Th>
                    <Th>Action</Th>
                    <Th>Detail</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="whitespace-nowrap text-[0.76rem]" style={{ color: 'var(--text-muted)' }}>
                        {timeAgo(entry.created_at)}
                      </Td>
                      <Td className="whitespace-nowrap font-medium" style={{ color: 'var(--text-strong)' }}>
                        {entry.actor_name}
                      </Td>
                      <Td>
                        <Badge tone={toneFor(entry.action)} size="sm">{auditLabel(entry.action)}</Badge>
                      </Td>
                      <Td className="max-w-80 text-[0.79rem]">
                        {entry.detail || (entry.entity ? `${entry.entity} #${entry.entity_id}` : '—')}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        ))}
      </AsyncSection>
    </>
  );
}
