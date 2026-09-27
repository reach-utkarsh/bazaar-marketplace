import { Calendar, Package, Store as StoreIcon } from 'lucide-react';
import { useParams } from 'react-router';
import { useStore } from '../../api/catalog';
import { CatalogBrowser } from '../../components/product/CatalogBrowser';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { Stars } from '../../components/ui/Stars';
import { formatDate } from '../../lib/format';

export default function StorePage() {
  const { slug = '' } = useParams();
  const store = useStore(slug);
  if (store.isPending) return <PageLoader />;
  if (store.isError) return <ErrorState error={store.error} />;
  const s = store.data;
  return (
    <>
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <StoreIcon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{s.storeName}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{s.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {s.productCount} products</span>
              <span className="flex items-center gap-1"><Stars value={s.avgRating} /> {s.avgRating ? s.avgRating.toFixed(1) : 'No ratings yet'}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Selling since {formatDate(s.createdAt)}</span>
            </div>
          </div>
        </div>
      </section>
      <CatalogBrowser vendor={slug} />
    </>
  );
}
