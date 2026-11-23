'use client';
/**
 * FR-W-064: the sections of the overview below the KPI strip. Every number and every bar links to the list that
 * produced it (03 §1.2); ERP-derived figures say "as of"; every chart has a table view (ChartCard).
 */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Banknote, CircleAlert, GitMerge, MapPinned, PowerOff, Settings2, Trophy, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useSession } from '@/shared/auth/session';
import { useGate } from '@/shared/feature/useGate';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatTime, pickText } from '@/shared/lib/format';
import { Card, CardHeader } from '@/shared/ui/card';
import { ChartCard } from '@/shared/ui/chart-card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import { Avatar } from '@/shared/ui/primitives';
import { useBranches } from '@/features/shell';
import { useBranchMonth, useMonthLeaders, usePayStateCounts, usePendingPins, useStaffMonth } from '../api/dashboard';
import { promiseRate, shares, type Day, type MonthCompare } from '../model/overview';

const StackedBars = dynamic(() => import('@/shared/ui/charts/stacked-bars'), { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> });
const LineCompare = dynamic(() => import('@/shared/ui/charts/line-compare'), { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> });

const th = 'py-2 text-start font-semibold';
const thEnd = 'py-2 text-end font-semibold';

/** "as of 10:42" under ERP-derived figures. */
export function AsOf({ at }: { at?: string | null }) {
  const { t } = useTranslation('dashboard');
  if (!at) return null;
  return <span className="text-xs text-fg-tertiary">{t('asOf', { time: formatTime(at) })}</span>;
}

/**
 * Modules that are switched off, for people who may switch them on. Eye-catching but secondary: a slim card above
 * the dashboard, never in place of it.
 */
export function ModulesOffCard() {
  const { t } = useTranslation('dashboard');
  const gate = useGate();
  const flags = useSession((s) => s.branchFlags ?? s.flags);
  const off = Object.entries(flags ?? {}).filter(([k, v]) => k.startsWith('module.') && v !== true).map(([k]) => k.slice(7));
  if (!gate.can('flag.manage') || off.length === 0) return null;
  return (
    <Link
      href="/admin/flags/"
      className="group mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-primary/25 bg-gradient-to-r from-primary-subtle to-surface px-4 py-3 shadow-e1 transition-shadow duration-[var(--dur-base)] hover:shadow-e2"
      data-testid="modules-off"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-fg shadow-e1">
        <PowerOff className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{t('modulesOff.title', { n: formatNumber(off.length) })}</span>
        <span className="block truncate text-xs text-fg-secondary">{off.slice(0, 6).join(' · ')}{off.length > 6 ? ' …' : ''}</span>
      </span>
      <span className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-surface px-3 text-sm font-medium text-primary shadow-e1 ring-1 ring-line group-hover:bg-surface-hover">
        <Settings2 className="size-4" aria-hidden />
        {t('modulesOff.action')}
      </span>
    </Link>
  );
}

