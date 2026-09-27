import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
 * Single-series daily money chart. Daily totals are discrete (many days are zero), so bars
 * are used rather than a smoothed line that would invent values between days. One series →
 * no legend (the card title names it); hover highlight + tooltip; a table view for exact values.
 */
export function TrendChart({ data, color = '#4f46e5', valueLabel, height = 260 }: { data: TrendPoint[]; color?: string; valueLabel: string; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure>
      <div style={{ height }} role="img" aria-label={`${valueLabel} per day, total ${formatMoney(total)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={data.length > 45 ? 1 : 2}>
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
            <Tooltip content={<ChartTooltip valueLabel={valueLabel} />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
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
