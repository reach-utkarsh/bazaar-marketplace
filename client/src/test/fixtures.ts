import type { Product } from '../lib/types';

export const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  title: 'Brass Table Lamp',
  slug: 'brass-table-lamp',
  description: 'Warm light',
  price: 249_900,
  stock: 10,
  isActive: true,
  avgRating: 4.5,
  reviewCount: 12,
  createdAt: new Date().toISOString(),
  categoryId: 'c1',
  category: { id: 'c1', name: 'Home', slug: 'home' },
  vendor: { id: 'v1', storeName: 'Lumen Co', slug: 'lumen-co' },
  images: [],
  ...overrides,
});

export function mockFetch(routes: Record<string, unknown>) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const key = Object.keys(routes).find((k) => url.pathname === k);
    if (!key) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'nope' } }), { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
