import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { makeProduct } from '../../test/fixtures';
import { renderWithProviders, testUser } from '../../test/utils';
import { AddToCart } from './AddToCart';

describe('AddToCart', () => {
  it('sends anonymous shoppers to login with a redirect back', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/products/:slug" element={<AddToCart product={makeProduct()} />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>,
      { route: '/products/brass-table-lamp' },
    );
    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('caps the quantity stepper at available stock', async () => {
    renderWithProviders(<AddToCart product={makeProduct({ stock: 2 })} />, { user: testUser() });
    const inc = screen.getByRole('button', { name: /increase quantity/i });
    await userEvent.click(inc);
    expect(screen.getByLabelText('Quantity')).toHaveTextContent('2');
    expect(inc).toBeDisabled();
  });

  it('disables buying when sold out', () => {
    renderWithProviders(<AddToCart product={makeProduct({ stock: 0 })} />, { user: testUser() });
    expect(screen.getByRole('button', { name: /sold out/i })).toBeDisabled();
  });

  it('tells vendors and admins to use a customer account', () => {
    renderWithProviders(<AddToCart product={makeProduct()} />, { user: testUser({ role: 'ADMIN' }) });
    expect(screen.getByText(/customer account/i)).toBeInTheDocument();
  });
});
