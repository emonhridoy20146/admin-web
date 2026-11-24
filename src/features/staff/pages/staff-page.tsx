'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarCheck, Footprints, Handshake, Info, MapPinCheck, Target, Trophy, Users, UsersRound, Wallet } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useGate } from '@/shared/feature/useGate';
import { formatDate, formatDuration, formatMoney, formatMonth, formatNumber, formatPercent, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { EmptyState, Skeleton } from '@/shared/ui/feedback';
import { Avatar, Segmented } from '@/shared/ui/primitives';
import { Select } from '@/shared/ui/form';
import { MoneyText } from '@/shared/ui/money';
import { Badge } from '@/shared/ui/badge';
import { Drawer } from '@/shared/ui/overlay';
import { PrintButton, PrintOnly } from '@/shared/ui/print';
import { useAreas, usePerformance, type PerfRow } from '../api/staff';
import { byMethod, collected, jointWeight, sortRows, SORTS, targetRatio, targetToDate, totals, visitCredit, visitRatio, visitsTakenPart } from '../model/staff';

const PERIODS = ['daily', 'monthly'] as const;

function Progress({ ratio, label }: { ratio: number; label: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover" role="img" aria-label={label}>
      <div className={cn('h-full rounded-full', ratio >= 1 ? 'bg-success' : ratio >= 0.6 ? 'bg-primary' : 'bg-warning')} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  );
}

export function StaffPage() {
  const { t } = useTranslation('staff');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const today = todayDhaka();
  const period = oneOf(url.get('period'), PERIODS, 'daily');
  const sort = oneOf(url.get('sort'), SORTS, 'collected');
  const q = usePerformance(period, today);
  const rows = useMemo(() => sortRows(q.data ?? [], sort), [q.data, sort]);
  const sum = useMemo(() => totals(q.data), [q.data]);
  const openId = url.get('drawer');
  const open = rows.find((r) => r.userId === openId) ?? null;
  const gate = useGate();
  const canAreas = gate.can('assignment.view') && gate.flag('module.assignments');
  const areas = useAreas(canAreas && !!open);
  const links = {
    visits: gate.can('visit.view') && gate.flag('module.visits'),
    collections: gate.can('collection.view') && gate.flag('module.collections'),
    attendance: gate.can('attendance.view') && gate.flag('module.attendance'),
    sessions: gate.can('cowork.view') && gate.flag('module.cowork'),
    targets: gate.can('target.view') && gate.flag('module.targets'),
    leaderboard: gate.can('report.view') && gate.flag('module.reports'),
  };
  // FR-CW-005: single and joint visits are shown apart, and targets use the weighted visit credit
  const coworkOn = gate.flag('module.cowork') && gate.flag('module.visits');
  const num = (n: number) => formatNumber(n, { decimals: Number.isInteger(n) ? 0 : 2 });
  const credit = (r: PerfRow) => num(visitCredit(r));
  const monthly = period === 'monthly';
  const periodLabel = monthly ? formatMonth(today.slice(0, 7)) : formatDate(today);

  const columns: Column<PerfRow>[] = [
    {
      id: 'staff',
      header: t('col.staff'),
      priority: 1,
      mobile: 'title',
      cell: (r) => (
        <button type="button" onClick={() => url.set({ drawer: r.userId ?? null }, { push: true })} className="flex min-w-0 items-center gap-2.5 text-start">
          <Avatar name={r.name ?? '?'} />
          <span className="max-w-[200px] truncate font-medium text-fg hover:text-primary" lang={locale}>{r.name}</span>
        </button>
      ),
    },
    {
      id: 'collected',
      header: t('col.collected'),
      align: 'end',
      priority: 1,
      mobile: 'amount',
      width: '190px',
      cell: (r) => {
        const ratio = targetRatio(r);
        return (
          <span className="inline-flex w-full flex-col items-end gap-1">
            <MoneyText poisha={collected(r)} className="font-medium" />
            {ratio != null && <Progress ratio={ratio} label={t('ofTarget', { pct: formatPercent(ratio) })} />}
          </span>
        );
      },
    },
    {
      id: 'target',
      header: t('col.target'),
      align: 'end',
      priority: 3,
      cell: (r) => {
        const amount = targetRatio(r);
        const visits = visitRatio(r);
        if (amount == null && visits == null) return <span className="text-fg-tertiary">—</span>;
        return (
          <span className="inline-flex flex-col items-end">
            {amount != null ? <span className={cn('tabular', amount >= 1 ? 'font-medium text-success' : 'text-fg-secondary')}>{formatPercent(amount)}</span> : <span className="text-fg-tertiary">—</span>}
            {visits != null && <span className={cn('tabular text-xs', visits >= 1 ? 'text-success' : 'text-fg-tertiary')}>{t('visitOfTarget', { pct: formatPercent(visits) })}</span>}
          </span>
        );
      },
    },
    { id: 'count', header: t('col.count'), align: 'end', priority: 2, mobile: 'meta', cell: (r) => <span className="tabular">{formatNumber(r.collectionsCount ?? 0)}</span> },
    {
      id: 'visits',
      header: t('col.visits'),
      align: 'end',
      priority: 2,
      mobile: 'meta',
      cell: (r) => (
        <span className="inline-flex flex-col items-end">
          <span className="tabular">{formatNumber(coworkOn ? visitsTakenPart(r) : (r.visits ?? 0))}</span>
          {coworkOn && (r.coWorkVisits ?? 0) > 0 ? (
            <span className="text-xs text-info">{t('cowork.split', { solo: formatNumber(r.soloVisits ?? 0), joint: formatNumber(r.coWorkVisits ?? 0) })}</span>
          ) : (
            <span className="text-xs text-fg-tertiary">{t('unique', { n: formatNumber(r.uniqueCustomers ?? 0) })}</span>
          )}
        </span>
      ),
    },
    ...(coworkOn
      ? [{ id: 'credit', header: t('col.credit'), align: 'end' as const, priority: 3 as const, cell: (r: PerfRow) => <span className="tabular font-medium">{credit(r)}</span> }]
      : []),
    {
      id: 'promises',
      header: t('col.promises'),
      align: 'end',
      priority: 3,
      cell: (r) => ((r.promisesDue ?? 0) > 0 ? <span className="tabular">{t('keptOf', { kept: formatNumber(r.promisesKept ?? 0), due: formatNumber(r.promisesDue ?? 0) })}</span> : <span className="text-fg-tertiary">—</span>),
    },
    {
      id: 'attendance',
      header: monthly ? t('col.days') : t('col.late'),
      align: 'end',
      priority: 4,
      cell: (r) =>
        monthly ? (
          <span className="inline-flex flex-col items-end">
            <span className="tabular">{formatNumber(r.presentDays ?? 0)}</span>
            {(r.lateDays ?? 0) > 0 && <span className="text-xs text-warning">{t('lateDays', { n: formatNumber(r.lateDays ?? 0) })}</span>}
          </span>
        ) : (r.lateMin ?? 0) > 0 ? (
          <span className="tabular font-medium text-warning">{formatDuration(r.lateMin ?? 0)}</span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
    { id: 'field', header: t('col.field'), align: 'end', priority: 4, cell: (r) => ((r.fieldMin ?? 0) > 0 ? <span className="tabular">{formatDuration(r.fieldMin ?? 0)}</span> : <span className="text-fg-tertiary">—</span>) },
  ];

  const kpis = [
    { icon: Wallet, label: t('kpi.collected'), value: formatMoney(sum.collectedPoisha), sub: sum.targetToDatePoisha ? t('ofTarget', { pct: formatPercent(sum.collectedPoisha / sum.targetToDatePoisha) }) : undefined },
    {
      icon: MapPinCheck,
      label: t('kpi.visits'),
      value: formatNumber(sum.visits),
      sub: sum.visitTargetToDate ? t('kpiVisitTarget', { credit: num(sum.visitCredit), target: num(sum.visitTargetToDate) }) : t('kpi.collections', { n: formatNumber(sum.collections) }),
    },
    { icon: Handshake, label: t('kpi.promises'), value: sum.promisesDue ? formatPercent(sum.promisesKept / sum.promisesDue) : '—', sub: sum.promisesDue ? t('keptOf', { kept: formatNumber(sum.promisesKept), due: formatNumber(sum.promisesDue) }) : undefined },
    { icon: UsersRound, label: t('kpi.staff'), value: formatNumber(rows.length), sub: periodLabel },
  ];
  const methods = open ? byMethod(open) : [];
  const held = open ? (areas.data ?? []).filter((a) => a.assignees?.includes(open.userId ?? '')) : [];

  return (
    <>
      <PageHeader title={t('title')} actions={<PrintButton name={`${t('title')} - ${periodLabel}`} />}>
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Segmented label={t('period.label')} value={period} onChange={(v) => url.set({ period: v === 'daily' ? null : v })} options={PERIODS.map((p) => ({ value: p, label: t(`period.${p}`) }))} />
          <PrintOnly className="print:inline">({periodLabel})</PrintOnly>
        </div>
        <Select aria-label={t('sort.label')} value={sort} onChange={(e) => url.set({ sort: e.target.value === 'collected' ? null : e.target.value })} className="h-9 sm:w-60">
          {SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
        </Select>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line shadow-e1 lg:grid-cols-4 print:grid-cols-4 [&>*]:bg-surface">
        {kpis.map((k) => (
          <div key={k.label} className="px-4 py-3.5">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-tertiary">
              <k.icon className="size-3.5" aria-hidden />
              {k.label}
            </dt>
            <dd className="mt-1">
              <span className="tabular block text-xl font-semibold text-fg">{q.isLoading ? <Skeleton className="h-7 w-24" /> : k.value}</span>
              {k.sub && !q.isLoading && <span className="mt-0.5 block text-xs text-fg-tertiary">{k.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <DataTable
        tableId="staff"
        caption={t('title')}
        columns={columns}
        rows={q.isLoading ? undefined : rows}
        rowKey={(r) => r.userId ?? ''}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        empty={<EmptyState icon={UsersRound} title={t('empty')} />}
      />

      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && url.set({ drawer: null })}
        title={open ? <span lang={locale}>{open.name}</span> : ''}
        subtitle={periodLabel}
        headerExtra={open && targetRatio(open) != null && targetRatio(open)! >= 1 ? <Badge tone="success">{t('targetMet')}</Badge> : undefined}
      >
        {open && (
          <div className="space-y-5">
            <div className="rounded-md border border-line px-4 py-3.5">
              <p className="text-xs font-medium text-fg-tertiary">{t('col.collected')}</p>
              <MoneyText poisha={collected(open)} className="text-xl font-semibold" />
              {targetRatio(open) != null && (
                <>
                  <div className="mt-3"><Progress ratio={targetRatio(open)!} label={t('ofTarget', { pct: formatPercent(targetRatio(open)!) })} /></div>
                  <p className="mt-1.5 text-sm text-fg-secondary">{t('targetLine', { pct: formatPercent(targetRatio(open)!), target: formatMoney(targetToDate(open)) })}</p>
                  {monthly && (open.targetPoisha ?? 0) > targetToDate(open) && (
                    <p className="text-xs text-fg-tertiary">{t('targetPeriod', { target: formatMoney(open.targetPoisha ?? 0), days: formatNumber(open.targetDays ?? 0) })}</p>
                  )}
                </>
              )}
              {visitRatio(open) != null && (
                <div className="mt-3 border-t border-line pt-3">
                  <Progress ratio={visitRatio(open)!} label={t('visitOfTarget', { pct: formatPercent(visitRatio(open)!) })} />
                  <p className="mt-1.5 text-sm text-fg-secondary">{t('visitLine', { credit: credit(open), target: num(open.visitTargetToDate ?? open.visitTarget ?? 0), pct: formatPercent(visitRatio(open)!) })}</p>
                </div>
              )}
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{t('byMethod')}</h3>
              {methods.length ? (
                <ul className="space-y-2">
                  {methods.map((m) => (
                    <li key={m.method} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-fg-secondary">{tc(`method.${m.method}`, { defaultValue: m.method })}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular text-xs text-fg-tertiary">{formatPercent(m.poisha / (collected(open) || 1))}</span>
                        <MoneyText poisha={m.poisha} className="font-medium" />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-tertiary">{t('noCollections')}</p>
              )}
            </section>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line [&>*]:bg-surface">
              <Stat label={t('col.visits')} value={formatNumber(coworkOn ? visitsTakenPart(open) : (open.visits ?? 0))} sub={t('unique', { n: formatNumber(open.uniqueCustomers ?? 0) })} />
              <Stat label={t('col.count')} value={formatNumber(open.collectionsCount ?? 0)} />
              <Stat label={t('col.promises')} value={(open.promisesDue ?? 0) > 0 ? t('keptOf', { kept: formatNumber(open.promisesKept ?? 0), due: formatNumber(open.promisesDue ?? 0) }) : '—'} sub={open.promiseFulfilmentRate != null && (open.promisesDue ?? 0) > 0 ? formatPercent(open.promiseFulfilmentRate) : undefined} />
              <Stat label={t('col.field')} value={(open.fieldMin ?? 0) > 0 ? formatDuration(open.fieldMin ?? 0) : '—'} sub={(open.distanceKm ?? 0) > 0 ? t('km', { n: formatNumber(open.distanceKm ?? 0, { decimals: 1 }) }) : undefined} />
              <Stat label={monthly ? t('col.days') : t('col.late')} value={monthly ? formatNumber(open.presentDays ?? 0) : (open.lateMin ?? 0) > 0 ? formatDuration(open.lateMin ?? 0) : '—'} sub={monthly && (open.lateDays ?? 0) > 0 ? t('lateDays', { n: formatNumber(open.lateDays ?? 0) }) : undefined} warn={monthly ? (open.lateDays ?? 0) > 0 : (open.lateMin ?? 0) > 0} />
              <Stat label={t('break')} value={(open.breakMin ?? 0) > 0 ? formatDuration(open.breakMin ?? 0) : '—'} />
            </dl>

            {coworkOn && (
              <section aria-labelledby="staff-cowork">
                <h3 id="staff-cowork" className="mb-2 text-sm font-semibold text-fg-secondary">{t('cowork.title')}</h3>
                <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line [&>*]:bg-surface">
                  <Stat label={t('cowork.single')} value={formatNumber(open.soloVisits ?? 0)} />
                  <Stat label={t('cowork.joint')} value={formatNumber(open.coWorkVisits ?? 0)} />
                  <Stat label={t('col.credit')} value={credit(open)} sub={jointWeight(open) != null ? t('cowork.weight', { pct: formatPercent(jointWeight(open)!) }) : undefined} />
                </dl>
                <p className="mt-2 flex items-start gap-2 text-sm text-fg-secondary">
                  <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                  {t('cowork.note')}
                </p>
              </section>
            )}

            {canAreas && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{t('areas')}</h3>
                {areas.isLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : held.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {held.map((a) => (
                      <li key={a.id}><Badge tone="neutral" icon={false}><span lang={locale}>{pickText(a.name, locale)}</span> · {formatNumber(a.customerCount ?? 0)}</Badge></li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-fg-tertiary">{t('noAreas')}</p>
                )}
              </section>
            )}

            <nav aria-label={t('jump')} className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {links.collections && <Jump href={`/collections/?collectorId=${open.userId}${monthly ? '&from=' + today.slice(0, 8) + '01&to=' + today : ''}`} icon={Wallet} label={t('link.collections')} />}
              {links.visits && <Jump href={`/visits/?userId=${open.userId}${monthly ? '&range=30d' : ''}`} icon={Footprints} label={t('link.visits')} />}
              {links.visits && coworkOn && (open.coWorkVisits ?? 0) > 0 && <Jump href={`/visits/?userId=${open.userId}&kind=joint${monthly ? '&range=30d' : ''}`} icon={Users} label={t('link.jointVisits')} />}
              {links.sessions && <Jump href={`/cowork/?userId=${open.userId}${monthly ? '&range=30d' : '&range=today'}`} icon={UsersRound} label={t('link.sessions')} />}
              {links.attendance && <Jump href={`/attendance/?view=month`} icon={CalendarCheck} label={t('link.attendance')} />}
              {links.targets && <Jump href={`/targets/?drawer=${open.userId}`} icon={Target} label={t('link.targets')} />}
              {links.leaderboard && <Jump href={`/leaderboard/${monthly ? '' : '?period=day'}`} icon={Trophy} label={t('link.leaderboard')} />}
            </nav>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: string; warn?: boolean }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs font-medium text-fg-tertiary">{label}</dt>
      <dd>
        <span className={cn('tabular block text-md font-semibold', warn ? 'text-warning' : 'text-fg')}>{value}</span>
        {sub && <span className="block text-xs text-fg-tertiary">{sub}</span>}
      </dd>
    </div>
  );
}

function Jump({ href, icon: Icon, label }: { href: string; icon: typeof Wallet; label: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface-hover">
      <Icon className="size-4 text-fg-tertiary" aria-hidden />
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-4 text-fg-tertiary rtl:rotate-180" aria-hidden />
    </Link>
  );
}
