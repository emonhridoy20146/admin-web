'use client';
import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useGate } from '@/shared/feature/useGate';
import { formatDate, formatMoney, formatMoneyCompact, formatMonth, formatNumber, formatPercent } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { Card, CardHeader } from '@/shared/ui/card';
import { ChartCard } from '@/shared/ui/chart-card';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import { Segmented } from '@/shared/ui/primitives';
import { PrintOnly } from '@/shared/ui/print';
import { useTrends } from '../api/reports';
import { collectionTotals, overdueView, RANGES, rangeWindow } from '../model/reports';

const BarTrend = dynamic(() => import('@/shared/ui/charts/bar-trend'), { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> });

export function TrendsTab() {
  const { t } = useTranslation('reports');
  useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const router = useRouter();
  const gate = useGate();
  const canCollections = gate.can('collection.view') && gate.flag('module.collections');
  const url = useUrlState();
  const range = oneOf(url.get('range'), RANGES, '30d');
  const today = todayDhaka();
  const w = rangeWindow(range, today);
  const q = useTrends(w.from, w.to, w.granularity);
  const points = useMemo(() => q.data?.collection ?? [], [q.data?.collection]);
  const sum = useMemo(() => collectionTotals(points), [points]);
  const od = useMemo(() => overdueView(q.data?.overdue), [q.data?.overdue]);
  const weekly = w.granularity === 'week';
  const label = (period: string) => (period.length === 7 ? formatMonth(period) : formatDate(period));
  const full = (period: string) => (weekly ? t('trends.weekOf', { date: formatDate(period) }) : label(period));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <Segmented label={t('range.label')} value={range} onChange={(v) => url.set({ range: v === '30d' ? null : v })} options={RANGES.map((r) => ({ value: r, label: t(`range.${r}`) }))} />
        <PrintOnly className="print:inline">({formatDate(w.from)} – {formatDate(w.to)})</PrintOnly>
      </div>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}

      <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line shadow-e1 lg:grid-cols-4 print:grid-cols-4 [&>*]:bg-surface">
        <div className="col-span-2 px-4 py-3 lg:col-span-1 print:col-span-1">
          <dt className="text-xs text-fg-tertiary">{t('trends.collected')}</dt>
          <dd className="mt-0.5 text-lg font-semibold text-fg">
            {q.isLoading ? <Skeleton className="h-7 w-28" /> : <MoneyText poisha={sum.totalPoisha} />}
            <span className="block text-xs font-normal text-fg-tertiary">{t('trends.collectedHelp')}</span>
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-fg-tertiary">{t('trends.cash')}</dt>
          <dd className="mt-0.5 text-md font-semibold text-fg">
            {q.isLoading ? <Skeleton className="h-6 w-20" /> : <MoneyText poisha={sum.cashPoisha} />}
            <span className="block text-xs font-normal text-fg-secondary">{t('trends.mobile')}: {q.isLoading ? '' : formatMoney(sum.mobilePoisha)}</span>
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-fg-tertiary">{t('trends.count')}</dt>
          <dd className="tabular mt-0.5 text-md font-semibold text-fg">{q.isLoading ? <Skeleton className="h-6 w-12" /> : formatNumber(sum.count)}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-fg-tertiary">{t('trends.visits')}</dt>
          <dd className="tabular mt-0.5 text-md font-semibold text-fg">{q.isLoading ? <Skeleton className="h-6 w-12" /> : formatNumber(sum.visits)}</dd>
        </div>
      </dl>

      <div className="grid gap-4 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-8"
          title={weekly ? t('trends.chartTitleWeek') : t('trends.chartTitle')}
          subtitle={weekly ? t('trends.chartSubWeek') : canCollections ? t('trends.chartSub') : undefined}
          chart={
            q.isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : !points.length ? (
              <p className="py-16 text-center text-sm text-fg-tertiary">{t('trends.empty')}</p>
            ) : (
              <BarTrend
                height={260}
                data={points.map((p, i) => ({
                  key: p.period ?? String(i),
                  label: label(p.period ?? ''),
                  value: p.totalPoisha ?? 0,
                  valueText: formatMoney(p.totalPoisha ?? 0),
                  sub: t('trends.sub', { receipts: formatNumber(p.count ?? 0), visits: formatNumber(p.visits ?? 0) }),
                  highlight: i === points.length - 1,
                }))}
                axisFormat={(v) => formatMoneyCompact(v)}
                onBarClick={!weekly && canCollections ? (p) => router.push(`/collections/?from=${p.key}&to=${p.key}`) : undefined}
              />
            )
          }
          table={
            <div className="max-h-80 overflow-auto print:max-h-none print:overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-start text-xs text-fg-tertiary">
                    <th scope="col" className="py-2 text-start font-medium">{t('trends.period')}</th>
                    <th scope="col" className="py-2 text-end font-medium">{t('trends.collected')}</th>
                    <th scope="col" className="py-2 text-end font-medium">{t('trends.cash')}</th>
                    <th scope="col" className="py-2 text-end font-medium">{t('trends.mobile')}</th>
                    <th scope="col" className="py-2 text-end font-medium">{t('trends.count')}</th>
                    <th scope="col" className="py-2 text-end font-medium">{t('trends.visits')}</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, i) => (
                    <tr key={p.period ?? i} className="border-b border-line last:border-0">
                      <th scope="row" className="py-2 text-start font-normal text-fg">{full(p.period ?? '')}</th>
                      <td className="tabular py-2 text-end font-medium text-fg">{formatMoney(p.totalPoisha ?? 0)}</td>
                      <td className="tabular py-2 text-end text-fg-secondary">{formatMoney(p.cashPoisha ?? 0)}</td>
                      <td className="tabular py-2 text-end text-fg-secondary">{formatMoney(p.mobilePoisha ?? 0)}</td>
                      <td className="tabular py-2 text-end text-fg-secondary">{formatNumber(p.count ?? 0)}</td>
                      <td className="tabular py-2 text-end text-fg-secondary">{formatNumber(p.visits ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        />

        <Card className="xl:col-span-4">
          <CardHeader title={t('trends.overdueTitle')} subtitle={od ? t('trends.overdueSub', { date: formatDate(od.date) }) : undefined} />
          {q.isLoading ? (
            <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : !od ? (
            <p className="px-4 py-12 text-center text-sm text-fg-tertiary">{t('trends.noOverdue')}</p>
          ) : (
            <div className="p-4">
              <p className="text-xs text-fg-tertiary">{t('trends.overdueTotal')}</p>
              <p className="text-lg font-semibold text-fg"><MoneyText poisha={od.totalPoisha} /></p>
              <p className="text-xs text-fg-secondary">{t('trends.customers', { n: formatNumber(od.totalCount) })}</p>
              {od.changePoisha !== null && od.since && (
                <p className={cn('mt-1.5 flex items-center gap-1.5 text-sm', od.changePoisha > 0 ? 'text-danger' : od.changePoisha < 0 ? 'text-success' : 'text-fg-secondary')}>
                  {od.changePoisha > 0 ? <TrendingUp className="size-4" aria-hidden /> : od.changePoisha < 0 ? <TrendingDown className="size-4" aria-hidden /> : null}
                  {od.changePoisha === 0
                    ? t('trends.changeNone', { date: formatDate(od.since) })
                    : t(od.changePoisha > 0 ? 'trends.changeUp' : 'trends.changeDown', { date: formatDate(od.since), amount: formatMoney(Math.abs(od.changePoisha)) })}
                </p>
              )}
              <ul className="mt-4 space-y-3">
                {od.buckets.map((b) => (
                  <li key={b.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-fg">{t(`trends.bucket.${b.key}`)}</span>
                      <span className="tabular font-medium text-fg">{formatMoney(b.poisha)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
                      <div className={cn('h-full rounded-full', b.key === 'd90p' ? 'bg-danger' : b.key === 'd61_90' ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.round(b.share * 100)}%` }} />
                    </div>
                    <p className="tabular mt-0.5 text-xs text-fg-tertiary">{t('trends.customers', { n: formatNumber(b.count) })} · {formatPercent(b.share)}</p>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-secondary">{t('trends.badSuggested')}</dt>
                  <dd className="tabular font-medium text-fg">{formatNumber(od.badSuggested)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-secondary">{t('trends.tagged')}</dt>
                  <dd className="tabular font-medium text-fg">{formatNumber(od.tagged)}</dd>
                </div>
              </dl>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
