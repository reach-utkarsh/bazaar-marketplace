import clsx from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'indigo';

const tones: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
};

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  PLACED: 'blue',
  PACKED: 'violet',
  SHIPPED: 'indigo',
  DELIVERED: 'green',
  CANCELLED: 'red',
  PENDING: 'amber',
  PAID: 'green',
  FAILED: 'red',
  APPROVED: 'green',
  REJECTED: 'red',
  REQUESTED: 'amber',
};

const LABELS: Record<string, string> = { PENDING: 'Pending' };

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text = label ?? LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge tone={STATUS_TONES[status] ?? 'gray'}>{text}</Badge>;
}