/** Collections per day over the last 30 days, cash and mobile money stacked; a bar opens that day's collections. */
export function TrendCard({ days, loading, error, onRetry, className }: { days: Day[]; loading: boolean; error?: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  const router = useRouter();
  const last = days.slice(-30);
  const sum = last.reduce((s, d) => s + d.total, 0);
  const best = last.reduce<Day | null>((b, d) => (!b || d.total > b.total ? d : b), null);
  const series = [
    { key: 'cash', label: tc('method.cash'), token: '--pay-cash' },
    { key: 'mobile', label: t('mobileMoney'), token: '--pay-bkash' },
  ];
  return (
    <ChartCard
      className={className}
      title={t('trend30.title')}
      subtitle={t('trend30.sub', { total: formatMoneyCompact(sum) })}
      actions={best && best.total > 0 ? <span className="hidden text-xs text-fg-tertiary md:inline">{t('trend30.best', { date: formatDate(best.date, { withYear: false }), amount: formatMoneyCompact(best.total) })}</span> : null}
      chart={
        error ? (
          <ErrorBanner error={error} onRetry={onRetry} />
        ) : loading ? (
          <Skeleton className="h-[264px] w-full" />
        ) : (
          <StackedBars
            data={last.map((d) => ({ key: d.date, label: formatDate(d.date, { withYear: false }), sub: formatDate(d.date), values: { cash: d.cash, mobile: d.mobile }, total: d.total, totalText: formatMoney(d.total) }))}
            series={series}
            totalLabel={t('total')}
            axisFormat={(v) => formatMoneyCompact(v)}
            valueFormat={(v) => formatMoney(v)}
            onBarClick={(r) => router.push(`/collections/?from=${r.key}&to=${r.key}`)}
          />
        )
      }
      table={
        <table className="w-full text-sm">
          <thead>
            <tr className="text-fg-secondary"><th scope="col" className={th}>{t('date')}</th><th scope="col" className={thEnd}>{tc('method.cash')}</th><th scope="col" className={thEnd}>{t('mobileMoney')}</th><th scope="col" className={thEnd}>{t('total')}</th></tr>
          </thead>
          <tbody>
            {[...last].reverse().map((d) => (
              <tr key={d.date} className="border-t border-line">
                <td className="py-2"><Link className="hover:text-primary" href={`/collections/?from=${d.date}&to=${d.date}`}>{formatDate(d.date)}</Link></td>
                <td className="py-2 text-end"><MoneyText poisha={d.cash} /></td>
                <td className="py-2 text-end"><MoneyText poisha={d.mobile} /></td>
                <td className="py-2 text-end font-medium"><MoneyText poisha={d.total} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

/** Running total of this month against last month, day by day. */
export function MonthCard({ m, loading, className }: { m: MonthCompare | null; loading: boolean; className?: string }) {
  const { t } = useTranslation('dashboard');
  const rows = m?.cumulative ?? [];
  return (
    <ChartCard
      className={className}
      title={t('month.title')}
      subtitle={m ? t('month.sub', { last: formatMoneyCompact(m.lastMonthTotal) }) : undefined}
      actions={
        m ? (
          <Link href="/collections/?range=month" className="hidden rounded-sm px-2 py-1 text-xs font-medium text-primary hover:bg-surface-hover sm:inline">
            {t('month.open')}
          </Link>
        ) : null
      }
      chart={
        loading || !m ? (
          <Skeleton className="h-[264px] w-full" />
        ) : (
          <LineCompare
            data={rows.map((r) => ({ key: String(r.day), label: formatNumber(r.day), values: { thisMonth: r.thisMonth, lastMonth: r.lastMonth } }))}
            series={[
              { key: 'thisMonth', label: t('month.this'), token: '--chart-1' },
              { key: 'lastMonth', label: t('month.last'), token: '--fg-tertiary', dashed: true },
            ]}
            titleOf={(r) => t('month.day', { n: r.label })}
            axisFormat={(v) => formatMoneyCompact(v)}
            valueFormat={(v) => formatMoney(v)}
          />
        )
      }
      table={
        <table className="w-full text-sm">
          <thead>
            <tr className="text-fg-secondary"><th scope="col" className={th}>{t('month.dayCol')}</th><th scope="col" className={thEnd}>{t('month.this')}</th><th scope="col" className={thEnd}>{t('month.last')}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day} className="border-t border-line">
                <td className="tabular py-1.5">{formatNumber(r.day)}</td>
                <td className="py-1.5 text-end">{r.thisMonth == null ? '—' : <MoneyText poisha={r.thisMonth} />}</td>
                <td className="py-1.5 text-end">{r.lastMonth == null ? '—' : <MoneyText poisha={r.lastMonth} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

/** Things waiting for a manager, each a link with its count. */
export function AlertsCard({ conflicts, overLimit, erpFailed, erpPending, pinsNow, className }: { conflicts: number; overLimit: number; erpFailed: number; erpPending: number; pinsNow?: number; className?: string }) {
  const { t } = useTranslation('dashboard');
  const gate = useGate();
  const pinsOn = gate.can('customer.location.approve') && gate.flag('module.customers');
  const pins = usePendingPins(pinsOn && pinsNow == null);
  const items: { key: string; icon: LucideIcon; n: number | undefined; href: string; show: boolean; danger?: boolean }[] = [
    { key: 'conflicts', icon: GitMerge, n: conflicts, href: '/collections/conflicts/', show: gate.flag('module.collections'), danger: true },
    { key: 'pins', icon: MapPinned, n: pinsNow ?? pins.data, href: '/pin-approvals/', show: pinsOn },
    { key: 'cash', icon: Banknote, n: overLimit, href: '/cash/', show: gate.flag('module.cash'), danger: true },
    { key: 'erpFailed', icon: CircleAlert, n: erpFailed, href: '/collections/?status=posting_failed&range=30d', show: gate.flag('module.collections'), danger: true },
    { key: 'erpPending', icon: CircleAlert, n: erpPending, href: '/collections/?status=received&range=30d', show: gate.flag('module.collections') },
  ];
  const shown = items.filter((i) => i.show);
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={t('alerts.title')} subtitle={t('alerts.sub')} />
      <ul className="flex-1 divide-y divide-line">
        {shown.map((i) => {
          const hot = (i.n ?? 0) > 0;
          return (
            <li key={i.key}>
              <Link href={i.href} className="group flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-surface-hover">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-md', hot ? (i.danger ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning') : 'bg-success-bg text-success')}>
                  <i.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{t(`alerts.${i.key}`)}</span>
                  <span className="block text-xs text-fg-tertiary">{hot ? t(`alerts.${i.key}Body`) : t('alerts.clear')}</span>
                </span>
                <span className={cn('tabular text-xl font-semibold', hot ? (i.danger ? 'text-danger' : 'text-warning') : 'text-fg-tertiary')}>{i.n == null ? '—' : formatNumber(i.n)}</span>
                <ArrowRight className="size-4 text-fg-disabled group-hover:text-fg-tertiary rtl:rotate-180" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const PAY_STATES = ['bad', 'missed_many', 'missed_one', 'due_today', 'on_track', 'paid_off'] as const;
const PS_TOKEN: Record<(typeof PAY_STATES)[number], string> = {
  bad: '--ps-bad-pin',
  missed_many: '--ps-missed-many-pin',
  missed_one: '--ps-missed-one-pin',
  due_today: '--ps-due-today-pin',
  on_track: '--ps-on-track-pin',
  paid_off: '--ps-paid-off-pin',
};

/** Customers by pay state (the pin colours), as horizontal bars; each opens the customer list filtered to it. */
export function PayStateCard({ asOf, fromOverview, className }: { asOf?: string | null; fromOverview?: { payState: string; count: number }[] | null; className?: string }) {
  const { t } = useTranslation('dashboard');
  // 1.45.0 sends the counts with the overview; an older server is asked once per state
  const q = usePayStateCounts(PAY_STATES, !fromOverview);
  const counts = fromOverview ? Object.fromEntries(fromOverview.map((x) => [x.payState, x.count])) : q.data;
  const rows = counts ? shares(Object.fromEntries(PAY_STATES.map((s) => [s, counts[s] ?? 0])) as Record<(typeof PAY_STATES)[number], number>) : [];
  const total = rows.reduce((s, r) => s + r.n, 0);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={t('pay.title')} subtitle={t('pay.sub', { n: formatNumber(total) })} actions={<AsOf at={asOf} />} />
      <div className="flex-1 p-4">
        {!fromOverview && q.error ? (
          <ErrorBanner error={q.error} onRetry={() => q.refetch()} />
        ) : !counts ? (
          <div className="space-y-3">{PAY_STATES.map((s) => <Skeleton key={s} className="h-7" />)}</div>
        ) : (
          <>
            <div className="mb-4 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={rows.map((r) => `${t(`pay.state.${r.key}`)} ${formatPercent(r.share)}`).join(', ')}>
              {rows.filter((r) => r.n > 0).map((r) => <span key={r.key} style={{ width: `${r.share * 100}%`, background: `var(${PS_TOKEN[r.key]})` }} />)}
            </div>
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.key}>
                  <Link href={`/customers/?pay=${r.key}`} className="group grid min-h-9 grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-1 text-sm hover:bg-surface-hover">
                    <span className="inline-flex items-center gap-2 truncate text-fg">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(${PS_TOKEN[r.key]})` }} aria-hidden />
                      {t(`pay.state.${r.key}`)}
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: `var(${PS_TOKEN[r.key]})` }} />
                    </span>
                    <span className="tabular w-20 text-end font-medium text-fg">
                      {formatNumber(r.n)} <span className="text-xs font-normal text-fg-tertiary">{formatPercent(r.share)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/** Who is at work today: present, late, absent, on duty now. */
export function AttendanceCard({ a, loading, className }: { a?: { present?: number; late?: number; absent?: number; onDutyNow?: number }; loading: boolean; className?: string }) {
  const { t } = useTranslation('dashboard');
  const present = a?.present ?? 0;
  const late = a?.late ?? 0;
  const absent = a?.absent ?? 0;
  // `present` counts everyone who came, late or not
  const onTime = Math.max(0, present - late);
  const all = present + absent;
  const parts = [
    { key: 'onTime', n: onTime, cls: 'bg-success', href: '/attendance/' },
    { key: 'late', n: late, cls: 'bg-warning', href: '/attendance/' },
    { key: 'absent', n: absent, cls: 'bg-danger', href: '/attendance/' },
  ];
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={t('att.title')} subtitle={t('att.sub', { n: formatNumber(a?.onDutyNow ?? 0) })} />
      <div className="flex-1 p-4">
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : all === 0 ? (
          <EmptyState icon={CircleAlert} title={t('att.none')} className="py-6" />
        ) : (
          <>
            <Link href="/attendance/" className="flex items-baseline gap-2 hover:text-primary">
              <span className="tabular text-4xl font-bold tracking-tight text-fg">{formatNumber(present)}</span>
              <span className="text-sm text-fg-secondary">{t('att.ofAll', { n: formatNumber(all) })}</span>
            </Link>
            <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${t(`att.${p.key}`)} ${formatNumber(p.n)}`).join(', ')}>
              {parts.filter((p) => p.n > 0).map((p) => <span key={p.key} className={p.cls} style={{ width: `${(p.n / all) * 100}%` }} />)}
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-2">
              {parts.map((p) => (
                <li key={p.key}>
                  <Link href={p.href} className="block rounded-md border border-line px-2.5 py-2 hover:bg-surface-hover">
                    <span className="flex items-center gap-1.5 text-xs text-fg-secondary"><span className={cn('size-2 rounded-full', p.cls)} aria-hidden />{t(`att.${p.key}`)}</span>
                    <span className="tabular mt-0.5 block text-lg font-semibold text-fg">{formatNumber(p.n)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/** Promises: kept this month as a ring, due today and broken yesterday as links. */
export function PromiseCard({ dueToday, brokenYesterday, keptToday, className }: { dueToday: number; brokenYesterday: number; keptToday: number; className?: string }) {
  const { t } = useTranslation('dashboard');
  const q = useStaffMonth();
  const r = promiseRate(q.data);
  const pct = r.rate ?? 0;
  const R = 36;
  const C = 2 * Math.PI * R;
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={t('prom.title')} subtitle={t('prom.sub')} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {q.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Link href="/promises/?range=month&status=kept" className="flex items-center gap-4 rounded-md hover:bg-surface-hover">
            <svg viewBox="0 0 88 88" className="size-24 shrink-0 -rotate-90" role="img" aria-label={r.rate == null ? t('prom.noneDue') : t('prom.rate', { pct: formatPercent(pct) })}>
              <circle cx="44" cy="44" r={R} fill="none" strokeWidth="9" className="stroke-surface-hover" />
              {pct > 0 && <circle cx="44" cy="44" r={R} fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-success" strokeDasharray={`${C * pct} ${C}`} />}
            </svg>
            <span>
              <span className="tabular block text-3xl font-semibold tracking-tight text-fg">{r.rate == null ? '—' : formatPercent(pct)}</span>
              <span className="block text-sm text-fg-secondary">{t('prom.kept', { kept: formatNumber(r.kept), due: formatNumber(r.due) })}</span>
            </span>
          </Link>
        )}
        <div className="mt-auto grid grid-cols-3 gap-2">
          <MiniStat href="/promises/" label={t('prom.dueToday')} value={dueToday} />
          <MiniStat href="/promises/?range=today&status=kept" label={t('prom.keptToday')} value={keptToday} good />
          <MiniStat href="/promises/?range=yesterday&status=broken" label={t('prom.broken')} value={brokenYesterday} bad />
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ href, label, value, good, bad }: { href: string; label: string; value: number; good?: boolean; bad?: boolean }) {
  return (
    <Link href={href} className="block rounded-md border border-line px-2.5 py-2 hover:bg-surface-hover">
      <span className="block truncate text-xs text-fg-secondary">{label}</span>
      <span className={cn('tabular mt-0.5 block text-lg font-semibold', value > 0 && good ? 'text-success' : value > 0 && bad ? 'text-danger' : 'text-fg')}>{formatNumber(value)}</span>
    </Link>
  );
}

/** Top collectors of the month (the leaderboard's first five). */
export function LeadersCard({ className }: { className?: string }) {
  const { t } = useTranslation('dashboard');
  const gate = useGate();
  const on = gate.can('report.view') && gate.flag('module.reports');
  const q = useMonthLeaders(on);
  const rows = (q.data?.items ?? []).filter((r) => (r.collectedPoisha ?? 0) > 0).slice(0, 5);
  const max = Math.max(1, ...rows.map((r) => r.collectedPoisha ?? 0));
  if (!on) return null;
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title={t('leaders.title')}
        subtitle={t('leaders.sub')}
        actions={<Link href="/leaderboard/?period=month" className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary hover:bg-surface-hover"><Trophy className="size-4" aria-hidden />{t('leaderboard')}</Link>}
      />
      <div className="flex-1 p-2">
        {q.error ? (
          <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="m-2" />
        ) : q.isLoading ? (
          <div className="space-y-2 p-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Trophy} title={t('leaders.none')} className="py-8" />
        ) : (
          <ol className="space-y-1">
            {rows.map((r, i) => (
              <li key={r.userId}>
                <Link href={`/collections/?collectorId=${r.userId}&range=month`} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-hover">
                  <span className={cn('tabular grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', i === 0 ? 'bg-warning-bg text-warning' : 'bg-surface-hover text-fg-secondary')}>{formatNumber(i + 1)}</span>
                  <Avatar name={r.name ?? ''} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${((r.collectedPoisha ?? 0) / max) * 100}%` }} />
                    </span>
                  </span>
                  <MoneyText poisha={r.collectedPoisha ?? 0} className="text-sm font-semibold" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

/** Branches side by side this month (only when all branches are shown). */
export function BranchesCard({ className }: { className?: string }) {
  const { t } = useTranslation('dashboard');
  const locale = useUi((s) => s.locale);
  const branchId = useUi((s) => s.branchId);
  const branches = useBranches();
  const list = useMemo(() => (branches.data ?? []).filter((b) => b.id), [branches.data]);
  const ids = useMemo(() => list.map((b) => b.id!), [list]);
  const q = useBranchMonth(branchId ? [] : ids);
  if (branchId || ids.length < 2) return null;
  const rows = [...(q.data ?? [])].sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...rows.map((r) => r.total));
  const nameOf = (id: string) => {
    const b = list.find((x) => x.id === id);
    return b ? pickText(b.name as never, locale) || b.code || id : id;
  };
  return (
    <ChartCard
      className={className}
      title={t('branches.title')}
      subtitle={t('branches.sub')}
      chart={
        q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/collections/?range=month&branch=${r.id}`} className="grid min-h-10 grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-1 text-sm hover:bg-surface-hover">
                  <span className="truncate font-medium text-fg">{nameOf(r.id)}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
                    <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(r.total / max) * 100}%` }} />
                  </span>
                  <span className="tabular w-36 text-end">
                    <MoneyText poisha={r.total} className="font-semibold" />
                    <span className="block text-xs text-fg-tertiary">{t('branches.counts', { receipts: formatNumber(r.count), visits: formatNumber(r.visits) })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      }
      table={
        <table className="w-full text-sm">
          <thead><tr className="text-fg-secondary"><th scope="col" className={th}>{t('branches.branch')}</th><th scope="col" className={thEnd}>{t('collected')}</th><th scope="col" className={thEnd}>{t('count')}</th><th scope="col" className={thEnd}>{t('branches.visits')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2">{nameOf(r.id)}</td>
                <td className="py-2 text-end"><MoneyText poisha={r.total} /></td>
                <td className="tabular py-2 text-end">{formatNumber(r.count)}</td>
                <td className="tabular py-2 text-end">{formatNumber(r.visits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}
