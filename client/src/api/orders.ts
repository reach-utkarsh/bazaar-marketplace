import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Order, Paginated, PaymentInit } from '../lib/types';

export const orderKeys = {
  list: (page: number) => ['orders', 'list', page] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
};

export function useMyOrders(page: number) {
  return useQuery({
    queryKey: orderKeys.list(page),
    queryFn: () => api<Paginated<Order>>('/orders', { query: { page } }),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: orderKeys.detail(id), queryFn: () => api<Order>(`/orders/${id}`) });
}

export function useResumePayment() {
  return useMutation({ mutationFn: (orderId: string) => api<PaymentInit>(`/orders/${orderId}/payment`, { method: 'POST' }) });
}

function useOrderMutation<V>(fn: (v: V) => Promise<Order>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.detail(order.id), order);
      qc.invalidateQueries({ queryKey: ['orders', 'list'] });
      qc.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}

export const useCancelUnpaidOrder = () => useOrderMutation((orderId: string) => api<Order>(`/orders/${orderId}/cancel`, { method: 'POST' }));

export const useCancelSubOrder = () =>
  useOrderMutation((v: { orderId: string; subOrderId: string; reason?: string }) =>
    api<Order>(`/orders/${v.orderId}/sub-orders/${v.subOrderId}/cancel`, { method: 'POST', body: { reason: v.reason } }),
  );

export const useRequestRefund = () =>
  useOrderMutation((v: { orderId: string; subOrderId: string; reason: string }) =>
    api<Order>(`/orders/${v.orderId}/sub-orders/${v.subOrderId}/refund-requests`, { method: 'POST', body: { reason: v.reason } }),
  );
