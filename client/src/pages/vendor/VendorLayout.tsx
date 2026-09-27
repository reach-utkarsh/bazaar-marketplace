import { LayoutDashboard, Package, ShoppingBag, Wallet } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';

const items = [
  { to: '/vendor', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/vendor/products', label: 'Products', icon: Package },
  { to: '/vendor/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/vendor/payouts', label: 'Payouts', icon: Wallet },
];

export default function VendorLayout() {
  return <DashboardLayout title="Vendor" items={items} />;
}
