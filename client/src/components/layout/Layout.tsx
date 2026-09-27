import { Outlet } from 'react-router';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} Bazaar — a portfolio multi-vendor marketplace.</span>
          <span>Payments run in test / mock mode. No real money moves.</span>
        </div>
      </footer>
    </div>
  );
}
