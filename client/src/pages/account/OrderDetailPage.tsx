import { ArrowLeft, CheckCircle2, Clock, MapPin, Store } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useCancelSubOrder, useCancelUnpaidOrder, useOrder, useRequestRefund, useResumePayment } from '../../api/orders';
import { EventLog, ShipmentProgress } from '../../components/orders/Timeline';
import { usePaymentFlow } from '../../components/payment/usePaymentFlow';
import { ProductImage } from '../../components/product/ProductImage';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { formatDateTime, formatMoney, shortId } from '../../lib/format';
import type { Order, SubOrder } from '../../lib/types';

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const order = useOrder(id);
  const resume = useResumePayment();
  const cancelOrder = useCancelUnpaidOrder();
  const { pay, dialog } = usePaymentFlow();

  if (order.isPending) return <PageLoader />;
  if (order.isError) return <ErrorState error={order.error} onRetry={() => order.refetch()} />;
  const o = order.data;
  const paid = o.paymentStatus === 'PAID';

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      {params.get('placed') && paid && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Thank you! Your order is confirmed.</p>
            <p className="text-sm">Each seller will pack and ship their part separately. Track every shipment below.</p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order {shortId(o.id)}</h1>
          <p className="text-sm text-slate-500">Placed {formatDateTime(o.createdAt)}</p>
        </div>
        <div className="text-right">
          <StatusBadge status={o.paymentStatus} label={paymentLabel(o)} />
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(o.totalAmount)}</p>
        </div>
      </div>

      {o.paymentStatus === 'PENDING' && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">Awaiting payment</p>
              <p className="text-sm text-amber-800">
                {o.payment?.status === 'FAILED' ? `Last attempt failed${o.payment.failureReason ? `: ${o.payment.failureReason}` : ''}. ` : ''}
                Your items are reserved for a limited time.
              </p>
            </div>
            <Button
              loading={resume.isPending}
              onClick={async () => pay(await resume.mutateAsync(o.id))}
            >
              Pay now
            </Button>
            <Button
              variant="secondary"
              loading={cancelOrder.isPending}
              onClick={async () => {
                await cancelOrder.mutateAsync(o.id);
                toast.success('Order cancelled');
              }}
            >
              Cancel order
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {o.subOrders.map((s) => (
          <SubOrderCard key={s.id} order={o} subOrder={s} paid={paid} />
        ))}
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MapPin className="h-4 w-4 text-slate-400" /> Shipping to
        </h2>
        <address className="text-sm leading-relaxed text-slate-600 not-italic">
          {o.shippingName} · {o.shippingPhone}
          <br />
          {o.shippingLine1}
          {o.shippingLine2 && <>, {o.shippingLine2}</>}
          <br />
          {o.shippingCity}, {o.shippingState} {o.shippingPostalCode}, {o.shippingCountry}
        </address>
      </Card>
      {dialog}
    </div>
  );
}

function paymentLabel(o: Order) {
  switch (o.paymentStatus) {
    case 'PAID':
      return 'Paid';
    case 'PENDING':
      return 'Awaiting payment';
    case 'FAILED':
      return 'Payment failed';
    default:
      return 'Cancelled';
  }
}

function SubOrderCard({ order, subOrder: s, paid }: { order: Order; subOrder: SubOrder; paid: boolean }) {
  const cancel = useCancelSubOrder();
  const refund = useRequestRefund();
  const [modal, setModal] = useState<'cancel' | 'refund' | null>(null);
  const [reason, setReason] = useState('');

  const canCancel = paid && (s.status === 'PLACED' || s.status === 'PACKED');
  const openRefund = s.refundRequests?.find((r) => r.status === 'REQUESTED');
  const canRefund = paid && (s.status === 'SHIPPED' || s.status === 'DELIVERED') && !openRefund && s.refundedAmount < s.subtotal;

  const submit = async () => {
    if (modal === 'cancel') {
      await cancel.mutateAsync({ orderId: order.id, subOrderId: s.id, reason: reason || undefined });
      toast.success('Shipment cancelled — a refund has been issued');
    } else {
      await refund.mutateAsync({ orderId: order.id, subOrderId: s.id, reason });
      toast.success('Refund requested — our team will review it');
    }
    setModal(null);
    setReason('');
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Store className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-slate-900">{s.vendor?.storeName}</span>
          <span className="text-slate-400">· Shipment {shortId(s.id)}</span>
        </div>
        {paid && <StatusBadge status={s.status} />}
      </div>
      <div className="space-y-4 p-5">
        {(paid || s.status === 'CANCELLED') && <ShipmentProgress subOrder={s} paid={paid} />}
        {s.trackingNumber && (
          <p className="text-sm text-slate-600">
            Tracking: <span className="font-mono font-medium text-slate-900">{s.trackingNumber}</span>
            {s.carrier && <> via {s.carrier}</>}
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {s.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2">
              <ProductImage url={i.imageUrl} alt={i.productTitle} className="h-12 w-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                {i.product ? (
                  <Link to={`/products/${i.product.slug}`} className="line-clamp-1 text-sm font-medium text-slate-900 hover:text-brand-700">
                    {i.productTitle}
                  </Link>
                ) : (
                  <p className="line-clamp-1 text-sm font-medium text-slate-900">{i.productTitle}</p>
                )}
                <p className="text-xs text-slate-500">
                  {i.quantity} × {formatMoney(i.unitPrice)}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums">{formatMoney(i.lineTotal)}</p>
            </li>
          ))}
        </ul>
        {s.refundRequests?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">Refund request ({formatMoney(r.amount)}):</span>
            <StatusBadge status={r.status} label={r.status === 'REQUESTED' ? 'Under review' : undefined} />
            {r.adminNote && <span className="text-slate-500">“{r.adminNote}”</span>}
          </div>
        ))}
        {s.refundedAmount > 0 && <p className="text-sm font-medium text-emerald-700">Refunded {formatMoney(s.refundedAmount)}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600">
            Subtotal <span className="font-semibold text-slate-900 tabular-nums">{formatMoney(s.subtotal)}</span>
          </p>
          <div className="flex gap-2">
            {canCancel && (
              <Button variant="secondary" size="sm" onClick={() => setModal('cancel')}>
                Cancel shipment
              </Button>
            )}
            {canRefund && (
              <Button variant="secondary" size="sm" onClick={() => setModal('refund')}>
                Request refund
              </Button>
            )}
          </div>
        </div>
        <EventLog subOrder={s} />
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'cancel' ? 'Cancel this shipment?' : 'Request a refund'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Back
            </Button>
            <Button
              variant={modal === 'cancel' ? 'danger' : 'primary'}
              loading={cancel.isPending || refund.isPending}
              disabled={modal === 'refund' && reason.trim().length < 10}
              onClick={submit}
            >
              {modal === 'cancel' ? 'Cancel shipment' : 'Submit request'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          {modal === 'cancel'
            ? `Items from ${s.vendor?.storeName} haven't shipped yet. Cancelling refunds ${formatMoney(s.subtotal)} to your original payment method.`
            : `Tell us what went wrong with your items from ${s.vendor?.storeName}. An admin will review your request.`}
        </p>
        <Textarea
          label={modal === 'cancel' ? 'Reason (optional)' : 'Reason'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          hint={modal === 'refund' ? 'At least 10 characters' : undefined}
        />
      </Modal>
    </Card>
  );
}
