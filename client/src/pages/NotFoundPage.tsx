import { Compass } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass className="h-6 w-6" />}
      title="Page not found"
      description="The page you’re looking for doesn’t exist or was moved."
      action={<ButtonLink to="/">Go to the shop</ButtonLink>}
    />
  );
}
