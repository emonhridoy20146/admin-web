'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Download, MapPinOff, Phone, ScrollText, ShieldCheck, UserX, type LucideIcon } from 'lucide-react';
import { useCan } from '@/shared/auth/session';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatNumber, formatPercent, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Card, CardHeader } from '@/shared/ui/card';
import { PrintButton, PrintOnly } from '@/shared/ui/print';
import { useDataQuality, useDataQualityItems, type DataQualityItem } from '../api/reports';
import { ISSUES, ISSUE_GROUP, issueTotals, worstIssue, type IssueGroup } from '../model/data-quality';

const GROUP_ICON: Record<IssueGroup, LucideIcon> = { location: MapPinOff, phone: Phone, plan: ScrollText, assignment: UserX };

/** FR-CUS-009: what is missing or wrong in customer data, per branch, and the customers behind each issue. */
export function DataQualityPage() {
  const { t } = useTranslation('reports');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const q = useDataQuality();
  const totals = useMemo(() => issueTotals(q.data), [q.data]);
  const issue = oneOf(url.get('issue'), ISSUES, worstIssue(totals));
  const cursor = url.get('cursor');
  const [limit, setLimit] = useState(25);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const items = useDataQualityItems(totals.byIssue[issue] ? issue : undefined, cursor || undefined, limit);
  const branches = q.data?.branches ?? [];
  // a branch may override the distance (1.10.0); one branch shows its own, several show the system default
  const km = (branches.length === 1 ? branches[0]?.maxBranchKm : undefined) ?? q.data?.maxBranchKm ?? 0;
  const canExport = useCan('report.export');

  const columns: Column<DataQualityItem>[] = [
    {
      id: 'customer',
      header: t('dq.col.customer'),
      priority: 1,
      mobile: 'title',
      cell: (r) => (
        <Link href={`/customers/${r.customerId}/`} className="block min-w-0">
          <span className="block max-w-[240px] truncate font-medium text-fg hover:text-primary" lang={locale}>{pickText(r.name, locale)}</span>
          <span className="block font-mono text-xs text-fg-tertiary">{r.code}</span>
        </Link>
      ),
    },
    {
      id: 'detail',
      header: t('dq.col.detail'),
      priority: 1,
      mobile: 'subtitle',
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block text-fg">{t(`dq.issue.${r.issue}.label`, { defaultValue: r.issue })}</span>
          {hasData(r.detail) ? <span className="block max-w-[360px] truncate text-xs text-fg-tertiary" lang="en" title={r.detail}>{r.detail}</span> : null}
        </span>
      ),
    },
    { id: 'area', header: t('dq.col.area'), priority: 3, mobile: 'meta', cell: (r) => (r.areaCode ? <span className="font-mono text-xs">{r.areaCode}</span> : <span className="text-fg-tertiary">—</span>) },
    { id: 'assignee', header: t('dq.col.assignee'), priority: 2, mobile: 'meta', cell: (r) => (r.assignee?.name ? <span lang={locale}>{r.assignee.name}</span> : <span className="text-fg-tertiary">{t('dq.nobody')}</span>) },
    {
      id: 'others',
      header: t('dq.col.others'),
      priority: 3,
      mobile: 'badges',
      cell: (r) => {
        const others = (r.issues ?? []).filter((x) => x !== r.issue);
        return others.length ? (
          <span className="flex flex-wrap gap-1">{others.map((x) => <Badge key={x} tone="neutral" icon={false}>{t(`dq.issue.${x}.label`, { defaultValue: x })}</Badge>)}</span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title={t('dq.title')} asOf={q.data?.generatedAt} actions={<PrintButton name={`${t('dq.title')} - ${todayDhaka()}`} />}>
        <span>{t('dq.subtitle')}</span>
      </PageHeader>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="mb-4" /> : null}

      <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line shadow-e1 lg:grid-cols-3 print:grid-cols-3 [&>*]:bg-surface">
        <div className="px-4 py-3">
          <dt className="text-xs text-fg-tertiary">{t('dq.customers')}</dt>
          <dd className="tabular mt-0.5 text-xl font-semibold text-fg">{q.isLoading ? <Skeleton className="h-7 w-20" /> : formatNumber(totals.customers)}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-fg-tertiary">{t('dq.withIssues')}</dt>
          <dd className="mt-0.5 text-xl font-semibold text-fg">
            {q.isLoading ? <Skeleton className="h-7 w-20" /> : <span className="tabular">{formatNumber(totals.withIssues)}</span>}
            {!q.isLoading && totals.customers > 0 ? <span className="tabular ms-2 text-sm font-normal text-fg-secondary">{formatPercent(totals.withIssues / totals.customers, { decimals: 1 })}</span> : null}
          </dd>
        </div>
        <div className="col-span-2 px-4 py-3 lg:col-span-1 print:col-span-1">
          <dt className="text-xs text-fg-tertiary">{t('dq.clean')}</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 text-xl font-semibold text-success">
            {q.isLoading ? <Skeleton className="h-7 w-20" /> : (
              <>
                <ShieldCheck className="size-5" aria-hidden />
                <span className="tabular">{totals.customers ? formatPercent((totals.customers - totals.withIssues) / totals.customers, { decimals: 1 }) : '—'}</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      <ul className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-3" aria-label={t('dq.issues')}>
        {ISSUES.map((k) => {
          const n = totals.byIssue[k] ?? 0;
          const Icon = GROUP_ICON[ISSUE_GROUP[k]];
          const active = k === issue;
          return (
            <li key={k}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => (pager.reset(), url.set({ issue: k, cursor: null }))}
                className={cn(
                  'flex h-full w-full items-start gap-3 rounded-md border bg-surface px-4 py-3 text-start shadow-e1 transition-colors hover:border-line-strong',
                  active ? 'border-primary ring-1 ring-primary' : 'border-line',
                )}
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-md', n ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success')} aria-hidden>
                  {n ? <Icon className="size-[18px]" /> : <CircleCheck className="size-[18px]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-fg">{t(`dq.issue.${k}.label`)}</span>
                    <span className={cn('tabular text-md font-semibold', n ? 'text-fg' : 'text-success')}>{q.isLoading ? '…' : formatNumber(n)}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-fg-secondary">{t(`dq.issue.${k}.help`, { km: formatNumber(km) })}</span>
                  <span className="mt-1 block text-xs text-fg-tertiary">{t(`dq.fix.${ISSUE_GROUP[k]}`)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {branches.length > 1 && (
        <Card className="mb-5 overflow-hidden">
          <CardHeader title={t('dq.byBranch')} />
          <div className="scrollbar-thin overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('dq.byBranch')}</caption>
              <thead>
                <tr className="border-b border-line bg-surface-subtle text-xs text-fg-secondary">
                  <th scope="col" className="px-4 py-2 text-start font-semibold">{t('dq.col.branch')}</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">{t('dq.customers')}</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">{t('dq.withIssues')}</th>
                  {ISSUES.map((k) => <th key={k} scope="col" className="px-3 py-2 text-end font-semibold whitespace-nowrap">{t(`dq.issue.${k}.short`)}</th>)}
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.branchId} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-2 text-start font-medium text-fg" lang={locale}>{pickText(b.branchName, locale)}</th>
                    <td className="tabular px-3 py-2 text-end">{formatNumber(b.customers ?? 0)}</td>
                    <td className="tabular px-3 py-2 text-end">{formatNumber(b.withIssues ?? 0)}</td>
                    {ISSUES.map((k) => {
                      const n = b.issues?.[k] ?? 0;
                      return <td key={k} className={cn('tabular px-3 py-2 text-end', n ? 'text-fg' : 'text-fg-tertiary')}>{formatNumber(n)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-md font-semibold text-fg">{t('dq.listTitle', { issue: t(`dq.issue.${issue}.label`) })}</h2>
        {canExport && (
          <Link href={`/reports/?tab=exports&type=data_quality&issue=${issue}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary hover:bg-surface-hover print:hidden">
            <Download className="size-4" aria-hidden />
            {t('dq.download')}
          </Link>
        )}
      </div>
      <PrintOnly className="mb-2">{t('dq.printNote')}</PrintOnly>
      <DataTable
        tableId="data-quality"
        caption={t('dq.listTitle', { issue: t(`dq.issue.${issue}.label`) })}
        columns={columns}
        rows={totals.byIssue[issue] ? items.data?.items : []}
        rowKey={(r) => `${r.customerId}:${r.issue}`}
        loading={q.isLoading || items.isLoading}
        error={items.error}
        onRetry={() => items.refetch()}
        empty={<EmptyState icon={CircleCheck} title={t('dq.none')} body={t('dq.noneBody')} />}
        pager={{ page: pager.page, hasPrev: pager.hasPrev, hasNext: !!items.data?.nextCursor, onPrev: pager.prev, onNext: () => pager.next(items.data?.nextCursor), pageSize: limit, onPageSize: (n) => (pager.reset(), setLimit(n)) }}
      />
    </>
  );
}

/**
 * The server's detail is English prose around data (a phone number, a distance, a plan id). The issue's own wording is
 * already shown translated, so the detail is shown only when it carries such data.
 */
function hasData(detail: string | undefined): detail is string {
  return !!detail && /\d/.test(detail);
}
