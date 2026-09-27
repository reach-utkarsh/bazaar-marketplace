import clsx from 'clsx';
import { Check, PackageCheck, Truck, X, Box, ClipboardCheck } from 'lucide-react';
import { formatDateTime } from '../../lib/format';
import type { SubOrder } from '../../lib/types';

const STEPS = [
  { status: 'PLACED', label: 'Placed', icon: ClipboardCheck, at: (s: SubOrder) => s.createdAt },
  { status: 'PACKED', label: 'Packed', icon: Box, at: (s: SubOrder) => s.packedAt },
  { status: 'SHIPPED', label: 'Shipped', icon: Truck, at: (s: SubOrder) => s.shippedAt },
  { status: 'DELIVERED', label: 'Delivered', icon: PackageCheck, at: (s: SubOrder) => s.deliveredAt },
] as const;

const ORDER = ['PLACED', 'PACKED', 'SHIPPED', 'DELIVERED'];

/** Horizontal progress tracker for one sub-order (shipment). */
export function ShipmentProgress({ subOrder, paid }: { subOrder: SubOrder; paid: boolean }) {
  if (subOrder.status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        <X className="h-4 w-4" /> Cancelled{subOrder.cancelReason ? ` — ${subOrder.cancelReason}` : ''}
      </div>
    );
  }
  const current = paid ? ORDER.indexOf(subOrder.status) : -1;
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Shipment progress">
      {STEPS.map((step, i) => {
        const done = i <= current;
        const Icon = done ? Check : step.icon;
        const at = step.at(subOrder);
        return (
          <li key={step.status} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={clsx('h-0.5 flex-1', i === 0 ? 'invisible' : i <= current ? 'bg-emerald-500' : 'bg-slate-200')} />
              <span
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2',
                  done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-400',
                )}
                aria-current={i === current ? 'step' : undefined}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className={clsx('h-0.5 flex-1', i === STEPS.length - 1 ? 'invisible' : i < current ? 'bg-emerald-500' : 'bg-slate-200')} />
            </div>
            <span className={clsx('mt-1 text-xs font-medium', done ? 'text-slate-900' : 'text-slate-400')}>{step.label}</span>
            {done && at && <span className="text-[10px] text-slate-500">{formatDateTime(at)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function EventLog({ subOrder }: { subOrder: SubOrder }) {
  if (!subOrder.events?.length) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-slate-500 hover:text-slate-800">Tracking history</summary>
      <ul className="mt-2 space-y-1.5 border-l-2 border-slate-100 pl-4">
        {[...subOrder.events].reverse().map((e) => (
          <li key={e.id} className="text-slate-600">
            <span className="font-medium text-slate-800">{e.status.charAt(0) + e.status.slice(1).toLowerCase()}</span>
            {e.note && <> — {e.note}</>}
            <span className="ml-2 text-xs text-slate-400">{formatDateTime(e.createdAt)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
