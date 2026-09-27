import { Minus, Plus } from 'lucide-react';

export function QuantityStepper({ value, min = 1, max, onChange, disabled }: { value: number; min?: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  const btn = 'flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-10 text-center text-sm font-medium tabular-nums" aria-live="polite" aria-label="Quantity">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
