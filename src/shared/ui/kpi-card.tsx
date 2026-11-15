'use client';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatPercent } from '../lib/format';
import { Sparkline } from './sparkline';
import { Skeleton } from './feedback';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  href: string;
  icon?: LucideIcon;
  /** ratio vs comparison period, e.g. 0.12 = +12% */
  delta?: number | null;
  deltaLabel?: string;
  /** when true, an increase is bad (e.g. conflicts) */
  invertDelta?: boolean;
  trend?: number[];
  footer?: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'attention';
  loading?: boolean;
  progress?: number | null;
}

/** KPI card (03 §5.5): every KPI links to its filtered list (FR-W-006). */
export function KpiCard({ label, value, href, icon: Icon, delta, deltaLabel, invertDelta, trend, footer, sub, tone = 'default', loading, progress }: KpiCardProps) {
  const up = (delta ?? 0) >= 0;
  const good = invertDelta ? !up : up;
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex min-h-[148px] flex-col rounded-md border bg-surface p-4 shadow-e1 transition-[box-shadow,border-color] duration-[var(--dur-base)] hover:border-line-strong hover:shadow-e2',
        tone === 'attention' ? 'border-st-overdue/40' : 'border-line',
      )}
    >
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        {Icon && (
          <span className={cn('grid size-7 place-items-center rounded-sm', tone === 'attention' ? 'bg-st-overdue-bg text-st-overdue' : 'bg-primary-subtle text-primary-subtle-fg')}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <span className="truncate font-medium">{label}</span>
        <ChevronRight className="ms-auto size-4 text-fg-disabled transition-transform group-hover:translate-x-0.5 group-hover:text-fg-tertiary" aria-hidden />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-32" />
      ) : (
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="tabular text-3xl font-semibold tracking-tight text-fg">{value}</div>
            {sub && <div className="mt-0.5 text-sm text-fg-tertiary">{sub}</div>}
          </div>
          {trend && trend.length > 1 && <Sparkline values={trend} className="shrink-0 text-primary" />}
        </div>
      )}
      {progress != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-[var(--dur-slow)]" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
        </div>
      )}
      <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-fg-tertiary">
        {delta != null && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', good ? 'text-success' : 'text-danger')}>
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {(up ? '+' : '') + formatPercent(delta)}
          </span>
        )}
        {deltaLabel && <span>{deltaLabel}</span>}
        {footer && <span className="ms-auto truncate">{footer}</span>}
      </div>
    </Link>
  );
}
