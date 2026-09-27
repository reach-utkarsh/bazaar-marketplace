import clsx from 'clsx';
import { Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useDeleteProduct, useVendorProducts } from '../../api/vendor';
import { ProductImage } from '../../components/product/ProductImage';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/Card';
import { controlClass } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { formatMoney } from '../../lib/format';
import type { Product } from '../../lib/types';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Hidden' },
  { value: 'low_stock', label: 'Low stock' },
];

export default function VendorProductsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const products = useVendorProducts({ page, status: status || undefined, search: search || undefined });
  const del = useDeleteProduct();
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await del.mutateAsync(toDelete.id);
    toast.success(res.deleted ? 'Product deleted' : 'Product has past orders, so it was hidden instead of deleted');
    setToDelete(null);
  };

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your catalog, pricing and stock."
        action={<ButtonLink to="/vendor/products/new"><Plus className="h-4 w-4" /> New product</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
              className={clsx('rounded-md px-3 py-1.5 text-sm', status === f.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search your products"
            placeholder="Search your products"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={clsx(controlClass, 'pl-9')}
          />
        </div>
      </div>

      {products.isPending ? (
        <PageLoader />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : products.data.items.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title={status || search ? 'No matching products' : 'No products yet'}
          description={status || search ? 'Try another filter.' : 'Add your first product to start selling.'}
          action={!status && !search ? <ButtonLink to="/vendor/products/new">Add a product</ButtonLink> : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductImage url={p.images[0]?.url} alt={p.title} className="h-10 w-10 shrink-0 rounded-md" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{p.title}</p>
                          <p className="text-xs text-slate-500">{p.category.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(p.price)}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('tabular-nums', p.stock === 0 ? 'font-medium text-rose-600' : p.stock <= 5 ? 'font-medium text-amber-600' : '')}>{p.stock}</span>
                    </td>
                    <td className="px-4 py-3">{p.isActive ? <Badge tone="green">Active</Badge> : <Badge>Hidden</Badge>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/vendor/products/${p.id}`} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={`Edit ${p.title}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button onClick={() => setToDelete(p)} className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${p.title}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {products.data && <Pagination page={page} totalPages={products.data.totalPages} onChange={setPage} />}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete product?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={del.isPending} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <strong>{toDelete?.title}</strong> will be removed from your store. If it appears in past orders it will be hidden instead, so order history stays intact.
        </p>
      </Modal>
    </>
  );
}
