import { Link } from 'react-router';
import { formatMoney } from '../../lib/format';
import type { Product } from '../../lib/types';
import { Stars } from '../ui/Stars';
import { ProductImage } from './ProductImage';

export function ProductCard({ product }: { product: Product }) {
  const outOfStock = product.stock <= 0;
  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <ProductImage url={product.images[0]?.url} alt={product.title} className="h-full w-full transition duration-300 group-hover:scale-105" />
        {outOfStock && (
          <span className="absolute top-2 left-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">Sold out</span>
        )}
        {!outOfStock && product.stock <= 5 && (
          <span className="absolute top-2 left-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">Only {product.stock} left</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-xs text-slate-500">{product.vendor.storeName}</p>
        <h3 className="mt-0.5 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-brand-700">{product.title}</h3>
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <Stars value={product.avgRating} />
          <span>({product.reviewCount})</span>
        </div>
        <p className="mt-auto pt-2 text-base font-semibold text-slate-900">{formatMoney(product.price)}</p>
      </div>
    </Link>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="aspect-square animate-pulse bg-slate-200" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
