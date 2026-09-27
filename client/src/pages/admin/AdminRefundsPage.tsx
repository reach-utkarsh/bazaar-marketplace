import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAdminRefunds, useApproveRefund, useRejectRefund, type AdminRefund } from '../../api/admin';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { Tabs } from '../../components/ui/Tabs';
import { formatDateTime, formatMoney, shortId } from '../../lib/format';
import type { RefundStatus } from '../../lib/types';

export default function AdminRefundsPage() {
  const [status, setStatus] = useState<RefundStatus | undefined>('REQUESTED');
  const [page, setPage] = useState(1);
  const refunds = useAdminRefunds({ status, page });
  const approve = useApproveRefund();
  const reject = useRejectRefund();
  const [deciding, setDeciding] = useState<{ r: AdminRefund; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');

  const submit = async () => {
    if (!deciding) return;
    if (deciding.action === 'approve') {
      await approve.mutateAsync({ id: deciding.r.id, note: note.trim() || undefined });
      toast.success(`Refunded ${formatMoney(deciding.r.amount)}`);
    } else {
      await reject.mutateAsync({ id: deciding.r.id, note: note.trim() });
      toast.success('Refund request rejected');
    }
    setDeciding(null);
  };

  return (
    <>
      <PageHeader title="Refund requests" description="Approving issues the refund through the payment gateway immediately." />
      <Tabs
        tabs={[
          { value: 'REQUESTED' as RefundStatus | undefined, label: 'Open' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: undefined, label: 'All' },
        ]}
        value={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
      />
      {refunds.isPending ? (
        <PageLoader />
      ) : refunds.isError ? (
        <ErrorState error={refunds.error} onRetry={() => refunds.refetch()} />
      ) : refunds.data.items.length === 0 ? (
        <EmptyState icon={<Undo2 className="h-6 w-6" />} title={status === 'REQUESTED' ? 'No open refund requests' : 'Nothing here'} />
      ) : (
        <div className="space-y-3">
          {refunds.data.items.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{formatMoney(r.amount)}</span>
                    <StatusBadge status={r.status} label={r.status === 'REQUESTED' ? 'Open' : undefined} />
                    <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {r.customer.name} ({r.customer.email}) · {r.subOrder.vendor.storeName} · shipment {shortId(r.subOrder.id)} ({r.subOrder.status.toLowerCase()})
                  </p>
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">“{r.reason}”</p>
                  <p className="mt-2 text-xs text-slate-500">{r.subOrder.items.map((i) => `${i.quantity} × ${i.productTitle}`).join(', ')}</p>
                  {r.adminNote && <p className="mt-1 text-xs text-slate-600">Note: {r.adminNote}</p>}
                </div>
                {r.status === 'REQUESTED' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="success" onClick={() => { setDeciding({ r, action: 'approve' }); setNote(''); }}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setDeciding({ r, action: 'reject' }); setNote(''); }}>Reject</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {refunds.data && <Pagination page={page} totalPages={refunds.data.totalPages} onChange={setPage} />}
      <Modal
        open={!!deciding}
        onClose={() => setDeciding(null)}
        title={deciding?.action === 'approve' ? `Refund ${formatMoney(deciding.r.amount)}?` : 'Reject refund request?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeciding(null)}>Cancel</Button>
            <Button
              variant={deciding?.action === 'approve' ? 'success' : 'danger'}
              loading={approve.isPending || reject.isPending}
              disabled={deciding?.action === 'reject' && note.trim().length < 5}
              onClick={submit}
            >
              {deciding?.action === 'approve' ? 'Issue refund' : 'Reject'}
            </Button>
          </>
        }
      >
        <Textarea
          label={deciding?.action === 'approve' ? 'Note to customer (optional)' : 'Reason (sent to the customer)'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </Modal>
    </>
  );
}
