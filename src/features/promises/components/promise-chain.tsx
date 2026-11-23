'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CornerDownRight, Handshake, Plus, Repeat } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import type { PromiseItem } from '../api/promises';
import { needsFollowUp } from '../model/promise';

export const PROMISE_TONE: Record<string, Tone> = { open: 'promised', kept: 'paid', partially_kept: 'dueToday', broken: 'danger', superseded: 'neutral', cancelled: 'neutral' };

type ChainItem = Pick<PromiseItem, 'id' | 'status' | 'attempt' | 'promisedDate' | 'promisedAmountPoisha' | 'paidTowardsPoisha' | 'followUpOf' | 'followUpId' | 'createdByName' | 'createdAt'>;

/** "Attempt 2" next to a status when a promise follows up an earlier one. */
export function AttemptBadge({ attempt }: { attempt?: number }) {
  const { t } = useTranslation('promises');
  if (!attempt || attempt < 2) return null;
  return (
    <Badge tone="info" icon={Repeat}>
      {t('chain.attempt', { n: formatNumber(attempt) })}
    </Badge>
  );
}

/**
 * FR-PRM-006: one chain as a vertical timeline, first promise on top: each step shows its attempt number, date,
 * amount, status and who made it; the open one (`currentId`) is marked. A broken last step offers "New follow-up
 * promise" to people who may make promises.
 */
export function PromiseChain({ chain, currentId, onFollowUp, hrefOf }: { chain: ChainItem[]; currentId?: string | null; onFollowUp?: (p: ChainItem) => void; hrefOf?: (p: ChainItem) => string }) {
  const { t } = useTranslation('promises');
  if (!chain.length) return null;
  const last = chain[chain.length - 1]!;
  return (
    <ol className="relative space-y-0" aria-label={t('chain.title')}>
      {chain.map((p, i) => {
        const on = p.id === currentId;
        const step = (
          <div className={cn('flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border px-3 py-2', on ? 'border-primary/40 bg-primary-subtle' : 'border-line bg-surface')}>
            <span className="min-w-0">
              <span className="block text-xs text-fg-tertiary">
                {t('chain.attempt', { n: formatNumber(p.attempt ?? i + 1) })} · {formatDate(p.promisedDate, { withYear: false })}
                {p.createdByName ? ` · ${t('chain.by', { name: p.createdByName })}` : ''}
              </span>
              <MoneyText poisha={p.promisedAmountPoisha} className="text-sm font-semibold" />
              {(p.paidTowardsPoisha ?? 0) > 0 && p.status !== 'kept' && <span className="ms-1.5 text-xs text-st-paid">{t('paidOf', { amount: formatMoney(p.paidTowardsPoisha ?? 0) })}</span>}
            </span>
            <Badge tone={PROMISE_TONE[p.status ?? 'open'] ?? 'neutral'}>{t(`status.${p.status ?? 'open'}`)}</Badge>
          </div>
        );
        return (
          <li key={p.id} className="relative flex gap-2 pb-2 last:pb-0" aria-current={on ? 'step' : undefined}>
            <span className="flex w-5 shrink-0 flex-col items-center pt-3" aria-hidden>
              <span className={cn('size-2.5 rounded-full ring-2 ring-surface', on ? 'bg-primary' : p.status === 'broken' ? 'bg-danger' : p.status === 'kept' ? 'bg-success' : 'bg-fg-disabled')} />
              {i < chain.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
            </span>
            {hrefOf && !on ? (
              <Link href={hrefOf(p)} className="flex min-w-0 flex-1 hover:opacity-90">{step}</Link>
            ) : (
              step
            )}
          </li>
        );
      })}
      {onFollowUp && needsFollowUp(last) && (
        <li className="flex gap-2 pt-1">
          <CornerDownRight className="ms-1 mt-2 size-4 shrink-0 text-fg-tertiary rtl:-scale-x-100" aria-hidden />
          <Button size="sm" variant="subtle" onClick={() => onFollowUp(last)} data-testid="new-follow-up">
            <Plus className="size-4" aria-hidden />
            {t('followUp.action')}
          </Button>
        </li>
      )}
    </ol>
  );
}

/** Empty state for a customer without promises. */
export function NoPromises() {
  const { t } = useTranslation('promises');
  return <EmptyState icon={Handshake} title={t('chain.none')} className="py-8" />;
}
