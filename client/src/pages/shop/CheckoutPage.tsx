import { Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useCart, useCheckout } from '../../api/cart';
import { useAuth } from '../../auth/AuthContext';
import { usePaymentFlow } from '../../components/payment/usePaymentFlow';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Form';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import type { Address } from '../../lib/types';

const STORAGE_KEY = 'bazaar.lastAddress';

function loadSavedAddress(): Partial<Address> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

type Errors = Partial<Record<keyof Address, string>>;

export default function CheckoutPage() {
  const { user } = useAuth();
  const cart = useCart();
  const checkout = useCheckout();
  const { pay, dialog } = usePaymentFlow();
  const [address, setAddress] = useState<Address>(() => ({
    shippingName: user?.name ?? '',
    shippingPhone: '',
    shippingLine1: '',
    shippingLine2: '',
    shippingCity: '',
    shippingState: '',
    shippingPostalCode: '',
    shippingCountry: 'India',
    ...loadSavedAddress(),
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [placing, setPlacing] = useState(false);

  if (cart.isPending) return <PageLoader />;
  if (cart.isError) return <ErrorState error={cart.error} onRetry={() => cart.refetch()} />;
  if (cart.data.groups.length === 0 && !placing) return <Navigate to="/cart" replace />;

  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => setAddress((a) => ({ ...a, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setPlacing(true);
    try {
      const { payment } = await checkout.mutateAsync(address);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(address));
      } catch {
        /* storage unavailable — non-critical */
      }
      await pay(payment);
    } catch (err) {
      setPlacing(false);
      if (err instanceof ApiError && err.details) {
        const fe: Errors = {};
        for (const d of err.details) fe[d.path.replace('body.address.', '') as keyof Address] = d.message;
        setErrors(fe);
      }
    }
  };

  return (
    <>
      <PageHeader title="Checkout" description="Your items will ship separately from each seller." />
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]" noValidate>
        <Card>
          <CardHeader title="Shipping address" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Input label="Full name" autoComplete="name" value={address.shippingName} onChange={set('shippingName')} error={errors.shippingName} required />
            <Input label="Phone" type="tel" autoComplete="tel" value={address.shippingPhone} onChange={set('shippingPhone')} error={errors.shippingPhone} required />
            <Input className="sm:col-span-2" label="Address line 1" autoComplete="address-line1" value={address.shippingLine1} onChange={set('shippingLine1')} error={errors.shippingLine1} required />
            <Input className="sm:col-span-2" label="Address line 2 (optional)" autoComplete="address-line2" value={address.shippingLine2 ?? ''} onChange={set('shippingLine2')} />
            <Input label="City" autoComplete="address-level2" value={address.shippingCity} onChange={set('shippingCity')} error={errors.shippingCity} required />
            <Input label="State" autoComplete="address-level1" value={address.shippingState} onChange={set('shippingState')} error={errors.shippingState} required />
            <Input label="PIN code" autoComplete="postal-code" value={address.shippingPostalCode} onChange={set('shippingPostalCode')} error={errors.shippingPostalCode} required />
            <Input label="Country" autoComplete="country-name" value={address.shippingCountry} onChange={set('shippingCountry')} error={errors.shippingCountry} required />
          </div>
        </Card>
        <Card className="h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-base font-semibold text-slate-900">Order summary</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {cart.data.groups.map((g) => (
              <li key={g.vendor.id}>
                <p className="font-medium text-slate-900">{g.vendor.storeName}</p>
                <ul className="mt-1 space-y-1 text-slate-600">
                  {g.items.map((i) => (
                    <li key={i.productId} className="flex justify-between gap-2">
                      <span className="truncate">
                        {i.quantity} × {i.product.title}
                      </span>
                      <span className="tabular-nums">{formatMoney(i.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(cart.data.total)}</span>
          </div>
          <Button type="submit" size="lg" className="mt-5 w-full" loading={placing}>
            <Lock className="h-4 w-4" /> Place order & pay
          </Button>
          <p className="mt-2 text-center text-xs text-slate-500">Items are reserved for 30 minutes while you pay.</p>
        </Card>
      </form>
      {dialog}
    </>
  );
}
