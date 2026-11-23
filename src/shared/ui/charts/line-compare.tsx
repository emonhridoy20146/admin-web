'use client';
/**
 * Recharts lines on one axis (FR-W-064), e.g. this month against last month, day by day. 2 px lines, the main series
 * in the primary chart colour, the comparison recessive and dashed; a crosshair tooltip shows every series.
 */
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface LineSeries {
  key: string;
  label: string;
  token: string;
  dashed?: boolean;
}
export interface LineRow {
  key: string;
  label: string;
  values: Record<string, number | null>;
}

export default function LineCompare({ data, series, axisFormat, valueFormat, height = 240, titleOf }: {
  data: LineRow[];
  series: LineSeries[];
  axisFormat: (v: number) => string;
  valueFormat: (v: number) => string;
  height?: number;
  titleOf?: (row: LineRow) => string;
}) {
  const rows = data.map((d) => ({ ...d, ...Object.fromEntries(series.map((s) => [s.key, d.values[s.key]])) }));
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--fg-tertiary)', fontSize: 12 }} dy={6} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--fg-tertiary)', fontSize: 12 }} tickFormatter={axisFormat} width={64} />
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload ? (payload[0].payload as LineRow) : null;
              if (!p) return null;
              return (
                <div className="min-w-44 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm shadow-e2">
                  <div className="mb-1 text-fg-tertiary">{titleOf ? titleOf(p) : p.label}</div>
                  {series.map((s) =>
                    p.values[s.key] == null ? null : (
                      <div key={s.key} className="flex items-center gap-2 text-fg-secondary">
                        <span className="h-0.5 w-3 rounded-full" style={{ background: `var(${s.token})` }} aria-hidden />
                        <span className="flex-1">{s.label}</span>
                        <span className="tabular font-medium text-fg">{valueFormat(p.values[s.key]!)}</span>
                      </div>
                    ),
                  )}
                </div>
              );
            }}
          />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={`var(${s.token})`} strokeWidth={2} strokeDasharray={s.dashed ? '5 5' : undefined} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-secondary">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.dashed ? `repeating-linear-gradient(90deg, var(${s.token}) 0 4px, transparent 4px 7px)` : `var(${s.token})` }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
