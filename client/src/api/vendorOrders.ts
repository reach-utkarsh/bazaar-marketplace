import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Address, Paginated, SubOrder, SubOrderStatus } from '../lib/types';

export interface VendorSubOrder extends SubOrder {
  order: Address & { id: string; createdAt: string; paidAt: string | null; customer: { name: string } };
}

export type VendorOrderList = Paginated<VendorSubOrder> & { statusCounts: Partial<Record<SubOrderStatus, number>> };

export type StatusUpdate =
  | { status: 'PACKED' | 'DELIVERED'; note?: string }
  | { status: 'SHIPPED'; trackingNumber: string; carrier?: string }
  | { status: 'CANCELLED'; reason: string };

export function useVendorOrders(params: { status?: SubOrderStatus; page: number }) {
  return useQuery({
    queryKey: ['vendor', 'orders', params],
    queryFn: () => api<VendorOrderList>('/vendor/orders', { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateVendorOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: StatusUpdate & { id: string }) => api<VendorSubOrder>(`/vendor/orders/${id}/status`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor'] }),
  });
}
