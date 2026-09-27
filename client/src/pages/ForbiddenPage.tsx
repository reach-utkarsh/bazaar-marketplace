import { ShieldAlert } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export default function ForbiddenPage() {
  return (
    <EmptyState
      icon={<ShieldAlert className="h-6 w-6" />}
      title="You don’t have access to this page"
      description="Your account role doesn’t allow this area."
      action={<ButtonLink to="/">Back to shop</ButtonLink>}
    />
  );
}
