import { LayoutDashboard, Settings, ShoppingBag, Store, Tags, Undo2, Wallet } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';

const items = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/vendors', label: 'Vendors', icon: Store },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/refunds', label: 'Refunds', icon: Undo2 },
  { to: '/admin/payouts', label: 'Payouts', icon: Wallet },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  return <DashboardLayout title="Admin" items={items} />;
}

