import { AlertCircle, IndianRupee, Percent, ShoppingBag, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePlatformDashboard } from '../../api/dashboards';
import { RankedBars } from '../../components/charts/RankedBars';
import { TrendChart } from '../../components/charts/TrendChart';
import { Card, CardHeader, PageHeader, StatCard } from '../../components/ui/Card';
import { RangePicker } from '../../components/ui/RangePicker';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { bpsToPercent, formatDateTime, formatMoney, shortId } from '../../lib/format';

export default function AdminDashboardPage() {
  const [days, setDays] = useState(30);
  const q = usePlatformDashboard(days);

  return (
    <>
      <PageHeader title="Platform overview" description="Sales are net of cancellations and refunds." action={<RangePicker value={days} onChange={setDays} />} />
      {q.isPending ? (
        <PageLoader />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label={`GMV · ${days}d`} value={formatMoney(q.data.range.sales)} hint={`${q.data.range.orders} vendor orders`} icon={<IndianRupee className="h-4 w-4" />} />
            <StatCard label={`Commission · ${days}d`} value={formatMoney(q.data.range.commission)} hint={`Current rate ${bpsToPercent(q.data.commissionRateBps)}`} icon={<Percent className="h-4 w-4" />} />
            <StatCard label="All-time GMV" value={formatMoney(q.data.allTime.sales)} hint={`${formatMoney(q.data.allTime.commission)} commission`} icon={<ShoppingBag className="h-4 w-4" />} />
            <StatCard label="Customers" value={q.data.counts.customers} hint={`${q.data.counts.approvedVendors} active vendors`} icon={<Users className="h-4 w-4" />} />
          </div>

          {(q.data.counts.pendingVendors > 0 || q.data.counts.pendingRefunds > 0 || q.data.counts.pendingPayouts > 0) && (
            <div className="flex flex-wrap gap-3">
              {q.data.counts.pendingVendors > 0 && <Alert to="/admin/vendors" text={`${q.data.counts.pendingVendors} vendor application(s) to review`} />}
              {q.data.counts.pendingRefunds > 0 && <Alert to="/admin/refunds" text={`${q.data.counts.pendingRefunds} refund request(s) waiting`} />}
              {q.data.counts.pendingPayouts > 0 && (
                <Alert to="/admin/payouts" text={`${q.data.counts.pendingPayouts} payout(s) to send · ${formatMoney(q.data.counts.pendingPayoutAmount)}`} />
              )}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Daily GMV" description={`Gross merchandise value · last ${days} days`} />
              <div className="p-4">
                <TrendChart data={q.data.daily.map((d) => ({ date: d.date, value: d.sales }))} valueLabel="GMV" />
              </div>
            </Card>
            <Card>
              <CardHeader title="Daily commission" description={`Platform revenue · last ${days} days`} />
              <div className="p-4">
                <TrendChart data={q.data.daily.map((d) => ({ date: d.date, value: d.commission }))} valueLabel="Commission" color="#0d9488" />
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Top vendors" description={`By GMV · last ${days} days`} />
              <div className="p-5">
                <RankedBars
                  items={q.data.topVendors.map((v) => ({ key: v.vendorId, label: v.storeName, value: v.sales, display: formatMoney(v.sales), sub: `${v.orders} orders` }))}
                  empty="No sales in this period"
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Recent paid orders" action={<Link to="/admin/orders" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>} />
              <ul className="divide-y divide-slate-100">
                {q.data.recentOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{shortId(o.id)} · {o.customer.name}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(o.paidAt)} · {o._count.subOrders} vendor(s)</p>
                    </div>
                    <span className="font-semibold tabular-nums">{formatMoney(o.totalAmount)}</span>
                  </li>
                ))}
                {q.data.recentOrders.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">No orders yet</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function Alert({ to, text }: { to: string; text: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">
      <AlertCircle className="h-4 w-4" /> {text}
    </Link>
  );
}

