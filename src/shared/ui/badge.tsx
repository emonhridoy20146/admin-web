'use client';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatNumber } from '../lib/format';
import { returnedMark, STATUS, toneClass, toneIcon, type ReturnedLike, type Tone } from './status';

export function Badge({ tone = 'neutral', icon, children, className, filled, testId, status }: { tone?: Tone; icon?: LucideIcon | false; children: React.ReactNode; className?: string; filled?: boolean; testId?: string; status?: string }) {
  const Icon = icon === false ? null : (icon ?? toneIcon[tone]);
  return (
    <span data-testid={testId} data-status={status} className={cn('inline-flex h-[22px] items-center gap-1 rounded-xs px-1.5 text-xs font-medium whitespace-nowrap', toneClass[tone], className)}>
      {Icon && <Icon className={cn('size-3.5 shrink-0', filled && 'fill-current')} aria-hidden strokeWidth={2.25} />}
      {children}
    </span>
  );
}

/** Status = colour + icon + label (never colour alone). `values` fill the label (e.g. a count). */
export function StatusBadge({ status, className, values, testId }: { status: string; className?: string; values?: Record<string, string>; testId?: string }) {
  const { t } = useTranslation();
  const s = STATUS[status] ?? { tone: 'neutral' as Tone, label: status };
  return (
    <Badge tone={s.tone} icon={s.icon} className={className} filled={status === 'tagged_bad'} testId={testId} status={testId ? status : undefined}>
      {t(s.label, { defaultValue: status, ...values })}
    </Badge>
  );
}

/**
 * FR-W-073 (contract 1.53.0): the returned marker of a customer row, map pin or ⌘K hit: "Returned ×N", or
 * "Returned product customer" when every invoice was returned. Nothing when none were.
 */
export function ReturnedMark({ of, className }: { of: ReturnedLike | null | undefined; className?: string }) {
  const m = returnedMark(of);
  if (!m) return null;
  return <StatusBadge status={m.status} values={{ n: formatNumber(m.n) }} className={className} testId="returned-mark" />;
}

export function StatusBadges({ statuses, max = 2 }: { statuses: string[]; max?: number }) {
  const shown = statuses.slice(0, max);
  const rest = statuses.length - shown.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((s) => <StatusBadge key={s} status={s} />)}
      {rest > 0 && <Badge tone="neutral" icon={false}>+{rest}</Badge>}
    </span>
  );
}

