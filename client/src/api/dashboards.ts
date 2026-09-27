import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Payout } from '../lib/types';

export interface DailyPoint {
  date: string;
  sales: number;
  commission: number;
  orders: number;
}

export interface VendorAnalytics {
  rangeDays: number;
  allTime: { sales: number; earnings: number; commission: number; orders: number };
  range: { sales: number; earnings: number; commission: number; orders: number; unitsSold: number; avgOrderValue: number };
  pendingOrders: { placed: number; packed: number; shipped: number };
  daily: DailyPoint[];
  topProducts: { productId: string; title: string; units: number; revenue: number }[];
  lowStock: { id: string; title: string; stock: number }[];
}

export interface VendorPayouts {
  summary: { lifetimeEarnings: number; paidOut: number; pendingPayout: number; availableForPayout: number; inReturnWindow: number; inProgress: number };
  returnWindowDays: number;
  commissionRateBps: number;
  payouts: Payout[];
}

export interface PlatformDashboard {
  rangeDays: number;
  commissionRateBps: number;
  allTime: { sales: number; commission: number; orders: number };
  range: { sales: number; commission: number; orders: number; avgOrderValue: number };
  counts: { customers: number; approvedVendors: number; pendingVendors: number; pendingRefunds: number; pendingPayouts: number; pendingPayoutAmount: number };
  daily: DailyPoint[];
  topVendors: { vendorId: string; storeName: string; sales: number; orders: number }[];
  recentOrders: { id: string; totalAmount: number; paidAt: string; customer: { name: string }; _count: { subOrders: number } }[];
}

export const useVendorAnalytics = (days: number) =>
  useQuery({ queryKey: ['vendor', 'analytics', days], queryFn: () => api<VendorAnalytics>('/vendor/analytics', { query: { days } }) });

export const useVendorPayouts = () => useQuery({ queryKey: ['vendor', 'payouts'], queryFn: () => api<VendorPayouts>('/vendor/payouts') });

export const usePlatformDashboard = (days: number) =>
  useQuery({ queryKey: ['admin', 'dashboard', days], queryFn: () => api<PlatformDashboard>('/admin/dashboard', { query: { days } }) });
