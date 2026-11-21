'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Activity, Banknote, Footprints, Handshake, MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatMoney, formatTime, pickText } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { FilterChip } from '@/shared/ui/primitives';
import { useActivity, useMarkActivitySeen, type ActivityItem, type ActivityType } from '../api/activity';
import { byDay, hrefOf, sentenceKey } from '../model/activity';

const TYPES = ['collection', 'visit', 'promise', 'pin'] as const satisfies readonly ActivityType[];
const ICON = { collection: Banknote, visit: Footprints, promise: Handshake, pin: MapPin } as const;
const TONE = { collection: 'bg-success-bg text-success', visit: 'bg-info-bg text-info', promise: 'bg-st-promised-bg text-st-promised', pin: 'bg-warning-bg text-warning' } as const;

/**
 * FR-W-046 (master FR-ACT-001): what staff are doing, as it happens: collections, visits, promises and map pins,
 * newest first, with the person and the customer. Opening the page marks the feed as seen, which clears the bell.
 */
export function ActivityPage() {
  const { t } = useTranslation('activity');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const type = oneOf(url.get('type'), ['', ...TYPES] as const, '') || undefined;
  const userId = url.get('userId') || undefined;
  const q = useActivity(type, userId);
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const groups = useMemo(() => byDay(items), [items]);
  const seen = useMarkActivitySeen();
  const marked = useRef(false);
  // Mark as seen once the lines are on screen, so the "new" dots stay visible on this visit.
  useEffect(() => {
    if (!marked.current && q.isSuccess) {
      marked.current = true;
      seen.mutate();
    }
  }, [q.isSuccess, seen]);
  const actor = items.find((i) => i.actor?.id === userId)?.actor;

  return (
    <>
      <PageHeader title={t('title')} print>
        <span>{t('subtitle')}</span>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <FilterChip selected={!type} onClick={() => url.set({ type: null })}>{t('all')}</FilterChip>
          {TYPES.map((x) => (
            <FilterChip key={x} selected={type === x} onClick={() => url.set({ type: type === x ? null : x })}>{t(`type.${x}`)}</FilterChip>
          ))}
        </div>
        {userId && (
          <Button variant="ghost" size="sm" onClick={() => url.set({ userId: null })}>
            {t('onlyPerson', { name: pickText(actor?.name, locale) || actor?.employeeCode || '…' })} ✕
          </Button>
        )}
      </div>

      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="mb-4" /> : null}

      {q.isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Activity} title={t('empty')} body={t('emptyBody')} />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.day} aria-label={formatDate(g.day, { withYear: true })}>
              <h2 className="mb-2 text-sm font-semibold text-fg-secondary">{formatDate(g.day, { withYear: true })}</h2>
              <Card className="p-0">
                <ol className="divide-y divide-line">
                  {g.items.map((i) => <Line key={i.id} item={i} onPerson={(id) => url.set({ userId: id })} />)}
                </ol>
              </Card>
            </section>
          ))}
          {q.hasNextPage && (
            <div className="flex justify-center print:hidden">
              <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{t('more')}</Button>
            </div>
          )}
        </div>
      )}
      <p className="mt-4 text-xs text-fg-tertiary">{t('how')}</p>
    </>
  );
}

function Line({ item, onPerson }: { item: ActivityItem; onPerson: (id: string) => void }) {
  const { t } = useTranslation('activity');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const Icon = ICON[item.type];
  const href = hrefOf(item);
  const who = pickText(item.actor?.name, locale) || item.actor?.employeeCode || t('someone');
  const customer = pickText(item.customer?.name, locale) || item.customer?.code || '';
  const d = item.data;
  const facts = [
    d.amountPoisha != null ? formatMoney(d.amountPoisha) : null,
    d.method ? tc(`method.${d.method}`) : null,
    d.outcome ? t(`outcome.${d.outcome}`, { defaultValue: d.outcome }) : null,
    d.promisedDate ? t('promisedFor', { date: formatDate(d.promisedDate) }) : null,
    item.type === 'pin' ? (d.applied ? t('pinApplied') : t('pinWaits')) : null,
  ].filter(Boolean);
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={cn('mt-0.5 grid size-9 shrink-0 place-items-center rounded-full', TONE[item.type])} aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base text-fg">
          {item.actor ? (
            <button type="button" onClick={() => onPerson(item.actor!.id!)} className="font-semibold hover:text-primary hover:underline" lang={locale} title={t('filterPerson')}>
              {who}
            </button>
          ) : (
            <span className="font-semibold">{who}</span>
          )}{' '}
          {t(sentenceKey(item))}
          {customer && (
            <>
              {' · '}
              {href ? <Link href={href} className="font-medium text-fg hover:text-primary" lang={locale}>{customer}</Link> : <span lang={locale}>{customer}</span>}
            </>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-secondary">
          <span className="tabular">{formatTime(item.at)}</span>
          {facts.length > 0 && <span>· {facts.join(' · ')}</span>}
          {(d.flags ?? []).map((f) => <Badge key={f} tone="warning" icon={false}>{tc(`flags.${f}`, { defaultValue: f })}</Badge>)}
        </p>
      </div>
      {item.unseen && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" role="img" aria-label={t('new')} />}
    </li>
  );
}
