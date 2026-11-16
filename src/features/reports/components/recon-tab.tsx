'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, CircleCheck, Scale, TriangleAlert } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useGate } from '@/shared/feature/useGate';
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format';
import { addDays, todayDhaka } from '@/shared/lib/time';
import { useUrlState } from '@/shared/lib/url-state';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { EmptyState, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Field, Input } from '@/shared/ui/form';
import { MoneyText } from '@/shared/ui/money';
import { useReconciliation, type Mismatch } from '../api/reports';
import { difference, kindCounts, reconGap } from '../model/reports';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KIND_TONE: Record<string, 'warning' | 'danger' | 'neutral'> = { not_posted: 'warning', missing_in_erp: 'danger', missing_in_fos: 'danger', amount_differs: 'danger', reversed_in_erp: 'warning', voided_in_fos: 'neutral' };

export function ReconTab() {
  const { t } = useTranslation('reports');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const gate = useGate();
  const canCollections = gate.can('collection.view') && gate.flag('module.collections');
  const url = useUrlState();
  const today = todayDhaka();
  const raw = url.get('date');
  const date = DATE_RE.test(raw) && raw <= today ? raw : today;
  const q = useReconciliation(date, true);
  const r = q.data;
  const tot = r?.totals;
  const rows = useMemo(() => r?.mismatches ?? [], [r?.mismatches]);
  const kinds = useMemo(() => kindCounts(rows), [rows]);
  const gap = reconGap(r);

  const columns: Column<Mismatch>[] = [
    { id: 'kind', header: t('recon.col.kind'), priority: 1, mobile: 'badges', cell: (m) => <Badge tone={KIND_TONE[m.kind ?? ''] ?? 'neutral'}>{t(`recon.kind.${m.kind}`)}</Badge> },
    {
      id: 'receipt', header: t('recon.col.receipt'), priority: 2, mobile: 'meta',
      cell: (m) =>
        m.collectionId && canCollections ? (
          <Link href={`/collections/?drawer=collection:${m.collectionId}`} className="font-mono text-sm text-primary hover:underline">{m.receiptNo ?? m.collectionId}</Link>
        ) : (
          <span className="font-mono text-sm text-fg-secondary">{m.receiptNo ?? m.erpPaymentId ?? '—'}</span>
        ),
    },
    { id: 'customer', header: t('recon.col.customer'), priority: 1, mobile: 'title', cell: (m) => (m.customer ? <span className="block"><span className="block font-medium text-fg" lang={locale}>{m.customer.name}</span><span className="block font-mono text-xs text-fg-tertiary">{m.customer.code}</span></span> : <span className="text-fg-tertiary">—</span>) },
    { id: 'collector', header: t('recon.col.collector'), priority: 3, mobile: 'subtitle', cell: (m) => <span className="text-fg-secondary" lang={locale}>{m.collector?.name ?? '—'}</span> },
    { id: 'fos', header: t('recon.col.fos'), priority: 2, align: 'end', cell: (m) => (typeof m.fosAmountPoisha === 'number' ? <MoneyText poisha={m.fosAmountPoisha} /> : <span className="text-fg-tertiary">—</span>) },
    { id: 'erp', header: t('recon.col.erp'), priority: 2, align: 'end', cell: (m) => (typeof m.erpAmountPoisha === 'number' ? <MoneyText poisha={m.erpAmountPoisha} /> : <span className="text-fg-tertiary">—</span>) },
    {
      id: 'diff', header: t('recon.col.diff'), priority: 1, align: 'end', mobile: 'amount',
      cell: (m) => {
        const d = difference(m);
        return d === null || d === 0 ? <span className="text-fg-tertiary">—</span> : <span className="tabular font-medium text-danger">{formatMoney(d, { sign: true })}</span>;
      },
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Button size="icon" aria-label={t('recon.prevDay')} onClick={() => url.set({ date: addDays(date, -1) })}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Field label={t('recon.date')}>
          {(id) => <Input id={id} type="date" max={today} value={date} onChange={(e) => e.target.value && url.set({ date: e.target.value })} className="w-44" />}
        </Field>
        <Button size="icon" aria-label={t('recon.nextDay')} disabled={date >= today} onClick={() => url.set({ date: addDays(date, 1) })}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        {r && !q.isLoading ? (
          <span className="mb-1.5 ms-2">{r.balanced ? <Badge tone="success" icon={CircleCheck}>{t('recon.balanced')}</Badge> : <Badge tone="danger" icon={TriangleAlert}>{t('recon.unbalanced')}</Badge>}</span>
        ) : null}
      </div>

      <dl className="mb-2 grid gap-px overflow-hidden rounded-md border border-line bg-line shadow-e1 sm:grid-cols-2 lg:grid-cols-4 [&>*]:bg-surface">
        {([
          ['fosPosted', tot?.fosPostedPoisha, tot?.fosPostedCount, false],
          ['fosWaiting', tot?.fosWaitingPoisha, tot?.fosWaitingCount, (tot?.fosWaitingCount ?? 0) > 0],
          ['erp', tot?.erpPoisha, tot?.erpCount, false],
        ] as const).map(([key, poisha, count, warn]) => (
          <div key={key} className="px-4 py-3">
            <dt className="text-xs text-fg-tertiary">{t(`recon.${key}`)}</dt>
            <dd className={cn('mt-0.5 text-md font-semibold', warn ? 'text-warning' : 'text-fg')}>
              {q.isLoading ? <Skeleton className="h-6 w-24" /> : <MoneyText poisha={poisha ?? 0} />}
              <span className="block text-xs font-normal text-fg-secondary">{q.isLoading ? '' : t('recon.nReceipts', { n: formatNumber(count ?? 0) })}</span>
              {key === 'erp' && r && !q.isLoading ? <span className="block text-xs font-normal text-fg-tertiary">{r.erpFetchedAt ? t('recon.erpAsOf', { time: formatDateTime(r.erpFetchedAt) }) : t('recon.erpNone')}</span> : null}
            </dd>
          </div>
        ))}
        <div className="px-4 py-3">
          <dt className="text-xs text-fg-tertiary">{t('recon.matched')}</dt>
          <dd className="tabular mt-0.5 text-md font-semibold text-fg">{q.isLoading ? <Skeleton className="h-6 w-16" /> : t('recon.nReceipts', { n: formatNumber(tot?.matchedCount ?? 0) })}</dd>
        </div>
      </dl>
      <p className="mb-5 text-sm text-fg-secondary">
        {r && !q.isLoading ? (
          <>
            {t('recon.gap')}:{' '}
            <span className={cn('tabular font-medium', gap === 0 ? 'text-success' : 'text-danger')}>{gap === 0 ? t('recon.gapNone') : formatMoney(gap, { sign: true })}</span>
          </>
        ) : null}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="me-2 text-md font-semibold text-fg">{t('recon.mismatches')}</h2>
        {kinds.map((k) => <Badge key={k.kind} tone={KIND_TONE[k.kind] ?? 'neutral'} icon={false}>{t(`recon.kind.${k.kind}`)}: {formatNumber(k.count)}</Badge>)}
      </div>
      <DataTable
        tableId="reconciliation"
        caption={t('recon.mismatches')}
        columns={columns}
        rows={q.isLoading ? undefined : rows}
        rowKey={(m) => `${m.kind}:${m.collectionId ?? ''}:${m.erpPaymentId ?? ''}`}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        empty={<EmptyState icon={Scale} title={t('recon.none')} />}
      />
    </>
  );
}
