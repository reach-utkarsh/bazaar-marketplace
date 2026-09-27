import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshSession, session } from '../lib/api';
import type { Session, User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  /** True until the initial silent refresh has completed. */
  initializing: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-fetch the user (e.g. after a vendor application changes their status). */
  reloadUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = session.subscribe((s) => setUser(s?.user ?? null));
    refreshSession().finally(() => setInitializing(false));
    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const s = await api<Session>('/auth/login', { method: 'POST', body: { email, password } });
    session.set(s);
    return s.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const s = await api<Session>('/auth/register', { method: 'POST', body: { name, email, password } });
    session.set(s);
    return s.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      session.set(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const reloadUser = useCallback(async () => {
    // A refresh re-issues the access token with the user's current role.
    await refreshSession();
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, register, logout, reloadUser }),
    [user, initializing, login, register, logout, reloadUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
