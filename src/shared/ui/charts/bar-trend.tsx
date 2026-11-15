'use client';
/** Recharts single-series bar trend. Loaded with next/dynamic so Recharts stays out of the shell bundle (NFR-W-001). */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
  valueText: string;
  sub?: string;
  highlight?: boolean;
}

export default function BarTrend({ data, axisFormat, height = 220, onBarClick }: { data: TrendPoint[]; axisFormat: (v: number) => string; height?: number; onBarClick?: (p: TrendPoint) => void }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--fg-tertiary)', fontSize: 12 }} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--fg-tertiary)', fontSize: 12 }} tickFormatter={axisFormat} width={64} />
        <Tooltip
          cursor={{ fill: 'var(--surface-hover)', radius: 4 }}
          content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload ? (payload[0].payload as TrendPoint) : null;
            if (!p) return null;
            return (
              <div className="rounded-md border border-line bg-surface-raised px-3 py-2 text-sm shadow-e2">
                <div className="text-fg-tertiary">{p.label}</div>
                <div className="tabular text-base font-semibold text-fg">{p.valueText}</div>
                {p.sub && <div className="text-xs text-fg-tertiary">{p.sub}</div>}
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} onClick={(d) => onBarClick?.(d as unknown as TrendPoint)} cursor={onBarClick ? 'pointer' : undefined}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.highlight ? 'var(--chart-1)' : 'var(--brand-300)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
