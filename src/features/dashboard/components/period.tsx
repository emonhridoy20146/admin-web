'use client';
/**
 * FR-W-064 on contract 1.45.0 (FR-DSH-002): the dashboard sections that follow the chosen period. Every number comes
 * with the server's list link (`DashboardLink`), opened in the matching admin page through `pageHref`.
 */
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CircleCheck, Footprints, Handshake, ShieldCheck, Siren, Trophy, UserRoundCheck, UserRoundSearch, Users, Wallet } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatMoneyCompact, formatNumber, formatPercent } from '@/shared/lib/format';
import type { components } from '@/shared/api/schema';
import { Card, CardHeader } from '@/shared/ui/card';
import { EmptyState, Skeleton } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import { Avatar, Segmented } from '@/shared/ui/primitives';
import { pageHref } from '../model/overview';

type Overview = components['schemas']['DashboardOverview'];

const METHOD_TOKEN: Record<string, string> = { cash: '--pay-cash', bkash: '--pay-bkash', nagad: '--pay-nagad', rocket: '--pay-rocket', bank_transfer: '--pay-bank', other_mobile: '--pay-other' };
// fixed order (identity by method, never by rank), the categorical palette of 03 §2.4
const OUTCOME_TOKEN: Record<string, string> = {
  paid: '--chart-6',
  partial_paid: '--chart-2',
  promised: '--chart-5',
  not_home: '--chart-3',
  refused: '--chart-8',
  shifted_address: '--chart-7',
  customer_dead: '--fg-tertiary',
  product_returned_request: '--chart-4',
  runaway: '--danger-fg',
  other: '--fg-disabled',
};

