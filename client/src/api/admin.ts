import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Category, Order, Paginated, PaymentStatus, Payout, RefundRequest, RefundStatus, SubOrderStatus, VendorStatus } from '../lib/types';

export interface AdminVendor {
  id: string;
  storeName: string;
  slug: string;
  description: string;
  status: VendorStatus;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  user: { id: string; name: string; email: string };
  _count: { products: number; subOrders: number };
}

export interface AdminOrderRow {
  id: string;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  createdAt: string;
  customer: { id: string; name: string; email: string };
  subOrders: { id: string; status: SubOrderStatus; subtotal: number; vendor: { id: string; storeName: string } }[];
  payment: { provider: string; status: string } | null;
}

export interface AdminRefund extends RefundRequest {
  customer: { id: string; name: string; email: string };
  subOrder: {
    id: string;
    orderId: string;
    status: SubOrderStatus;
    subtotal: number;
    refundedAmount: number;
    deliveredAt: string | null;
    vendor: { id: string; storeName: string };
    items: { id: string; productTitle: string; quantity: number; lineTotal: number }[];
  };
}

export interface EligibleBalance {
  vendorId: string;
  storeName: string;
  amount: number;
  subOrderCount: number;
}

function useAdminMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }) });
}

export const useAdminVendors = (p: { status?: VendorStatus; page: number }) =>
  useQuery({
    queryKey: ['admin', 'vendors', p],
    queryFn: () => api<Paginated<AdminVendor> & { statusCounts: Partial<Record<VendorStatus, number>> }>('/admin/vendors', { query: p }),
    placeholderData: keepPreviousData,
  });
export const useApproveVendor = () => useAdminMutation((id: string) => api(`/admin/vendors/${id}/approve`, { method: 'POST' }));
export const useRejectVendor = () =>
  useAdminMutation((v: { id: string; reason: string }) => api(`/admin/vendors/${v.id}/reject`, { method: 'POST', body: { reason: v.reason } }));

export const useAdminOrders = (p: { paymentStatus?: PaymentStatus; search?: string; page: number }) =>
  useQuery({ queryKey: ['admin', 'orders', p], queryFn: () => api<Paginated<AdminOrderRow>>('/admin/orders', { query: p }), placeholderData: keepPreviousData });
export const useAdminOrder = (id: string | null) =>
  useQuery({ queryKey: ['admin', 'order', id], queryFn: () => api<Order>(`/admin/orders/${id}`), enabled: !!id });

export const useCommission = () =>
  useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<{ commissionRateBps: number }>('/admin/settings') });
export const useSetCommission = () =>
  useAdminMutation((commissionRateBps: number) => api<{ commissionRateBps: number }>('/admin/settings/commission', { method: 'PATCH', body: { commissionRateBps } }));

export const useAdminPayouts = (p: { status?: 'PENDING' | 'PAID'; page: number }) =>
  useQuery({
    queryKey: ['admin', 'payouts', p],
    queryFn: () => api<Paginated<Payout> & { eligible: EligibleBalance[] }>('/admin/payouts', { query: p }),
    placeholderData: keepPreviousData,
  });
export const useGeneratePayouts = () => useAdminMutation(() => api<{ created: Payout[] }>('/admin/payouts/generate', { method: 'POST' }));
export const useMarkPayoutPaid = () =>
  useAdminMutation((v: { id: string; reference?: string }) => api<Payout>(`/admin/payouts/${v.id}/mark-paid`, { method: 'POST', body: { reference: v.reference } }));

export const useAdminRefunds = (p: { status?: RefundStatus; page: number }) =>
  useQuery({ queryKey: ['admin', 'refunds', p], queryFn: () => api<Paginated<AdminRefund>>('/admin/refunds', { query: p }), placeholderData: keepPreviousData });
export const useApproveRefund = () =>
  useAdminMutation((v: { id: string; note?: string }) => api(`/admin/refunds/${v.id}/approve`, { method: 'POST', body: { note: v.note } }));
export const useRejectRefund = () =>
  useAdminMutation((v: { id: string; note: string }) => api(`/admin/refunds/${v.id}/reject`, { method: 'POST', body: { note: v.note } }));

function useCategoryMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }) });
}
export const useCreateCategory = () => useCategoryMutation((name: string) => api<Category>('/admin/categories', { method: 'POST', body: { name } }));
export const useRenameCategory = () =>
  useCategoryMutation((v: { id: string; name: string }) => api<Category>(`/admin/categories/${v.id}`, { method: 'PATCH', body: { name: v.name } }));
export const useDeleteCategory = () => useCategoryMutation((id: string) => api(`/admin/categories/${id}`, { method: 'DELETE' }));
