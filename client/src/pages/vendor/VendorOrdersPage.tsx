import clsx from 'clsx';
import { Box, CheckCircle2, ChevronDown, ShoppingBag, Truck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useUpdateVendorOrder, useVendorOrders, type VendorSubOrder } from '../../api/vendorOrders';
import { EventLog, ShipmentProgress } from '../../components/orders/Timeline';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { formatDateTime, formatMoney, shortId } from '../../lib/format';
import type { SubOrderStatus } from '../../lib/types';

const TABS: { value?: SubOrderStatus; label: string }[] = [
  { label: 'All' },
  { value: 'PLACED', label: 'To pack' },
  { value: 'PACKED', label: 'To ship' },
  { value: 'SHIPPED', label: 'In transit' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function VendorOrdersPage() {
  const [status, setStatus] = useState<SubOrderStatus | undefined>();
  const [page, setPage] = useState(1);
  const orders = useVendorOrders({ status, page });

  return (
    <>
      <PageHeader title="Orders" description="Only your shipments from paid orders appear here." />
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => {
          const count = t.value ? orders.data?.statusCounts[t.value] : undefined;
          return (
            <button
              key={t.label}
              onClick={() => { setStatus(t.value); setPage(1); }}
              className={clsx('flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm', status === t.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
            >
              {t.label}
              {count ? <span className={clsx('rounded-full px-1.5 text-xs', status === t.value ? 'bg-white/20' : 'bg-slate-100')}>{count}</span> : null}
            </button>
          );
        })}
      </div>
      {orders.isPending ? (
        <PageLoader />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : orders.data.items.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="No orders here" description={status ? 'Nothing in this state right now.' : 'New orders will appear here as soon as customers pay.'} />
      ) : (
        <div className="space-y-3">
          {orders.data.items.map((s) => (
            <VendorOrderCard key={s.id} sub={s} />
          ))}
        </div>
      )}
      {orders.data && <Pagination page={page} totalPages={orders.data.totalPages} onChange={setPage} />}
    </>
  );
}

function VendorOrderCard({ sub }: { sub: VendorSubOrder }) {
  const [open, setOpen] = useState(sub.status === 'PLACED' || sub.status === 'PACKED');
  const [modal, setModal] = useState<'ship' | 'cancel' | null>(null);
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');
  const [reason, setReason] = useState('');
  const update = useUpdateVendorOrder();

  const act = async (body: Parameters<typeof update.mutateAsync>[0], msg: string) => {
    await update.mutateAsync(body);
    toast.success(msg);
    setModal(null);
  };

  const o = sub.order;
  return (
    <Card>
      <button className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{shortId(sub.id)}</span>
            <StatusBadge status={sub.status} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {o.customer.name} · {sub.items.reduce((n, i) => n + i.quantity, 0)} item(s) · paid {o.paidAt ? formatDateTime(o.paidAt) : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatMoney(sub.subtotal)}</p>
          <p className="text-xs text-emerald-700">You earn {formatMoney(sub.vendorEarnings)}</p>
        </div>
        <ChevronDown className={clsx('h-5 w-5 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-100 px-5 py-4">
          <ShipmentProgress subOrder={sub} paid />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ul className="min-w-0 space-y-1 text-sm">
              {sub.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="truncate text-slate-700">{i.quantity} × {i.productTitle}</span>
                  <span className="tabular-nums text-slate-500">{formatMoney(i.lineTotal)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-slate-100 pt-1 text-xs text-slate-500">
                <span>Platform commission ({(sub.commissionRateBps / 100).toFixed(1)}%)</span>
                <span className="tabular-nums">−{formatMoney(sub.commissionAmount)}</span>
              </li>
            </ul>
            <address className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 not-italic">
              <span className="font-medium text-slate-900">{o.shippingName}</span> · {o.shippingPhone}
              <br />
              {o.shippingLine1}{o.shippingLine2 && `, ${o.shippingLine2}`}
              <br />
              {o.shippingCity}, {o.shippingState} {o.shippingPostalCode}
            </address>
          </div>
          {sub.trackingNumber && (
            <p className="text-sm text-slate-600">Tracking <span className="font-mono text-slate-900">{sub.trackingNumber}</span>{sub.carrier && ` · ${sub.carrier}`}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {sub.status === 'PLACED' && (
              <Button size="sm" loading={update.isPending} onClick={() => act({ id: sub.id, status: 'PACKED' }, 'Marked as packed')}>
                <Box className="h-4 w-4" /> Mark packed
              </Button>
            )}
            {sub.status === 'PACKED' && (
              <Button size="sm" onClick={() => setModal('ship')}>
                <Truck className="h-4 w-4" /> Ship order
              </Button>
            )}
            {sub.status === 'SHIPPED' && (
              <Button size="sm" variant="success" loading={update.isPending} onClick={() => act({ id: sub.id, status: 'DELIVERED' }, 'Marked as delivered')}>
                <CheckCircle2 className="h-4 w-4" /> Mark delivered
              </Button>
            )}
            {(sub.status === 'PLACED' || sub.status === 'PACKED') && (
              <Button size="sm" variant="secondary" onClick={() => setModal('cancel')}>
                <XCircle className="h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
          <EventLog subOrder={sub} />
        </div>
      )}

      <Modal
        open={modal === 'ship'}
        onClose={() => setModal(null)}
        title="Ship order"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Back</Button>
            <Button
              loading={update.isPending}
              disabled={tracking.trim().length < 4}
              onClick={() => act({ id: sub.id, status: 'SHIPPED', trackingNumber: tracking.trim(), carrier: carrier.trim() || undefined }, 'Marked as shipped — customer notified')}
            >
              Confirm shipment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. DTDC1234567" />
          <Input label="Carrier (optional)" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. Delhivery, BlueDart" />
        </div>
      </Modal>
      <Modal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        title="Cancel this order?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Back</Button>
            <Button variant="danger" loading={update.isPending} disabled={reason.trim().length < 5} onClick={() => act({ id: sub.id, status: 'CANCELLED', reason: reason.trim() }, 'Order cancelled and refunded')}>
              Cancel & refund
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">Stock will be returned to your inventory and the customer refunded {formatMoney(sub.subtotal)}.</p>
        <Textarea label="Reason shown to the customer" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </Modal>
    </Card>
  );
}
