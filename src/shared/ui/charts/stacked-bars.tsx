'use client';
/**
 * Recharts stacked bars (FR-W-064): one bar per period, one segment per series, a 2 px surface gap between segments,
 * rounded top on the stack. Loaded with next/dynamic (Recharts stays out of the shell bundle). Colours are design
 * tokens (CSS variables); identity is also in the legend under the chart and in the tooltip, never colour alone.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface StackSeries {
  key: string;
  label: string;
  /** CSS variable name, e.g. `--pay-cash` */
  token: string;
}
export interface StackRow {
  key: string;
  label: string;
  sub?: string;
  values: Record<string, number>;
  total: number;
  totalText: string;
}

export default function StackedBars({ data, series, axisFormat, valueFormat, height = 240, onBarClick, totalLabel }: {
  data: StackRow[];
  series: StackSeries[];
  axisFormat: (v: number) => string;
  valueFormat: (v: number) => string;
  height?: number;
  onBarClick?: (row: StackRow) => void;
  totalLabel: string;
}) {
  const rows = data.map((d) => ({ ...d, ...Object.fromEntries(series.map((s) => [s.key, d.values[s.key] ?? 0])) }));
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--fg-tertiary)', fontSize: 12 }} dy={6} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--fg-tertiary)', fontSize: 12 }} tickFormatter={axisFormat} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--surface-hover)', radius: 4 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload ? (payload[0].payload as StackRow) : null;
              if (!p) return null;
              return (
                <div className="min-w-44 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm shadow-e2">
                  <div className="text-fg-tertiary">{p.sub ?? p.label}</div>
                  <div className="tabular mb-1 text-base font-semibold text-fg">{totalLabel}: {p.totalText}</div>
                  {series.map((s) => (
                    <div key={s.key} className="flex items-center gap-2 text-fg-secondary">
                      <span className="size-2.5 rounded-xs" style={{ background: `var(${s.token})` }} aria-hidden />
                      <span className="flex-1">{s.label}</span>
                      <span className="tabular text-fg">{valueFormat(p.values[s.key] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="a"
              fill={`var(${s.token})`}
              stroke="var(--surface)"
              strokeWidth={1}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={36}
              cursor={onBarClick ? 'pointer' : undefined}
              onClick={(d) => onBarClick?.(d as unknown as StackRow)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-secondary">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs" style={{ background: `var(${s.token})` }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
