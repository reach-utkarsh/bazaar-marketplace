import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { useCart } from '../../api/cart';

export function CartButton() {
  const { data } = useCart();
  const count = data?.itemCount ?? 0;
  return (
    <Link to="/cart" className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
