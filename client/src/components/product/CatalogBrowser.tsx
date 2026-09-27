import clsx from 'clsx';
import { PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useCategories, useProducts } from '../../api/catalog';
import { paiseToRupees, rupeesToPaise } from '../../lib/format';
import { Button } from '../ui/Button';
import { controlClass } from '../ui/Form';
import { Pagination } from '../ui/Pagination';
import { EmptyState, ErrorState } from '../ui/States';
import { ProductCard, ProductGridSkeleton } from './ProductCard';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'popular', label: 'Most reviewed' },
];

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

/** Catalog grid whose filter state lives in the URL, so results are shareable and back-button friendly. */
export function CatalogBrowser({ vendor }: { vendor?: string }) {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const search = params.get('search') ?? undefined;
  const category = params.get('category') ?? undefined;
  const sort = params.get('sort') ?? 'newest';
  const page = num(params.get('page')) ?? 1;
  const minPrice = num(params.get('minPrice'));
  const maxPrice = num(params.get('maxPrice'));
  const inStock = params.get('inStock') === 'true';

  const categories = useCategories();
  const products = useProducts({ search, category, vendor, sort, page, minPrice, maxPrice, inStock, limit: 12 });

  const [minDraft, setMinDraft] = useState(minPrice !== undefined ? String(paiseToRupees(minPrice)) : '');
  const [maxDraft, setMaxDraft] = useState(maxPrice !== undefined ? String(paiseToRupees(maxPrice)) : '');
  useEffect(() => {
    setMinDraft(minPrice !== undefined ? String(paiseToRupees(minPrice)) : '');
    setMaxDraft(maxPrice !== undefined ? String(paiseToRupees(maxPrice)) : '');
  }, [minPrice, maxPrice]);

  const update = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (resetPage) next.delete('page');
    setParams(next);
  };

  const applyPrice = (e: FormEvent) => {
    e.preventDefault();
    update({
      minPrice: minDraft ? String(rupeesToPaise(Number(minDraft))) : undefined,
      maxPrice: maxDraft ? String(rupeesToPaise(Number(maxDraft))) : undefined,
    });
  };

  const hasFilters = !!(search || category || minPrice !== undefined || maxPrice !== undefined || inStock);
  const clearAll = () => setParams(new URLSearchParams());

  const filters = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Category</h3>
        <ul className="space-y-0.5">
          <li>
            <button
              onClick={() => update({ category: undefined })}
              className={clsx('w-full rounded-md px-2 py-1.5 text-left text-sm', !category ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100')}
            >
              All categories
            </button>
          </li>
          {categories.data?.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => update({ category: c.slug })}
                className={clsx(
                  'flex w-full justify-between rounded-md px-2 py-1.5 text-left text-sm',
                  category === c.slug ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <span>{c.name}</span>
                {!vendor && <span className="text-xs text-slate-400">{c.productCount}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={applyPrice}>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Price (₹)</h3>
        <div className="flex items-center gap-2">
          <input aria-label="Minimum price" type="number" min={0} placeholder="Min" value={minDraft} onChange={(e) => setMinDraft(e.target.value)} className={controlClass} />
          <span className="text-slate-400">–</span>
          <input aria-label="Maximum price" type="number" min={0} placeholder="Max" value={maxDraft} onChange={(e) => setMaxDraft(e.target.value)} className={controlClass} />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="mt-2 w-full">
          Apply
        </Button>
      </form>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? 'true' : undefined })} />
        In stock only
      </label>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="w-full">
          <X className="h-4 w-4" /> Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <aside className={clsx(filtersOpen ? 'block' : 'hidden', 'lg:block')} aria-label="Filters">
        {filters}
      </aside>
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            {products.data ? (
              <>
                <strong className="text-slate-900">{products.data.total}</strong> product{products.data.total === 1 ? '' : 's'}
                {search && (
                  <>
                    {' '}for “<strong className="text-slate-900">{search}</strong>”
                  </>
                )}
              </>
            ) : (
              'Loading products…'
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setFiltersOpen((o) => !o)}>
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </Button>
            <label className="sr-only" htmlFor="sort">
              Sort by
            </label>
            <select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value })} className={clsx(controlClass, 'w-auto')}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {products.isPending ? (
          <ProductGridSkeleton />
        ) : products.isError ? (
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        ) : products.data.items.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="h-6 w-6" />}
            title="No products found"
            description="Try a different search term or remove some filters."
            action={hasFilters ? <Button variant="secondary" onClick={clearAll}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            <div className={clsx('grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4', products.isPlaceholderData && 'opacity-60')}>
              {products.data.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <Pagination
              page={products.data.page}
              totalPages={products.data.totalPages}
              onChange={(p) => {
                update({ page: String(p) }, false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
