import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeProduct, mockFetch } from '../../test/fixtures';
import { renderWithProviders } from '../../test/utils';
import { CatalogBrowser } from './CatalogBrowser';

afterEach(() => vi.unstubAllGlobals());

const page = (items: ReturnType<typeof makeProduct>[]) => ({ items, page: 1, limit: 12, total: items.length, totalPages: 1 });

describe('CatalogBrowser', () => {
  it('renders products from the API', async () => {
    mockFetch({
      '/api/categories': { items: [{ id: 'c1', name: 'Home', slug: 'home', productCount: 2 }] },
      '/api/products': page([makeProduct(), makeProduct({ id: 'p2', slug: 'rug', title: 'Jute Rug' })]),
    });
    renderWithProviders(<CatalogBrowser />);
    expect(await screen.findByText('Jute Rug')).toBeInTheDocument();
    expect(screen.getByText('Brass Table Lamp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Home/ })).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    mockFetch({ '/api/categories': { items: [] }, '/api/products': page([]) });
    renderWithProviders(<CatalogBrowser />, { route: '/?search=zzz' });
    expect(await screen.findByText('No products found')).toBeInTheDocument();
  });

  it('sends the selected sort to the API', async () => {
    const fetchMock = mockFetch({ '/api/categories': { items: [] }, '/api/products': page([makeProduct()]) });
    renderWithProviders(<CatalogBrowser />);
    await screen.findByText('Brass Table Lamp');
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'price_asc');
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('/api/products') && u.includes('sort=price_asc'))).toBe(true);
    });
  });

  it('shows an error state when the API fails', async () => {
    mockFetch({ '/api/categories': { items: [] } });
    renderWithProviders(<CatalogBrowser />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t load/i);
  });
});
