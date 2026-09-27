import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, formatMoneyCompact } from '../../lib/format';

export interface TrendPoint {
  date: string;
  value: number;
}

const INK_MUTED = '#64748b'; // slate-500
const GRID = '#e2e8f0'; // slate-200 — hairline, one shade off the surface

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
  valueLabel: string;
}

function ChartTooltip({ active, payload, label, valueLabel }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-slate-500">{shortDate(String(label))}</p>
      <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">
        {valueLabel}: {formatMoney(Number(payload[0].value))}
      </p>
    </div>
  );
}

/**
 * Single-series money-over-time area chart. One series → no legend (the card title names it);
 * crosshair + tooltip on hover; a data table is available for screen readers and exact values.
 */
export function TrendChart({ data, color = '#4f46e5', valueLabel, height = 260 }: { data: TrendPoint[]; color?: string; valueLabel: string; height?: number }) {
  const gradientId = useId().replace(/:/g, '');
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure>
      <div style={{ height }} role="img" aria-label={`${valueLabel} per day, total ${formatMoney(total)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fontSize: 11, fill: INK_MUTED }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={24}
            />
            <YAxis tickFormatter={(v) => formatMoneyCompact(v)} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} width={64} />
            <Tooltip content={<ChartTooltip valueLabel={valueLabel} />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2, fill: color }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-slate-500">
        <summary className="cursor-pointer hover:text-slate-800">View as table</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 text-right font-medium">{valueLabel}</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {data.map((d) => (
                <tr key={d.date} className="border-t border-slate-100">
                  <td className="py-1">{shortDate(d.date)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
