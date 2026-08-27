/** Notices addressed to staff, and to this teacher's class. */
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { AsyncSection, PageHeader } from '../../ui';
import { NoticeFeed } from '../../features/messaging';

export default function TeacherNotices() {
  const query = useApi(() => api.announcements(), []);

  return (
    <>
      <PageHeader
        eyebrow="From the office"
        title="Notices"
        description="Notices for staff and for your class. Parent-only notices are not shown here."
      />
      <AsyncSection query={query} rows={3}>
        {(data) => (
          <NoticeFeed
            notices={data.announcements}
            emptyDescription="Notices posted by the maktab office will appear here."
          />
        )}
      </AsyncSection>
    </>
  );
}
