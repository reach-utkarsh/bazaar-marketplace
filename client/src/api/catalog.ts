import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Category, Paginated, Product } from '../lib/types';

export interface CatalogParams {
  search?: string;
  category?: string;
  vendor?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (p: CatalogParams) => ['catalog', 'list', p] as const,
  product: (slug: string) => ['catalog', 'product', slug] as const,
  categories: ['categories'] as const,
  store: (slug: string) => ['store', slug] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: () => api<{ items: Category[] }>('/categories').then((r) => r.items),
    staleTime: 5 * 60_000,
  });
}

export function useProducts(params: CatalogParams) {
  return useQuery({
    queryKey: catalogKeys.list(params),
    queryFn: ({ signal }) =>
      api<Paginated<Product>>('/products', { query: { ...params, inStock: params.inStock ? 'true' : undefined }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: catalogKeys.product(slug), queryFn: () => api<Product>(`/products/${slug}`) });
}

export interface Store {
  id: string;
  storeName: string;
  slug: string;
  description: string;
  createdAt: string;
  productCount: number;
  avgRating: number;
}

export function useStore(slug: string) {
  return useQuery({ queryKey: catalogKeys.store(slug), queryFn: () => api<Store>(`/vendors/${slug}`) });
}
