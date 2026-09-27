import { Check, Store, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useAdminVendors, useApproveVendor, useRejectVendor, type AdminVendor } from '../../api/admin';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { Tabs } from '../../components/ui/Tabs';
import { formatDate } from '../../lib/format';
import type { VendorStatus } from '../../lib/types';

export default function AdminVendorsPage() {
  const [status, setStatus] = useState<VendorStatus | undefined>('PENDING');
  const [page, setPage] = useState(1);
  const vendors = useAdminVendors({ status, page });
  const approve = useApproveVendor();
  const reject = useRejectVendor();
  const [rejecting, setRejecting] = useState<AdminVendor | null>(null);
  const [reason, setReason] = useState('');

  return (
    <>
      <PageHeader title="Vendors" description="Review applications and manage sellers." />
      <Tabs
        tabs={[
          { value: 'PENDING' as VendorStatus | undefined, label: 'Pending' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: undefined, label: 'All' },
        ]}
        value={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
        counts={vendors.data?.statusCounts}
      />
      {vendors.isPending ? (
        <PageLoader />
      ) : vendors.isError ? (
        <ErrorState error={vendors.error} onRetry={() => vendors.refetch()} />
      ) : vendors.data.items.length === 0 ? (
        <EmptyState icon={<Store className="h-6 w-6" />} title={status === 'PENDING' ? 'No applications waiting' : 'No vendors here'} description={status === 'PENDING' ? 'You’re all caught up.' : undefined} />
      ) : (
        <div className="space-y-3">
          {vendors.data.items.map((v) => (
            <Card key={v.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {v.status === 'APPROVED' ? <Link to={`/stores/${v.slug}`} className="hover:text-brand-700">{v.storeName}</Link> : v.storeName}
                    </h3>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {v.user.name} · {v.user.email} · applied {formatDate(v.createdAt)}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{v.description}</p>
                  {v.rejectionReason && <p className="mt-2 text-sm text-rose-700">Rejected: {v.rejectionReason}</p>}
                  {v.status === 'APPROVED' && (
                    <p className="mt-2 text-xs text-slate-500">{v._count.products} products · {v._count.subOrders} orders</p>
                  )}
                </div>
                {v.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      loading={approve.isPending && approve.variables === v.id}
                      onClick={async () => {
                        await approve.mutateAsync(v.id);
                        toast.success(`${v.storeName} approved`);
                      }}
                    >
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => { setRejecting(v); setReason(''); }}>
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {vendors.data && <Pagination page={page} totalPages={vendors.data.totalPages} onChange={setPage} />}
      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.storeName}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 5}
              loading={reject.isPending}
              onClick={async () => {
                await reject.mutateAsync({ id: rejecting!.id, reason: reason.trim() });
                toast.success('Application rejected');
                setRejecting(null);
              }}
            >
              Reject
            </Button>
          </>
        }
      >
        <Textarea label="Reason (sent to the applicant)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} hint="At least 5 characters. They can re-apply." />
      </Modal>
    </>
  );
}
