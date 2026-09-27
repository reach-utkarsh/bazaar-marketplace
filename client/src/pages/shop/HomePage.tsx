import { useSearchParams } from 'react-router';
import { CatalogBrowser } from '../../components/product/CatalogBrowser';

export default function HomePage() {
  const [params] = useSearchParams();
  const browsing = [...params.keys()].length > 0;
  return (
    <>
      {!browsing && (
        <section className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="relative max-w-xl">
            <p className="text-sm font-medium tracking-wide text-brand-100 uppercase">Independent sellers · one checkout</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Discover goods from makers you’ll love.</h1>
            <p className="mt-3 text-brand-100">
              Shop across stores in a single cart. Each seller ships your items separately — track every package from your order page.
            </p>
          </div>
          <div className="pointer-events-none absolute -top-10 -right-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        </section>
      )}
      <CatalogBrowser />
    </>
  );
}
