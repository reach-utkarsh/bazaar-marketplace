import clsx from 'clsx';
import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { assetUrl } from '../../lib/api';

export function ProductImage({ url, alt, className }: { url?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        className={clsx('flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400', className)}
      >
        <ImageOff className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }
  return <img src={assetUrl(url)} alt={alt} loading="lazy" onError={() => setFailed(true)} className={clsx('object-cover', className)} />;
}
