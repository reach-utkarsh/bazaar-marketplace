import type { ReactNode } from 'react';

export interface RankedItem {
  key: string;
  label: ReactNode;
  value: number;
  display: string;
  sub?: string;
}

/** Horizontal ranked bars in plain HTML: one hue for every bar (identity isn't encoded by colour). */
export function RankedBars({ items, empty = 'No data yet' }: { items: RankedItem[]; empty?: string }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol className="space-y-3">
      {items.map((i) => (
        <li key={i.key} title={`${i.display}${i.sub ? ` · ${i.sub}` : ''}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{i.label}</span>
            <span className="shrink-0 font-medium text-slate-900 tabular-nums">
              {i.display}
              {i.sub && <span className="ml-1 text-xs font-normal text-slate-500">{i.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
