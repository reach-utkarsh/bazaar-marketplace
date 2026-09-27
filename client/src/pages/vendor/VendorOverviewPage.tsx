import { AlertTriangle, Box, ClipboardList, IndianRupee, ShoppingBag, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useVendorAnalytics } from '../../api/dashboards';
import { useAuth } from '../../auth/AuthContext';
import { RankedBars } from '../../components/charts/RankedBars';
import { TrendChart } from '../../components/charts/TrendChart';
import { Card, CardHeader, PageHeader, StatCard } from '../../components/ui/Card';
import { RangePicker } from '../../components/ui/RangePicker';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { formatMoney } from '../../lib/format';

export default function VendorOverviewPage() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const q = useVendorAnalytics(days);

  return (
    <>
      <PageHeader title={user?.vendor?.storeName ?? 'Overview'} description="How your store is doing." action={<RangePicker value={days} onChange={setDays} />} />
      {q.isPending ? (
        <PageLoader />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label={`Sales · ${days}d`} value={formatMoney(q.data.range.sales)} hint={`${q.data.range.orders} orders`} icon={<IndianRupee className="h-4 w-4" />} />
            <StatCard label={`Your earnings · ${days}d`} value={formatMoney(q.data.range.earnings)} hint="After platform commission" icon={<IndianRupee className="h-4 w-4" />} />
            <StatCard label="Avg. order value" value={formatMoney(q.data.range.avgOrderValue)} hint={`${q.data.range.unitsSold} units sold`} icon={<ShoppingBag className="h-4 w-4" />} />
            <StatCard label="All-time earnings" value={formatMoney(q.data.allTime.earnings)} hint={`${q.data.allTime.orders} orders`} icon={<IndianRupee className="h-4 w-4" />} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Daily sales" description={`Net of cancellations and refunds · last ${days} days`} />
              <div className="p-4">
                <TrendChart data={q.data.daily.map((d) => ({ date: d.date, value: d.sales }))} valueLabel="Sales" />
              </div>
            </Card>
            <Card>
              <CardHeader title="Needs your attention" />
              <ul className="divide-y divide-slate-100">
                <PendingRow icon={<ClipboardList className="h-4 w-4" />} label="To pack" count={q.data.pendingOrders.placed} />
                <PendingRow icon={<Box className="h-4 w-4" />} label="To ship" count={q.data.pendingOrders.packed} />
                <PendingRow icon={<Truck className="h-4 w-4" />} label="In transit" count={q.data.pendingOrders.shipped} />
              </ul>
              {q.data.lowStock.length > 0 && (
                <div className="border-t border-slate-100 px-5 py-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-700">
                    <AlertTriangle className="h-4 w-4" /> Low stock
                  </p>
                  <ul className="space-y-1 text-sm">
                    {q.data.lowStock.map((p) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <Link to={`/vendor/products/${p.id}`} className="truncate text-slate-700 hover:text-brand-700">{p.title}</Link>
                        <span className="font-medium text-slate-900 tabular-nums">{p.stock} left</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="Top products" description={`By revenue · last ${days} days`} />
            <div className="p-5">
              <RankedBars
                items={q.data.topProducts.map((p) => ({ key: p.productId, label: p.title, value: p.revenue, display: formatMoney(p.revenue), sub: `${p.units} sold` }))}
                empty="No sales in this period yet"
              />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function PendingRow({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <li>
      <Link to="/vendor/orders" className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
        <span className="text-slate-400">{icon}</span>
        <span className="flex-1 text-slate-700">{label}</span>
        <span className="text-lg font-semibold text-slate-900 tabular-nums">{count}</span>
      </Link>
    </li>
  );
}
