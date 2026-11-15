'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AlarmClock, ArrowRight, BellOff, Check, GitMerge, Banknote, Flag, ShieldAlert, Smartphone, MapPin, Handshake, CloudOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatRelative, pickText } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { STATUS } from '@/shared/ui/status';
import { Tooltip } from '@/shared/ui/primitives';
import type { InboxItem } from '../api/inbox';

const ICON: Record<string, LucideIcon> = {
  'collection.conflict': GitMerge,
  'collection.posting_failed': CloudOff,
  'cash.limit_exceeded': Banknote,
  'cash.deposit_pending': Banknote,
  'tag.balance_cleared': Flag,
  'fraud.mock_location': ShieldAlert,
  'device.pending_approval': Smartphone,
  'location.proposal': MapPin,
  'promise.broken': Handshake,
};
const RAIL: Record<string, string> = { critical: 'bg-danger', high: 'bg-st-overdue', medium: 'bg-warning', low: 'bg-fg-disabled' };

export function InboxRow({ item, compact, onSnooze, onResolve }: { item: InboxItem; compact?: boolean; onSnooze?: () => void; onResolve?: () => void }) {
  const { t } = useTranslation('inbox');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const Icon = ICON[item.type ?? ''] ?? AlarmClock;
  const sev = STATUS[item.severity ?? 'low']!;
  const actionLabel = t(`action.${item.type}`, { defaultValue: t('action.default') });
  return (
    <li className={cn('group relative flex items-start gap-3 py-3 ps-5 pe-3 sm:items-center sm:pe-4', !compact && 'hover:bg-surface-hover')}>
      <span className={cn('absolute inset-y-2 start-1.5 w-[3px] rounded-full', RAIL[item.severity ?? 'low'])} aria-hidden />
      <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface-subtle text-fg-secondary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-fg-secondary">{t(`types.${item.type}`, { defaultValue: item.type })}</span>
          {!compact && <Badge tone={sev.tone}>{tc(sev.label)}</Badge>}
          <span className="text-xs text-fg-tertiary">{formatRelative(item.createdAt!)}</span>
        </div>
        <p className={cn('mt-0.5 text-base text-fg', compact ? 'truncate' : 'line-clamp-2')} lang={locale}>{pickText(item.summary, locale)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!compact && onSnooze && (
          <Tooltip content={t('snooze')}>
            <Button variant="ghost" size="icon-sm" onClick={onSnooze} aria-label={t('snooze')} className="max-sm:hidden">
              <BellOff className="size-4" />
            </Button>
          </Tooltip>
        )}
        {!compact && onResolve && (
          <Tooltip content={t('markResolved')}>
            <Button variant="ghost" size="icon-sm" onClick={onResolve} aria-label={t('markResolved')} className="max-sm:hidden">
              <Check className="size-4" />
            </Button>
          </Tooltip>
        )}
        {item.link && (
          <Link
            href={item.link}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-sm px-3 text-sm font-medium whitespace-nowrap transition-colors [@media(pointer:coarse)]:h-11',
              item.severity === 'critical' || item.severity === 'high' ? 'bg-primary text-primary-fg hover:bg-primary-hover' : 'border border-line-strong bg-surface text-fg hover:bg-surface-hover',
            )}
          >
            {actionLabel}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}
