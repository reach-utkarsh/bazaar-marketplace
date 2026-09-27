import clsx from 'clsx';
import { ChevronRight, ShieldCheck, Store, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useProduct } from '../../api/catalog';
import { ProductImage } from '../../components/product/ProductImage';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { Stars } from '../../components/ui/Stars';
import { formatMoney } from '../../lib/format';
import { AddToCart } from './AddToCart';
import { ReviewsSection } from './ReviewsSection';

export default function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { data: product, isPending, isError, error, refetch } = useProduct(slug);
  const [active, setActive] = useState(0);

  if (isPending) return <PageLoader />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  const images = product.images;
  return (
    <div>
      <nav className="mb-6 flex items-center gap-1 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-slate-900">Shop</Link>
        <ChevronRight className="h-4 w-4" />
        <Link to={`/?category=${product.category.slug}`} className="hover:text-slate-900">{product.category.name}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="truncate text-slate-900">{product.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ProductImage url={images[active]?.url} alt={product.title} className="h-full w-full" />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActive(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={clsx('h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2', i === active ? 'border-brand-500' : 'border-transparent opacity-70 hover:opacity-100')}
                >
                  <ProductImage url={img.url} alt="" className="h-full w-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Link to={`/stores/${product.vendor.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
            <Store className="h-4 w-4" /> {product.vendor.storeName}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{product.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <Stars value={product.avgRating} size="md" />
            <a href="#reviews" className="hover:underline">
              {product.reviewCount ? `${product.avgRating.toFixed(1)} · ${product.reviewCount} review${product.reviewCount === 1 ? '' : 's'}` : 'No reviews yet'}
            </a>
          </div>
          <p className="mt-4 text-3xl font-semibold text-slate-900">{formatMoney(product.price)}</p>
          <p className={clsx('mt-1 text-sm font-medium', product.stock === 0 ? 'text-rose-600' : product.stock <= 5 ? 'text-amber-600' : 'text-emerald-600')}>
            {product.stock === 0 ? 'Out of stock' : product.stock <= 5 ? `Only ${product.stock} left in stock` : 'In stock'}
          </p>

          <div className="mt-6">
            <AddToCart product={product} />
          </div>

          <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:grid-cols-2">
            <p className="flex items-center gap-2"><Truck className="h-4 w-4 text-slate-400" /> Shipped by {product.vendor.storeName}</p>
            <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-400" /> Secure payment & easy refunds</p>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-900">About this item</h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-600">{product.description}</p>
          </div>
        </div>
      </div>

      <ReviewsSection product={product} />
    </div>
  );
}
