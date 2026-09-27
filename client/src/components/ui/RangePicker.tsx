import clsx from 'clsx';

const RANGES = [7, 30, 90];

export function RangePicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Date range">
      {RANGES.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          aria-pressed={value === d}
          className={clsx('rounded-md px-3 py-1 text-sm', value === d ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}
