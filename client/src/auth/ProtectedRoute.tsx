import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { PageLoader } from '../components/ui/Spinner';
import type { Role } from '../lib/types';
import ForbiddenPage from '../pages/ForbiddenPage';
import { useAuth } from './AuthContext';

interface Props {
  children: ReactNode;
  roles?: Role[];
  /** Vendor dashboard: the vendor record must be APPROVED (checked again on the server). */
  approvedVendor?: boolean;
}

export default function ProtectedRoute({ children, roles, approvedVendor }: Props) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <PageLoader />;
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (approvedVendor && user.vendor?.status !== 'APPROVED') {
    return <Navigate to="/sell" replace />;
  }
  if (roles && !roles.includes(user.role)) return <ForbiddenPage />;
  return <>{children}</>;
}
