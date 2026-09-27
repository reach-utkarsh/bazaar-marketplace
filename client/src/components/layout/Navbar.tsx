import { Search, ShoppingBag } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { ButtonLink } from '../ui/Button';
import { CartButton } from './CartButton';
import { UserMenu } from './UserMenu';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-bold text-slate-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <ShoppingBag className="h-4 w-4" />
      </span>
      <span className="text-lg tracking-tight">Bazaar</span>
    </Link>
  );
}

export function Navbar() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('search') ?? '');

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/?search=${encodeURIComponent(q.trim())}` : '/');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <form onSubmit={onSearch} className="relative ml-2 hidden flex-1 md:block md:max-w-md" role="search">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pr-4 pl-9 text-sm focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </form>
        <nav className="ml-auto flex items-center gap-2">
          {!initializing && !user && (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink to="/register" size="sm">
                Create account
              </ButtonLink>
            </>
          )}
          {user?.role === 'CUSTOMER' && <CartButton />}
          <UserMenu />
        </nav>
      </div>
      <form onSubmit={onSearch} className="relative px-4 pb-3 md:hidden" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-7 h-4 w-4 -translate-y-[calc(50%+6px)] text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pr-4 pl-9 text-sm focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        />
      </form>
    </header>
  );
}
