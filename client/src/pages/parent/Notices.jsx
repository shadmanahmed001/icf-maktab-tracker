/** Notices for families, and for the child's class. */
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { AsyncSection, PageHeader } from '../../ui';
import { NoticeFeed } from '../../features/messaging';

export default function FamilyNotices() {
  const query = useApi(() => api.announcements(), []);

  return (
    <>
      <PageHeader
        eyebrow="From the maktab"
        title="Notices"
        description="Announcements from the office and from your child's class."
      />
      <AsyncSection query={query} rows={3}>
        {(data) => (
          <NoticeFeed
            notices={data.announcements}
            emptyDescription="Notices from the maktab will appear here."
          />
        )}
      </AsyncSection>
    </>
  );
}
