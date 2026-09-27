import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Paginated, Product, VendorSummary } from '../lib/types';

export interface ProductInput {
  title: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  isActive: boolean;
}

const keys = {
  products: (p: object) => ['vendor', 'products', p] as const,
  product: (id: string) => ['vendor', 'product', id] as const,
};

export function useApplyVendor() {
  return useMutation({
    mutationFn: (body: { storeName: string; description: string }) =>
      api<VendorSummary>('/vendors/apply', { method: 'POST', body }),
  });
}

export function useVendorProducts(params: { search?: string; status?: string; page: number }) {
  return useQuery({
    queryKey: keys.products(params),
    queryFn: () => api<Paginated<Product>>('/vendor/products', { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function useVendorProduct(id: string | undefined) {
  return useQuery({
    queryKey: keys.product(id ?? ''),
    queryFn: () => api<Product>(`/vendor/products/${id}`),
    enabled: !!id,
  });
}

function useInvalidateVendorProducts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['vendor'] });
    qc.invalidateQueries({ queryKey: ['catalog'] });
  };
}

export function useSaveProduct(id?: string) {
  const invalidate = useInvalidateVendorProducts();
  return useMutation({
    mutationFn: (body: Partial<ProductInput>) =>
      id
        ? api<Product>(`/vendor/products/${id}`, { method: 'PATCH', body })
        : api<Product>('/vendor/products', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateVendorProducts();
  return useMutation({
    mutationFn: (id: string) => api<{ deleted: boolean; deactivated: boolean }>(`/vendor/products/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useUploadImages(id: string) {
  const invalidate = useInvalidateVendorProducts();
  return useMutation({
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('images', f));
      return api<Product>(`/vendor/products/${id}/images`, { method: 'POST', formData: fd });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteImage(id: string) {
  const invalidate = useInvalidateVendorProducts();
  return useMutation({
    mutationFn: (imageId: string) => api<Product>(`/vendor/products/${id}/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
