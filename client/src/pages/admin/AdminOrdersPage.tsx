import clsx from 'clsx';
import { Search, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useAdminOrder, useAdminOrders } from '../../api/admin';
import { StatusBadge } from '../../components/ui/Badge';
import { Card, PageHeader } from '../../components/ui/Card';
import { controlClass } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { PageLoader, Spinner } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { Tabs } from '../../components/ui/Tabs';
import { formatDateTime, formatMoney, shortId } from '../../lib/format';
import type { PaymentStatus } from '../../lib/types';

export default function AdminOrdersPage() {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | undefined>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const orders = useAdminOrders({ paymentStatus, search: search.trim() || undefined, page });

  return (
    <>
      <PageHeader title="All orders" description="Every customer order across the marketplace." />
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <Tabs
            tabs={[
              { value: undefined as PaymentStatus | undefined, label: 'All' },
              { value: 'PAID', label: 'Paid' },
              { value: 'PENDING', label: 'Awaiting payment' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'FAILED', label: 'Failed' },
            ]}
            value={paymentStatus}
            onChange={(v) => { setPaymentStatus(v); setPage(1); }}
          />
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input aria-label="Search orders" placeholder="Order id, customer name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={clsx(controlClass, 'pl-9')} />
        </div>
      </div>
      {orders.isPending ? (
        <PageLoader />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : orders.data.items.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="No orders found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Shipments</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.data.items.map((o) => (
                  <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(o.id)}>
                    <td className="px-4 py-3">
                      <button className="font-medium text-brand-700 hover:underline" onClick={() => setOpenId(o.id)}>{shortId(o.id)}</button>
                      <p className="text-xs text-slate-500">{formatDateTime(o.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{o.customer.name}</p>
                      <p className="text-xs text-slate-500">{o.customer.email}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.paymentStatus} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {o.subOrders.map((s) => (
                          <span key={s.id} title={s.vendor.storeName}><StatusBadge status={s.status} label={`${s.vendor.storeName.split(' ')[0]}: ${s.status.toLowerCase()}`} /></span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(o.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {orders.data && <Pagination page={page} totalPages={orders.data.totalPages} onChange={setPage} />}
      <OrderModal id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function OrderModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const order = useAdminOrder(id);
  const o = order.data;
  return (
    <Modal open={!!id} onClose={onClose} title={id ? `Order ${shortId(id)}` : ''}>
      {order.isPending ? (
        <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-brand-600" /></div>
      ) : order.isError || !o ? (
        <ErrorState error={order.error} />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{o.customer?.name}</p>
              <p className="text-slate-500">{o.customer?.email}</p>
            </div>
            <div className="text-right">
              <StatusBadge status={o.paymentStatus} />
              <p className="mt-1 text-xs text-slate-500">{o.payment?.provider} · {o.payment?.status}</p>
            </div>
          </div>
          <p className="text-slate-600">
            Ship to: {o.shippingName}, {o.shippingLine1}, {o.shippingCity} {o.shippingPostalCode}
          </p>
          {o.subOrders.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{s.vendor?.storeName}</span>
                <StatusBadge status={s.status} />
              </div>
              <ul className="space-y-0.5 text-slate-600">
                {s.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2"><span className="truncate">{i.quantity} × {i.productTitle}</span><span className="tabular-nums">{formatMoney(i.lineTotal)}</span></li>
                ))}
              </ul>
              <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-xs">
                <div><dt className="text-slate-500">Subtotal</dt><dd className="font-medium tabular-nums">{formatMoney(s.subtotal)}</dd></div>
                <div><dt className="text-slate-500">Commission ({s.commissionRateBps / 100}%)</dt><dd className="font-medium tabular-nums">{formatMoney(s.commissionAmount)}</dd></div>
                <div><dt className="text-slate-500">Vendor earns</dt><dd className="font-medium tabular-nums">{formatMoney(s.vendorEarnings)}</dd></div>
              </dl>
              {s.refundedAmount > 0 && <p className="mt-1 text-xs text-emerald-700">Refunded {formatMoney(s.refundedAmount)}</p>}
            </div>
          ))}
          <p className="text-right text-base font-semibold">Total {formatMoney(o.totalAmount)}</p>
        </div>
      )}
    </Modal>
  );
}
