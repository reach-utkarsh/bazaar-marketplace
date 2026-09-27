import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';

export function CartButton() {
  return (
    <Link to="/cart" className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Cart">
      <ShoppingCart className="h-5 w-5" />
    </Link>
  );
}
