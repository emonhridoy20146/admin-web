'use client';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { STATUS, toneClass, toneIcon, type Tone } from './status';

export function Badge({ tone = 'neutral', icon, children, className, filled }: { tone?: Tone; icon?: LucideIcon | false; children: React.ReactNode; className?: string; filled?: boolean }) {
  const Icon = icon === false ? null : (icon ?? toneIcon[tone]);
  return (
    <span className={cn('inline-flex h-[22px] items-center gap-1 rounded-xs px-1.5 text-xs font-medium whitespace-nowrap', toneClass[tone], className)}>
      {Icon && <Icon className={cn('size-3.5 shrink-0', filled && 'fill-current')} aria-hidden strokeWidth={2.25} />}
      {children}
    </span>
  );
}

/** Status = colour + icon + label (never colour alone). */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useTranslation();
  const s = STATUS[status] ?? { tone: 'neutral' as Tone, label: status };
  return (
    <Badge tone={s.tone} className={className} filled={status === 'tagged_bad'}>
      {t(s.label, { defaultValue: status })}
    </Badge>
  );
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

