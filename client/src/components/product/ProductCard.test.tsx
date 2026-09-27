import { screen } from '@testing-library/react';
import { makeProduct } from '../../test/fixtures';
import { renderWithProviders } from '../../test/utils';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  it('shows title, vendor, INR price and links to the product page', () => {
    renderWithProviders(<ProductCard product={makeProduct()} />);
    expect(screen.getByText('Brass Table Lamp')).toBeInTheDocument();
    expect(screen.getByText('Lumen Co')).toBeInTheDocument();
    expect(screen.getByText('₹2,499.00')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/brass-table-lamp');
  });

  it('flags sold-out and low-stock products', () => {
    const { unmount } = renderWithProviders(<ProductCard product={makeProduct({ stock: 0 })} />);
    expect(screen.getByText('Sold out')).toBeInTheDocument();
    unmount();
    renderWithProviders(<ProductCard product={makeProduct({ stock: 2 })} />);
    expect(screen.getByText('Only 2 left')).toBeInTheDocument();
  });
});
