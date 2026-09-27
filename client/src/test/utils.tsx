import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { AuthContext } from '../auth/AuthContext';
import type { User } from '../lib/types';

export const testUser = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'jane@demo.com',
  name: 'Jane Doe',
  role: 'CUSTOMER',
  createdAt: new Date().toISOString(),
  vendor: null,
  ...overrides,
});

export function renderWithProviders(
  ui: ReactElement,
  { user = null, initializing = false, route = '/' }: { user?: User | null; initializing?: boolean; route?: string } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth = {
    user,
    initializing,
    login: async () => user!,
    register: async () => user!,
    logout: async () => {},
    reloadUser: async () => {},
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
