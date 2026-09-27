import { ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAddToCart } from '../../api/cart';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import type { Product } from '../../lib/types';

const MAX_PER_LINE = 20;

export function AddToCart({ product }: { product: Product }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const add = useAddToCart();
  const [qty, setQty] = useState(1);
  const soldOut = product.stock <= 0;

  if (user && user.role !== 'CUSTOMER') {
    return <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">Sign in with a customer account to buy this item.</p>;
  }

  const onAdd = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    await add.mutateAsync({ productId: product.id, quantity: qty });
    toast.success('Added to cart', { action: { label: 'View cart', onClick: () => navigate('/cart') } });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!soldOut && <QuantityStepper value={qty} max={Math.min(product.stock, MAX_PER_LINE)} onChange={setQty} />}
      <Button size="lg" onClick={onAdd} loading={add.isPending} disabled={soldOut} className="flex-1 sm:flex-none">
        <ShoppingCart className="h-5 w-5" />
        {soldOut ? 'Sold out' : 'Add to cart'}
      </Button>
    </div>
  );
}
