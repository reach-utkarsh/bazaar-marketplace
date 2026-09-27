import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export function DashboardLayout({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <p className="mb-3 px-3 text-xs font-semibold tracking-wider text-slate-400 uppercase">{title}</p>
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:pb-0">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
