import { ChevronDown, LayoutDashboard, LogOut, Package, ShieldCheck, Store } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;
  const item = 'flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50';
  const close = () => setOpen(false);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">{user.name}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          {user.role === 'CUSTOMER' && (
            <Link to="/orders" className={item} onClick={close} role="menuitem">
              <Package className="h-4 w-4" /> My orders
            </Link>
          )}
          {user.vendor?.status === 'APPROVED' ? (
            <Link to="/vendor" className={item} onClick={close} role="menuitem">
              <LayoutDashboard className="h-4 w-4" /> Vendor dashboard
            </Link>
          ) : (
            user.role === 'CUSTOMER' && (
              <Link to="/sell" className={item} onClick={close} role="menuitem">
                <Store className="h-4 w-4" /> {user.vendor ? 'Vendor application' : 'Sell on Bazaar'}
              </Link>
            )
          )}
          {user.role === 'ADMIN' && (
            <Link to="/admin" className={item} onClick={close} role="menuitem">
              <ShieldCheck className="h-4 w-4" /> Admin panel
            </Link>
          )}
          <button
            role="menuitem"
            className={`${item} w-full border-t border-slate-100 text-rose-600`}
            onClick={async () => {
              close();
              await logout();
              navigate('/');
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
