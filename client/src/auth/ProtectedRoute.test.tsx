import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { renderWithProviders, testUser } from '../test/utils';
import ProtectedRoute from './ProtectedRoute';

function setup(opts: Parameters<typeof renderWithProviders>[1], roles?: ('CUSTOMER' | 'VENDOR' | 'ADMIN')[]) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>Login page</p>} />
      <Route path="/sell" element={<p>Sell page</p>} />
      <Route
        path="/secret"
        element={
          <ProtectedRoute roles={roles}>
            <p>Secret content</p>
          </ProtectedRoute>
        }
      />
    </Routes>,
    { route: '/secret', ...opts },
  );
}

describe('ProtectedRoute', () => {
  it('shows a loader while the session is being restored', () => {
    setup({ initializing: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('redirects anonymous users to login', () => {
    setup({ user: null });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders children for an allowed role', () => {
    setup({ user: testUser({ role: 'ADMIN' }) }, ['ADMIN']);
    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('shows a forbidden message for the wrong role', () => {
    setup({ user: testUser({ role: 'CUSTOMER' }) }, ['ADMIN']);
    expect(screen.getByText(/don’t have access/i)).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('sends unapproved vendors to the application page', () => {
    renderWithProviders(
      <Routes>
        <Route path="/sell" element={<p>Sell page</p>} />
        <Route
          path="/vendor"
          element={
            <ProtectedRoute approvedVendor>
              <p>Dashboard</p>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { route: '/vendor', user: testUser({ vendor: { id: 'v', storeName: 'S', slug: 's', status: 'PENDING' } }) },
    );
    expect(screen.getByText('Sell page')).toBeInTheDocument();
  });
});
