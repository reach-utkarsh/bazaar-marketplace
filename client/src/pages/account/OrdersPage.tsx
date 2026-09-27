import { ChevronRight, Package } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useMyOrders } from '../../api/orders';
import { ProductImage } from '../../components/product/ProductImage';
import { StatusBadge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { formatDate, formatMoney, shortId } from '../../lib/format';
import type { Order } from '../../lib/types';

function summary(o: Order) {
  if (o.paymentStatus === 'PENDING') return <StatusBadge status="PENDING" label="Awaiting payment" />;
  if (o.paymentStatus !== 'PAID') return <StatusBadge status={o.paymentStatus} />;
  const statuses = new Set(o.subOrders.map((s) => s.status));
  if (statuses.size === 1) return <StatusBadge status={[...statuses][0]} />;
  const delivered = o.subOrders.filter((s) => s.status === 'DELIVERED').length;
  return <StatusBadge status="SHIPPED" label={`${delivered}/${o.subOrders.length} delivered`} />;
}

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const orders = useMyOrders(page);

  if (orders.isPending) return <PageLoader />;
  if (orders.isError) return <ErrorState error={orders.error} onRetry={() => orders.refetch()} />;

  if (orders.data.items.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title="No orders yet"
        description="When you place an order, you’ll be able to track every shipment here."
        action={<ButtonLink to="/">Browse products</ButtonLink>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My orders" description="Each seller ships separately — open an order to track every shipment." />
      <div className="space-y-3">
        {orders.data.items.map((o) => {
          const items = o.subOrders.flatMap((s) => s.items);
          return (
            <Link key={o.id} to={`/orders/${o.id}`} className="block">
              <Card className="flex items-center gap-4 p-4 transition hover:border-brand-200 hover:shadow-md">
                <div className="flex -space-x-3">
                  {items.slice(0, 3).map((i) => (
                    <ProductImage key={i.id} url={i.imageUrl} alt={i.productTitle} className="h-12 w-12 rounded-lg border-2 border-white" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">Order {shortId(o.id)}</span>
                    {summary(o)}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {formatDate(o.createdAt)} · {items.length} item{items.length === 1 ? '' : 's'} from {o.subOrders.map((s) => s.vendor?.storeName).join(', ')}
                  </p>
                </div>
                <p className="hidden font-semibold tabular-nums sm:block">{formatMoney(o.totalAmount)}</p>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </Card>
            </Link>
          );
        })}
      </div>
      <Pagination page={page} totalPages={orders.data.totalPages} onChange={setPage} />
    </div>
  );
}
