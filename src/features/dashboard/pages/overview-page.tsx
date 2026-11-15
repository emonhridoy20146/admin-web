'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AlarmClock, Banknote, Flag, GitMerge, Handshake, Wallet } from 'lucide-react';
import { DateTime } from 'luxon';
import { cn } from '@/shared/lib/cn';
import { useSession } from '@/shared/auth/session';
import { useGate } from '@/shared/feature/useGate';
import { dashboardWidgets } from '@/shared/feature/registry';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatTime, formatWeekday, pickText } from '@/shared/lib/format';
import { DHAKA } from '@/shared/lib/time';
import { PageHeader } from '@/shared/ui/page';
import { KpiCard } from '@/shared/ui/kpi-card';
import { ChartCard } from '@/shared/ui/chart-card';
import { Card, CardHeader } from '@/shared/ui/card';
import { ErrorBanner, Skeleton, EmptyState } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import { Avatar } from '@/shared/ui/primitives';
import { useOverview, useStaffToday } from '../api/dashboard';

const BarTrend = dynamic(() => import('@/shared/ui/charts/bar-trend'), { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> });

const METHOD_TOKEN: Record<string, string> = { cash: 'bg-pay-cash', bkash: 'bg-pay-bkash', nagad: 'bg-pay-nagad', rocket: 'bg-pay-rocket', bank_transfer: 'bg-pay-bank', other_mobile: 'bg-pay-other' };

