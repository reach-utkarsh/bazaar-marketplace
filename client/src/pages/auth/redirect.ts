import type { User } from '../../lib/types';

/** Only allow same-app relative redirects (prevents open redirects). */
export function postLoginPath(user: User, redirect: string | null): string {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) return redirect;
  if (user.role === 'ADMIN') return '/admin';
  if (user.vendor?.status === 'APPROVED') return '/vendor';
  return '/';
}
