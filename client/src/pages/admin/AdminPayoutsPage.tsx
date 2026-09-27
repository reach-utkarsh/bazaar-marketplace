import { Banknote, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAdminPayouts, useGeneratePayouts, useMarkPayoutPaid } from '../../api/admin';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { Tabs } from '../../components/ui/Tabs';
import { formatDate, formatMoney, shortId } from '../../lib/format';
import type { Payout } from '../../lib/types';

export default function AdminPayoutsPage() {
  const [status, setStatus] = useState<'PENDING' | 'PAID' | undefined>('PENDING');
  const [page, setPage] = useState(1);
  const payouts = useAdminPayouts({ status, page });
  const generate = useGeneratePayouts();
  const markPaid = useMarkPayoutPaid();
  const [paying, setPaying] = useState<Payout | null>(null);
  const [reference, setReference] = useState('');

  if (payouts.isPending) return <PageLoader />;
  if (payouts.isError) return <ErrorState error={payouts.error} onRetry={() => payouts.refetch()} />;
  const eligibleTotal = payouts.data.eligible.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader title="Payouts" description="Vendor earnings (item total − commission) become payable once delivered orders pass the return window." />
      <Card className="mb-6">
        <CardHeader
          title="Ready to batch"
          description={eligibleTotal ? `${formatMoney(eligibleTotal)} across ${payouts.data.eligible.length} vendor(s)` : 'No earnings are ready for payout right now'}
          action={
            <Button
              disabled={!eligibleTotal}
              loading={generate.isPending}
              onClick={async () => {
                const r = await generate.mutateAsync(undefined);
                toast.success(`Created ${r.created.length} payout(s)`);
              }}
            >
              <Banknote className="h-4 w-4" /> Generate payouts
            </Button>
          }
        />
        {payouts.data.eligible.length > 0 && (
          <ul className="divide-y divide-slate-100 text-sm">
            {payouts.data.eligible.map((e) => (
              <li key={e.vendorId} className="flex justify-between px-5 py-2.5">
                <span className="text-slate-700">{e.storeName} <span className="text-xs text-slate-500">· {e.subOrderCount} order(s)</span></span>
                <span className="font-medium tabular-nums">{formatMoney(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Tabs
        tabs={[
          { value: 'PENDING' as 'PENDING' | 'PAID' | undefined, label: 'To send' },
          { value: 'PAID', label: 'Paid' },
          { value: undefined, label: 'All' },
        ]}
        value={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
      />
      {payouts.data.items.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="No payouts here" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Payout</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{shortId(p.id)}</p>
                      <p className="text-xs text-slate-500">{formatDate(p.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">{p.vendor?.storeName}</td>
                    <td className="px-4 py-3 text-slate-600">{p._count?.subOrders}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} label={p.status === 'PENDING' ? 'To send' : 'Paid'} />
                      {p.reference && <p className="mt-0.5 font-mono text-xs text-slate-500">{p.reference}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(p.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'PENDING' && (
                        <Button size="sm" variant="success" onClick={() => { setPaying(p); setReference(''); }}>Mark paid</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Pagination page={page} totalPages={payouts.data.totalPages} onChange={setPage} />
      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        title={`Mark ${paying ? formatMoney(paying.amount) : ''} as paid?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaying(null)}>Cancel</Button>
            <Button
              variant="success"
              loading={markPaid.isPending}
              onClick={async () => {
                await markPaid.mutateAsync({ id: paying!.id, reference: reference.trim() || undefined });
                toast.success('Payout marked as paid — vendor notified');
                setPaying(null);
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">Confirm you have transferred this amount to {paying?.vendor?.storeName}.</p>
        <Input label="Bank reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. NEFT/UTR number" />
      </Modal>
    </>
  );
}