export function OverviewPage() {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  const user = useSession((s) => s.user);
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const gate = useGate();
  const router = useRouter();
  const q = useOverview();
  const d = q.data;
  const hour = DateTime.now().setZone(DHAKA).hour;
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const firstName = pickText(user?.name, locale).split(' ').slice(0, locale === 'bn' ? 2 : 1).join(' ');
  const trend = d?.trend7d ?? [];
  const today = trend[trend.length - 1];
  const yesterday = trend[trend.length - 2];
  const target = d?.collected?.targetPoisha ?? 0;
  const progress = target ? (d?.collected?.totalPoisha ?? 0) / target : null;
  const widgets = dashboardWidgets(gate);
  const conflicts = (d?.exceptions?.conflicts ?? 0) + (d?.exceptions?.postingFailed ?? 0);
  const todayIso = d?.date ?? '';

  return (
    <>
      <PageHeader title={t(`greeting.${greet}`, { name: firstName })} asOf={d?.erp?.lastSuccessAt}>
        {todayIso && <span>{formatWeekday(todayIso)}, {formatDate(todayIso)}</span>}
      </PageHeader>

      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="mb-4" /> : null}

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          loading={q.isLoading}
          label={t('collectedToday')}
          icon={Wallet}
          href={`/collections/?from=${todayIso}&to=${todayIso}`}
          value={<MoneyText poisha={d?.collected?.totalPoisha ?? 0} />}
          sub={progress != null ? t('ofTarget', { pct: formatPercent(progress), target: formatMoneyCompact(target) }) : undefined}
          progress={progress}
          trend={trend.map((p) => p.collectedPoisha ?? 0)}
          footer={t('receipts', { n: formatNumber(d?.collected?.count ?? 0) })}
        />
        <KpiCard
          loading={q.isLoading}
          label={t('cashOnHand')}
          icon={Banknote}
          href="/cash/"
          value={<MoneyText poisha={d?.cash?.onHandPoisha ?? 0} />}
          sub={t('pendingDeposits', { n: formatNumber(d?.cash?.pendingDeposits ?? 0) })}
          tone={(d?.cash?.overLimitStaff ?? 0) > 0 ? 'attention' : 'default'}
          footer={(d?.cash?.overLimitStaff ?? 0) > 0 ? <span className="font-medium text-danger">{t('overLimit', { n: formatNumber(d?.cash?.overLimitStaff ?? 0) })}</span> : undefined}
        />
        <KpiCard
          loading={q.isLoading}
          label={t('conflicts')}
          icon={GitMerge}
          href="/collections/conflicts/"
          value={formatNumber(conflicts)}
          sub={t('conflictsSub')}
          tone={conflicts > 0 ? 'attention' : 'default'}
        />
        <KpiCard
          loading={q.isLoading}
          label={t('overdue')}
          icon={AlarmClock}
          href="/customers/?filter=overdue"
          value={formatNumber(d?.overdue?.customers ?? 0)}
          sub={t('overdueAmount', { amount: formatMoneyCompact(d?.overdue?.amountPoisha ?? 0) })}
        />
        <KpiCard
          loading={q.isLoading}
          label={t('promisedToday')}
          icon={Handshake}
          href="/customers/?filter=promised_today"
          value={formatNumber(d?.promises?.dueToday ?? 0)}
          sub={t('promisedSub', { n: formatNumber(d?.promises?.brokenYesterday ?? 0) })}
        />
        <KpiCard
          loading={q.isLoading}
          label={t('badSuggested')}
          icon={Flag}
          href="/customers/?filter=bad_suggested"
          value={formatNumber(d?.overdue?.badSuggested ?? 0)}
          sub={t('badSub', { n: formatNumber(d?.overdue?.tagged ?? 0) })}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-8"
          title={t('trendTitle')}
          subtitle={t('trendSub')}
          chart={
            q.isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <BarTrend
                data={trend.map((p, i) => ({
                  key: p.date!,
                  label: i === trend.length - 1 ? tc('time.today') : formatWeekday(p.date!),
                  value: p.collectedPoisha ?? 0,
                  valueText: formatMoney(p.collectedPoisha ?? 0),
                  sub: formatDate(p.date!),
                  highlight: i === trend.length - 1,
                }))}
                axisFormat={(v) => formatMoneyCompact(v)}
                onBarClick={(p) => router.push(`/collections/?from=${p.key}&to=${p.key}`)}
              />
            )
          }
          table={
            <table className="w-full text-sm">
              <thead>
                <tr className="text-fg-secondary">
                  <th scope="col" className="py-2 text-start font-semibold">{t('date')}</th>
                  <th scope="col" className="py-2 text-end font-semibold">{t('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((p) => (
                  <tr key={p.date} className="border-t border-line">
                    <td className="py-2">
                      <Link className="hover:text-primary" href={`/collections/?from=${p.date}&to=${p.date}`}>{formatWeekday(p.date!)}, {formatDate(p.date!)}</Link>
                    </td>
                    <td className="py-2 text-end"><MoneyText poisha={p.collectedPoisha ?? 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          actions={
            today && yesterday && (yesterday.collectedPoisha ?? 0) > 0 ? (
              <span className="hidden text-xs text-fg-tertiary sm:inline">
                {tc('time.yesterday')}: <MoneyText poisha={yesterday.collectedPoisha ?? 0} compact />
              </span>
            ) : null
          }
        />
        <MethodMix loading={q.isLoading} total={d?.collected?.totalPoisha ?? 0} cash={d?.collected?.cashPoisha ?? 0} mobile={d?.collected?.mobilePoisha ?? 0} date={todayIso} erp={d?.erp} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <StaffToday className={widgets.length ? 'xl:col-span-7' : 'xl:col-span-12'} />
        {widgets.map((w) => (
          <div key={w.id} className={cn(widgets.length === 1 ? 'xl:col-span-5' : w.span === 12 ? 'xl:col-span-12' : 'xl:col-span-6')}>
            <w.component />
          </div>
        ))}
      </div>
    </>
  );
}

function MethodMix({ loading, total, cash, mobile, date, erp }: { loading: boolean; total: number; cash: number; mobile: number; date: string; erp?: { lastSuccessAt?: string; outboxPending?: number; outboxFailed?: number } }) {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  const parts = [
    { key: 'cash', value: cash },
    { key: 'mobile', value: mobile },
  ];
  return (
    <Card className="flex flex-col xl:col-span-4">
      <CardHeader title={t('mixTitle')} subtitle={t('mixSub')} />
      <div className="flex-1 p-4">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : total === 0 ? (
          <EmptyState icon={Wallet} title={t('noCollections')} className="py-6" />
        ) : (
          <>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-xs" role="img" aria-label={parts.map((p) => `${p.key} ${formatPercent(p.value / total)}`).join(', ')}>
              {parts.filter((p) => p.value > 0).map((p) => (
                <div key={p.key} className={cn('h-full first:rounded-s-xs last:rounded-e-xs', p.key === 'cash' ? METHOD_TOKEN.cash : METHOD_TOKEN.bkash)} style={{ width: `${(p.value / total) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-4 space-y-2.5">
              {parts.map((p) => (
                <li key={p.key}>
                  <Link href={`/collections/?from=${date}&to=${date}${p.key === 'cash' ? '&method=cash' : ''}`} className="flex items-center gap-2.5 rounded-sm text-base hover:text-primary">
                    <span className={cn('size-2.5 rounded-full', p.key === 'cash' ? METHOD_TOKEN.cash : METHOD_TOKEN.bkash)} aria-hidden />
                    <span className="flex-1">{p.key === 'cash' ? tc('method.cash') : `${tc('method.bkash')} · ${tc('method.nagad')} · ${tc('method.rocket')}`}</span>
                    <span className="tabular text-fg-tertiary">{formatPercent(p.value / total)}</span>
                    <MoneyText poisha={p.value} className="w-28 text-end font-medium" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="border-t border-line bg-surface-subtle px-4 py-3">
        <div className="text-sm font-semibold text-fg">{t('erpCard')}</div>
        <p className="mt-0.5 text-xs text-fg-tertiary">{t('erpBody')}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-fg-tertiary">{t('lastSync')}</dt>
            <dd className="tabular font-medium">{erp?.lastSuccessAt ? formatTime(erp.lastSuccessAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-tertiary">{t('waiting')}</dt>
            <dd className="tabular font-medium text-st-pending">{formatNumber(erp?.outboxPending ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-tertiary">{t('failed')}</dt>
            <dd className={cn('tabular font-medium', (erp?.outboxFailed ?? 0) > 0 ? 'text-danger' : '')}>{formatNumber(erp?.outboxFailed ?? 0)}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

function StaffToday({ className }: { className?: string }) {
  const { t } = useTranslation('dashboard');
  const q = useStaffToday();
  const rows = q.data ?? [];
  const max = Math.max(1, ...rows.map((r) => Math.max(r.collectedPoisha?.total ?? 0, r.targetPoisha ?? 0)));
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader title={t('leaderTitle')} subtitle={t('leaderSub')} />
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="m-3" /> : null}
      <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-surface-subtle">
            <tr className="text-xs text-fg-secondary">
              <th scope="col" className="px-4 py-2 text-start font-semibold">{t('staff')}</th>
              <th scope="col" className="hidden px-3 py-2 text-start font-semibold sm:table-cell">{t('target')}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">{t('count')}</th>
              <th scope="col" className="px-4 py-2 text-end font-semibold">{t('collected')}</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-4 py-3" colSpan={4}><Skeleton className="h-4" /></td>
                  </tr>
                ))
              : rows.map((r) => {
                  const total = r.collectedPoisha?.total ?? 0;
                  const pct = r.targetPoisha ? total / r.targetPoisha : 0;
                  return (
                    <tr key={r.userId} className="border-t border-line hover:bg-surface-hover">
                      <td className="px-4 py-2.5">
                        <Link href={`/collections/?collectorId=${r.userId}&from=${r.period}&to=${r.period}`} className="flex items-center gap-2.5 hover:text-primary">
                          <Avatar name={r.name ?? ''} className="size-7" />
                          <span className="truncate font-medium">{r.name}</span>
                        </Link>
                      </td>
                      <td className="hidden w-[38%] px-3 py-2.5 sm:table-cell">
                        <div className="relative h-1.5 rounded-full bg-surface-hover" aria-label={formatPercent(pct)}>
                          <div className={cn('h-full rounded-full', pct >= 1 ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.min(100, (total / max) * 100)}%` }} />
                          {r.targetPoisha ? <span className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-fg-tertiary" style={{ left: `${(r.targetPoisha / max) * 100}%` }} aria-hidden /> : null}
                        </div>
                      </td>
                      <td className="tabular px-3 py-2.5 text-end text-fg-secondary">{formatNumber(r.collectionsCount ?? 0)}</td>
                      <td className="px-4 py-2.5 text-end font-medium"><MoneyText poisha={total} /></td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