function Bars({ rows, loading, empty }: { rows: { key: string; label: string; value: number; text: string; token: string; href: string }[]; loading: boolean; empty: React.ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (loading) return <div className="space-y-2.5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7" />)}</div>;
  if (!rows.length) return <>{empty}</>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key}>
          <Link href={r.href} className="grid min-h-9 grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-1 text-sm hover:bg-surface-hover">
            <span className="inline-flex items-center gap-2 truncate text-fg">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(${r.token})` }} aria-hidden />
              {r.label}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: `var(${r.token})` }} />
            </span>
            <span className="tabular min-w-16 text-end font-medium text-fg">{r.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Money collected in the period, by method, with what the ERP has and what still waits. */
export function PeriodCollectionsCard({ d, loading, className }: { d?: Overview; loading: boolean; className?: string }) {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  const c = d?.collections;
  const rows = (c?.byMethod ?? []).map((m) => ({ key: m.method, label: tc(`method.${m.method}`), value: m.amountPoisha, text: formatMoneyCompact(m.amountPoisha), token: METHOD_TOKEN[m.method] ?? '--chart-1', href: pageHref(m.link, '/collections/') }));
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={t('period.collections')} subtitle={t('period.collectionsSub')} />
      <div className="flex-1 space-y-4 p-4">
        {loading ? (
          <Skeleton className="h-10 w-40" />
        ) : (
          <Link href={pageHref(c?.inRange?.link, '/collections/')} className="block rounded-md hover:text-primary">
            <MoneyText poisha={c?.inRange?.amountPoisha ?? 0} className="text-3xl font-semibold tracking-tight" />
            <span className="mt-0.5 block text-sm text-fg-tertiary">{t('receipts', { n: formatNumber(c?.inRange?.count ?? 0) })}</span>
          </Link>
        )}
        <Bars rows={rows} loading={loading} empty={<EmptyState icon={Wallet} title={t('period.noCollections')} className="py-4" />} />
        {!loading && c && (
          <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
            <Link href={pageHref(c.erpPosted?.link, '/collections/')} className="rounded-md border border-line px-2.5 py-2 hover:bg-surface-hover">
              <span className="block text-xs text-fg-secondary">{t('period.inErp')}</span>
              <MoneyText poisha={c.erpPosted?.amountPoisha ?? 0} className="text-base font-semibold" />
            </Link>
            <Link href={pageHref(c.pendingInField?.link, '/collections/')} className="rounded-md border border-line px-2.5 py-2 hover:bg-surface-hover">
              <span className="block text-xs text-fg-secondary">{t('period.notInErp')}</span>
              <MoneyText poisha={c.pendingInField?.amountPoisha ?? 0} pending className="text-base font-semibold" />
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Visits in the period by what happened. */
export function OutcomeCard({ d, loading, className }: { d?: Overview; loading: boolean; className?: string }) {
  const { t } = useTranslation('dashboard');
  const v = d?.visitStats;
  const rows = (v?.byOutcome ?? []).map((o) => ({
    key: o.outcome,
    label: t(`outcome.${o.outcome}`, { defaultValue: o.outcome }),
    value: o.count,
    text: formatNumber(o.count),
    token: OUTCOME_TOKEN[o.outcome] ?? '--fg-disabled',
    href: pageHref(o.link, '/visits/'),
  }));
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title={t('period.visits')}
        subtitle={v ? t('period.visitsSub', { n: formatNumber(v.total?.count ?? 0), c: formatNumber(v.uniqueCustomers ?? 0) }) : undefined}
        actions={v?.total ? <Link href={pageHref(v.total.link, '/visits/')} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:bg-surface-hover">{t('open')}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link> : undefined}
      />
      <div className="flex-1 p-4">
        <Bars rows={rows} loading={loading} empty={<EmptyState icon={Footprints} title={t('period.noVisits')} className="py-6" />} />
      </div>
    </Card>
  );
}

/** How promises due in the period ended, what is coming, and broken ones nobody followed up. */
export function PromiseOutcomeCard({ d, loading, className }: { d?: Overview; loading: boolean; className?: string }) {
  const { t } = useTranslation('dashboard');
  const p = d?.promiseStats;
  const kept = p?.kept?.count ?? 0;
  const part = p?.partiallyKept?.count ?? 0;
  const broken = p?.broken?.count ?? 0;
  const all = kept + part + broken;
  const parts = [
    { key: 'kept', n: kept, cls: 'bg-success', link: p?.kept?.link },
    { key: 'partial', n: part, cls: 'bg-warning', link: p?.partiallyKept?.link },
    { key: 'broken', n: broken, cls: 'bg-danger', link: p?.broken?.link },
  ];
  const ahead = [
    { key: 'dueToday', v: p?.dueToday },
    { key: 'next7', v: p?.next7Days },
    { key: 'next15', v: p?.next15Days },
  ];
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={t('prom.title')} subtitle={t('period.promSub')} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {loading ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="tabular text-3xl font-semibold tracking-tight text-fg">{p?.keptRate == null ? '—' : formatPercent(p.keptRate)}</span>
              <span className="text-sm text-fg-secondary">{p?.keptRate == null ? t('period.noneDecided') : t('period.keptOf', { n: formatNumber(all) })}</span>
            </div>
            {all > 0 && (
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((x) => `${t(`period.${x.key}`)} ${formatNumber(x.n)}`).join(', ')}>
                {parts.filter((x) => x.n > 0).map((x) => <span key={x.key} className={x.cls} style={{ width: `${(x.n / all) * 100}%` }} />)}
              </div>
            )}
            <ul className="grid grid-cols-3 gap-2">
              {parts.map((x) => (
                <li key={x.key}>
                  <Link href={pageHref(x.link, '/promises/')} className="block rounded-md border border-line px-2.5 py-2 hover:bg-surface-hover">
                    <span className="flex items-center gap-1.5 truncate text-xs text-fg-secondary"><span className={cn('size-2 shrink-0 rounded-full', x.cls)} aria-hidden />{t(`period.${x.key}`)}</span>
                    <span className="tabular mt-0.5 block text-lg font-semibold text-fg">{formatNumber(x.n)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {(p?.brokenWithoutFollowUp?.count ?? 0) > 0 && (
              <Link href={pageHref(p!.brokenWithoutFollowUp!.link, '/promises/?nofollow=1')} className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-sm font-medium text-danger hover:opacity-90">
                <Handshake className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{t('period.noFollowUp', { n: formatNumber(p!.brokenWithoutFollowUp!.count) })}</span>
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            )}
            <div className="mt-auto border-t border-line pt-3">
              <div className="mb-1.5 text-xs font-medium text-fg-tertiary">{t('period.ahead')}</div>
              <ul className="space-y-1">
                {ahead.map((a) => (
                  <li key={a.key}>
                    <Link href={pageHref(a.v?.link, '/promises/')} className="flex min-h-8 items-center justify-between gap-2 rounded-sm px-1 text-sm hover:bg-surface-hover">
                      <span className="text-fg-secondary">{t(`period.${a.key}`)}</span>
                      <span className="tabular text-fg">
                        <span className="font-semibold">{formatNumber(a.v?.count ?? 0)}</span> · {formatMoneyCompact(a.v?.amountPoisha ?? 0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/** Top five people in the period, by money collected or by visits. */
export function TopStaffCard({ d, loading, className }: { d?: Overview; loading: boolean; className?: string }) {
  const { t } = useTranslation('dashboard');
  const [by, setBy] = useState<'money' | 'visits'>('money');
  const money = d?.topStaff?.byCollection ?? [];
  const visits = d?.topStaff?.byVisits ?? [];
  const rows = by === 'money'
    ? money.map((r) => ({ id: r.userId, name: r.name, value: r.amountPoisha, text: <MoneyText poisha={r.amountPoisha} className="text-sm font-semibold" />, sub: t('receipts', { n: formatNumber(r.count) }), href: pageHref(r.link, '/collections/') }))
    : visits.map((r) => ({ id: r.userId, name: r.name, value: r.count, text: <span className="tabular text-sm font-semibold">{formatNumber(r.count)}</span>, sub: '', href: pageHref(r.link, '/visits/') }));
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title={t('top.title')}
        subtitle={t('top.sub')}
        actions={<Segmented label={t('top.by')} value={by} onChange={setBy} options={[{ value: 'money', label: t('top.money') }, { value: 'visits', label: t('top.visits') }]} />}
      />
      <div className="flex-1 p-2">
        {loading ? (
          <div className="space-y-2 p-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Trophy} title={t('top.none')} className="py-8" />
        ) : (
          <ol className="space-y-1">
            {rows.map((r, i) => (
              <li key={r.id}>
                <Link href={r.href} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-hover">
                  <span className={cn('tabular grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', i === 0 ? 'bg-warning-bg text-warning' : 'bg-surface-hover text-fg-secondary')}>{formatNumber(i + 1)}</span>
                  <Avatar name={r.name} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
                    </span>
                  </span>
                  <span className="text-end">
                    {r.text}
                    {r.sub && <span className="block text-xs text-fg-tertiary">{r.sub}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

/** Possible customers: recorded in the period, converted in the period, still open now; plus co-work sessions. */
export function ProspectsCard({ d, loading, showProspects, showCowork, className }: { d?: Overview; loading: boolean; showProspects: boolean; showCowork: boolean; className?: string }) {
  const { t } = useTranslation('dashboard');
  const p = d?.prospectStats;
  const created = p?.created?.count ?? 0;
  const converted = p?.converted?.count ?? 0;
  const steps = [
    { key: 'created', n: created, link: p?.created?.link, icon: UserRoundSearch },
    { key: 'converted', n: converted, link: p?.converted?.link, icon: CircleCheck },
    { key: 'openNow', n: p?.openNow?.count ?? 0, link: p?.openNow?.link, icon: Users },
  ];
  if (!showProspects && !showCowork) return null;
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={showProspects ? t('pros.title') : t('pros.cowork')} subtitle={showProspects ? t('pros.sub') : undefined} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        {loading ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            {showProspects && (
              <>
                <ul className="space-y-2">
                  {steps.map((s, i) => (
                    <li key={s.key}>
                      <Link href={pageHref(s.link, '/prospects/')} className="flex items-center gap-3 rounded-md border border-line px-3 py-2 hover:bg-surface-hover" style={{ marginInlineStart: i === 1 ? 12 : 0 }}>
                        <s.icon className={cn('size-4 shrink-0', s.key === 'converted' ? 'text-success' : 'text-primary')} aria-hidden />
                        <span className="flex-1 text-sm text-fg-secondary">{t(`pros.${s.key}`)}</span>
                        <span className="tabular text-lg font-semibold text-fg">{formatNumber(s.n)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-fg-tertiary">{created > 0 ? t('pros.rate', { pct: formatPercent(converted / created) }) : t('pros.noneYet')}</p>
              </>
            )}
            {showCowork && (
              <Link href={pageHref(d?.coworkStats?.sessions?.link, '/cowork/')} className="mt-auto flex items-center gap-3 rounded-md bg-surface-subtle px-3 py-2.5 hover:bg-surface-hover">
                <Users className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="flex-1 text-sm text-fg-secondary">{t('pros.coworkSessions')}</span>
                <span className="tabular text-lg font-semibold text-fg">{formatNumber(d?.coworkStats?.sessions?.count ?? 0)}</span>
              </Link>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/** 1.48.0 (FR-W-070): requests not finished, by where they wait now; each number opens that view of the requests inbox. */
export function RequestsCard({ d, loading, className }: { d?: Overview; loading: boolean; className?: string }) {
  const { t } = useTranslation('dashboard');
  const r = d?.requestStats;
  if (!loading && !r) return null;
  const rows = [
    { key: 'areaManagerQueue', icon: Users, c: r?.areaManagerQueue, tone: 'text-primary' },
    { key: 'superAdminQueue', icon: ShieldCheck, c: r?.superAdminQueue, tone: 'text-primary' },
    { key: 'assigned', icon: UserRoundCheck, c: r?.assigned, tone: 'text-primary' },
    { key: 'importantOpen', icon: Siren, c: r?.importantOpen, tone: 'text-danger' },
  ] as const;
  return (
    <Card className={cn('flex flex-col', className)} data-testid="requests-card">
      <CardHeader title={t('req.title')} subtitle={t('req.sub')} />
      <div className="flex-1 p-4">
        {loading ? (
          <Skeleton className="h-32" />
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {rows.map((x) => (
              <li key={x.key}>
                <Link href={pageHref(x.c?.link, '/requests/')} className="flex h-full min-h-11 flex-col gap-1 rounded-md border border-line px-3 py-2.5 hover:bg-surface-hover">
                  <span className="flex items-center gap-1.5 text-xs text-fg-secondary">
                    <x.icon className={cn('size-3.5 shrink-0', x.tone)} aria-hidden />
                    {t(`req.${x.key}`)}
                  </span>
                  <span className={cn('tabular text-xl font-semibold', x.key === 'importantOpen' && (x.c?.count ?? 0) > 0 ? 'text-danger' : 'text-fg')}>{formatNumber(x.c?.count ?? 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
