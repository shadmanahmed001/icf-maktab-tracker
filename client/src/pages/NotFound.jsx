import { Link } from 'react-router-dom';
import { Button, EmptyState } from '../ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <EmptyState
          title="Page not found"
          description="That link does not lead anywhere in the maktab tracker."
          action={<Button as={Link} to="/" variant="primary">Back to your portal</Button>}
        />
      </div>
    </div>
  );
}
