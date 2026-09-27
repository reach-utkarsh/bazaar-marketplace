import { Wallet } from 'lucide-react';
import { useVendorPayouts } from '../../api/dashboards';
import { StatusBadge } from '../../components/ui/Badge';
import { Card, CardHeader, PageHeader, StatCard } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { bpsToPercent, formatDate, formatMoney, shortId } from '../../lib/format';

export default function VendorPayoutsPage() {
  const q = useVendorPayouts();
  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { summary: s, payouts, returnWindowDays, commissionRateBps } = q.data;

  return (
    <>
      <PageHeader
        title="Payouts"
        description={`Earnings = item total − platform commission (currently ${bpsToPercent(commissionRateBps)}). Delivered orders become payable ${returnWindowDays} days after delivery.`}
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <StatCard label="Paid out" value={formatMoney(s.paidOut)} hint="Lifetime" />
        <StatCard label="Payout processing" value={formatMoney(s.pendingPayout)} hint="Batched, awaiting transfer" />
        <StatCard label="Ready for next payout" value={formatMoney(s.availableForPayout)} hint="Return window passed" />
        <StatCard label="In return window" value={formatMoney(s.inReturnWindow)} hint={`Delivered < ${returnWindowDays} days ago or under review`} />
        <StatCard label="In progress" value={formatMoney(s.inProgress)} hint="Paid orders not yet delivered" />
        <StatCard label="Lifetime earnings" value={formatMoney(s.lifetimeEarnings)} hint="All delivered orders" />
      </div>
      <Card className="mt-6">
        <CardHeader title="Payout history" />
        {payouts.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Wallet className="h-6 w-6" />} title="No payouts yet" description="Payouts are created by the platform in batches once your earnings are ready." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Payout</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Orders</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-medium">{shortId(p.id)}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(p.createdAt)}</td>
                    <td className="px-5 py-3 text-slate-600">{p._count?.subOrders ?? '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} label={p.status === 'PENDING' ? 'Processing' : `Paid ${p.paidAt ? formatDate(p.paidAt) : ''}`} /></td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.reference ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
