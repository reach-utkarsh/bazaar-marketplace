import { ShoppingCart, Store, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { useCart, useRemoveCartItem, useUpdateCartItem } from '../../api/cart';
import { ProductImage } from '../../components/product/ProductImage';
import { ButtonLink } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { formatMoney } from '../../lib/format';

export default function CartPage() {
  const cart = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();

  if (cart.isPending) return <PageLoader />;
  if (cart.isError) return <ErrorState error={cart.error} onRetry={() => cart.refetch()} />;
  const { groups, total, itemCount } = cart.data;

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-6 w-6" />}
        title="Your cart is empty"
        description="Browse the catalog and add something you love."
        action={<ButtonLink to="/">Start shopping</ButtonLink>}
      />
    );
  }

  const hasUnavailable = groups.some((g) => g.items.some((i) => !i.available));

  return (
    <>
      <PageHeader title="Your cart" description={`${itemCount} item${itemCount === 1 ? '' : 's'} from ${groups.length} seller${groups.length === 1 ? '' : 's'}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.vendor.id}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <Link to={`/stores/${g.vendor.slug}`} className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-brand-700">
                  <Store className="h-4 w-4 text-slate-400" /> {g.vendor.storeName}
                </Link>
                <span className="text-xs text-slate-500">Ships separately</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.items.map((item) => (
                  <li key={item.productId} className="flex gap-4 p-5">
                    <Link to={`/products/${item.product.slug}`} className="shrink-0">
                      <ProductImage url={item.product.images[0]?.url} alt={item.product.title} className="h-20 w-20 rounded-lg" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link to={`/products/${item.product.slug}`} className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-brand-700">
                          {item.product.title}
                        </Link>
                        <p className="mt-0.5 text-sm text-slate-500">{formatMoney(item.product.price)} each</p>
                        {!item.available && (
                          <p className="mt-1 text-xs font-medium text-rose-600">
                            {!item.product.isActive ? 'No longer available' : `Only ${item.product.stock} in stock — reduce quantity`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <QuantityStepper
                          value={item.quantity}
                          max={Math.max(1, Math.min(item.product.stock, 20))}
                          disabled={update.isPending}
                          onChange={(q) => update.mutate({ productId: item.productId, quantity: q })}
                        />
                        <p className="w-24 text-right text-sm font-semibold tabular-nums">{formatMoney(item.lineTotal)}</p>
                        <button
                          onClick={() => remove.mutate(item.productId)}
                          className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Remove ${item.product.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <Card className="h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-base font-semibold text-slate-900">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {groups.map((g) => (
              <div key={g.vendor.id} className="flex justify-between text-slate-600">
                <dt className="truncate pr-2">{g.vendor.storeName}</dt>
                <dd className="tabular-nums">{formatMoney(g.subtotal)}</dd>
              </div>
            ))}
            <div className="flex justify-between text-slate-600">
              <dt>Shipping</dt>
              <dd className="text-emerald-600">Free</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(total)}</dd>
            </div>
          </dl>
          {hasUnavailable && <p className="mt-3 text-xs text-rose-600">Fix the highlighted items before checking out.</p>}
          <ButtonLink
            to="/checkout"
            size="lg"
            className={`mt-5 w-full ${hasUnavailable ? 'pointer-events-none opacity-50' : ''}`}
            aria-disabled={hasUnavailable}
          >
            Proceed to checkout
          </ButtonLink>
        </Card>
      </div>
    </>
  );
}
