import clsx from 'clsx';

export function Tabs<T extends string | undefined>({ tabs, value, onChange, counts }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void; counts?: Partial<Record<string, number>> }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1" role="tablist">
      {tabs.map((t) => {
        const count = t.value ? counts?.[t.value] : undefined;
        const active = value === t.value;
        return (
          <button
            key={t.label}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={clsx('flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm', active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
          >
            {t.label}
            {count ? <span className={clsx('rounded-full px-1.5 text-xs', active ? 'bg-white/20' : 'bg-slate-100')}>{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
