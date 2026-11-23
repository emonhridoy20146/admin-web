'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, MapPinned, MoveRight, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { formatNumber, formatRelative, pickText } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { boundsOf } from '@/shared/map/geo';
import { MapView, type MapMarker, type MapViewState } from '@/shared/map/map-view';
import { useMapLayers } from '@/shared/feature/map-layers';
import { PageHeader } from '@/shared/ui/page';
import { Card } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Segmented } from '@/shared/ui/primitives';
import { PagerBar } from '@/shared/ui/data-table';
import { pageCountOf, parsePage } from '@/shared/lib/pages';
import { Badge, StatusBadge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Dialog } from '@/shared/ui/overlay';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useDecideProposal, useProposals, type LocationProposal } from '../api/customers';
import { proposalVM } from '../model/map';

const TABS = ['pending', 'approved', 'rejected'] as const;
/** FR-W-062: cards per page on every tab (the server sends up to 200, newest first). */
export const PIN_PAGE = 20;

export function PinApprovalsPage() {
  const { t } = useTranslation('customers');
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const tab = oneOf(url.get('status'), TABS, 'pending');
  const q = useProposals(tab);
  const canDecide = useCan('customer.location.approve');
  const decide = useDecideProposal();
  const [approve, setApprove] = useState<LocationProposal | null>(null);
  const [reject, setReject] = useState<LocationProposal | null>(null);
  const locale = useUi((s) => s.locale);
  const all = q.data ?? [];
  const pages = pageCountOf(all.length, PIN_PAGE);
  const page = Math.min(parsePage(url.get('page')), pages);
  const shown = all.slice((page - 1) * PIN_PAGE, page * PIN_PAGE);
  const goPage = (n: number) => {
    url.set({ page: n > 1 ? String(n) : null }, { push: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHeader title={t('pins.title')} print>
        <span>{t('pins.subtitle')}</span>
      </PageHeader>
      <div className="mb-4">
        <Segmented
          label={t('pins.status')}
          value={tab}
          onChange={(v) => url.set({ status: v === 'pending' ? null : v, page: null })}
          options={TABS.map((s) => ({ value: s, label: t(`pins.tab.${s}`), count: s === 'pending' && tab === 'pending' ? q.data?.length : undefined }))}
        />
      </div>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-72 rounded-md" />)}</div>
      ) : !q.data?.length ? (
        <Card><EmptyState icon={MapPinned} title={t(`pins.empty.${tab}`)} body={tab === 'pending' ? t('pins.emptyBody') : undefined} /></Card>
      ) : (
        <>
          <ul className="grid gap-4 xl:grid-cols-2">
            {shown.map((p) => (
              <ProposalCard key={p.id} p={p} canDecide={canDecide && tab === 'pending'} onApprove={() => setApprove(p)} onReject={() => setReject(p)} />
            ))}
          </ul>
          {all.length > PIN_PAGE && (
            <div className="mt-4 overflow-hidden rounded-md border border-line bg-surface shadow-e1 [&>nav]:border-t-0">
              <PagerBar
                pager={{
                  page,
                  hasPrev: page > 1,
                  hasNext: page < pages,
                  onPrev: () => goPage(page - 1),
                  onNext: () => goPage(page + 1),
                  onPage: goPage,
                  pageCount: pages,
                  pageSize: PIN_PAGE,
                  pageSizes: [PIN_PAGE],
                  onPageSize: () => undefined,
                  total: all.length,
                  rowsOnPage: shown.length,
                }}
              />
            </div>
          )}
        </>
      )}

      <Dialog
        open={!!approve}
        onOpenChange={(o) => !o && !decide.isPending && setApprove(null)}
        title={t('pins.approveTitle')}
        description={approve ? t('pins.approveDesc', { name: pickText(approve.customer?.name, locale) }) : undefined}
        footer={
          <>
            <Button onClick={() => setApprove(null)} disabled={decide.isPending}>{t('pins.back')}</Button>
            <Button
              variant="primary"
              loading={decide.isPending}
              onClick={() => decide.mutate({ id: approve!.id!, decision: 'approve' }, { onSuccess: () => (toast.success(t('pins.approved')), setApprove(null)) })}
            >
              {t('pins.approve')}
            </Button>
          </>
        }
      >
        {decide.error ? <ErrorBanner error={decide.error} /> : null}
      </Dialog>
      <ReasonDialog
        open={!!reject}
        onOpenChange={(o) => !o && setReject(null)}
        title={t('pins.rejectTitle')}
        description={reject ? t('pins.rejectDesc', { name: pickText(reject.customer?.name, locale) }) : undefined}
        minLength={5}
        destructive
        confirmLabel={t('pins.reject')}
        onSubmit={async ({ reason }) => {
          await decide.mutateAsync({ id: reject!.id!, decision: 'reject', reason });
          toast.success(t('pins.rejected'));
        }}
      />
    </>
  );
}

function ProposalCard({ p, canDecide, onApprove, onReject }: { p: LocationProposal; canDecide: boolean; onApprove: () => void; onReject: () => void }) {
  const { t } = useTranslation('customers');
  const locale = useUi((s) => s.locale);
  const vm = useMemo(() => proposalVM(p), [p]);
  const markers: MapMarker[] = useMemo(
    () => [
      ...(vm.current ? [{ id: 'current', ...vm.current, token: '--fg-secondary', title: t('pins.current'), hollow: true, strong: true }] : []),
      ...(vm.proposed ? [{ id: 'proposed', ...vm.proposed, token: '--primary', title: t('pins.proposed'), strong: true }] : []),
    ],
    [vm, t],
  );
  // FR-PLC-001: places near the pin help to judge it (a shop, a mosque next door)
  const [view, setView] = useState<MapViewState | null>(null);
  const layers = useMapLayers({ view });
  const shown = useMemo(() => [...layers.markers, ...markers], [layers.markers, markers]);
  const fit = useMemo(() => boundsOf([vm.current, vm.proposed].filter((x): x is NonNullable<typeof x> => !!x), 0.0015), [vm]);
  const lines = useMemo(() => (vm.current && vm.proposed ? [[vm.current, vm.proposed] as [typeof vm.current, typeof vm.proposed]] : []), [vm]);
  const name = pickText(p.customer?.name, locale);

  return (
    <li className="overflow-hidden rounded-md border border-line bg-surface shadow-e1">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <Link href={`/customers/${p.customer?.id}/`} className="block truncate text-md font-semibold text-fg hover:text-primary" lang={locale}>{name}</Link>
          <p className="font-mono text-xs text-fg-tertiary">{p.customer?.code}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {p.direct ? <Badge tone="neutral">{t('pins.direct')}</Badge> : p.autoApplied ? <Badge tone="info">{t('pins.autoApplied')}</Badge> : null}
          {p.status !== 'pending' ? <StatusBadge status={p.status === 'approved' ? 'verified' : 'rejected'} /> : null}
          {vm.risky && (p.status === 'pending' || p.autoApplied) ? <Badge tone="warning" icon={TriangleAlert}>{t('pins.check')}</Badge> : null}
        </div>
      </div>
      {layers.element}
      <div className="h-52 overflow-hidden border-y border-line">
        {vm.proposed ? <MapView label={t('pins.mapOf', { name })} center={vm.proposed} zoom={16} markers={shown} lines={lines} fit={fit} onView={setView} onMarkerClick={layers.open} className="min-h-0 rounded-none border-0" /> : null}
      </div>
      <dl className="grid grid-cols-3 gap-px bg-line [&>*]:bg-surface">
        <Fact label={t('pins.moved')} value={vm.movedM == null ? t('pins.noPin') : t('pins.metres', { n: formatNumber(vm.movedM) })} warn={(vm.movedM ?? 0) > 500} />
        {vm.method === 'map' ? (
          <Fact
            label={t('pins.method.map')}
            value={p.direct ? '—' : p.deviceMock ? t('pins.mockPhone') : vm.phoneM == null ? t('pins.phoneUnknown') : t('pins.phoneAway', { n: formatNumber(vm.phoneM) })}
            warn={!p.direct && (p.deviceMock || (vm.phoneM ?? 0) > 300)}
          />
        ) : (
          <Fact label={t('pins.accuracy')} value={t('pins.plusMinus', { n: formatNumber(Math.round(p.accuracyM ?? 0)) })} warn={(p.accuracyM ?? 0) > 50} />
        )}
        {p.direct ? (
          <Fact label={t('pins.setBy')} value={p.decider?.name || p.proposer?.name || '—'} sub={p.createdAt ? formatRelative(p.createdAt) : undefined} />
        ) : (
          <Fact label={t('pins.by')} value={p.proposer?.name ?? '—'} sub={p.createdAt ? formatRelative(p.createdAt) : undefined} />
        )}
      </dl>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-fg-secondary">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-fg-secondary" aria-hidden />{t('pins.current')}</span>
        <MoveRight className="size-3.5 text-fg-tertiary rtl:rotate-180" aria-hidden />
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" aria-hidden />{t('pins.proposed')}</span>
      </div>
      {p.note && <p className="border-t border-line px-4 py-2.5 text-sm text-fg" lang={/[ঀ-৿]/.test(p.note) ? 'bn' : 'en'}>{p.note}</p>}
      {canDecide && (
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button onClick={onReject} aria-label={t('pins.rejectFor', { name })}>
            <X className="size-4" aria-hidden />
            {t('pins.reject')}
          </Button>
          <Button variant="primary" onClick={onApprove} aria-label={t('pins.approveFor', { name })}>
            <Check className="size-4" aria-hidden />
            {t('pins.approve')}
          </Button>
        </div>
      )}
    </li>
  );
}

function Fact({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-2.5">
      <dt className="text-xs text-fg-tertiary">{label}</dt>
      <dd>
        <span className={cn('tabular block truncate text-sm font-medium', warn ? 'text-warning' : 'text-fg')}>{value}</span>
        {sub && <span className="block text-xs text-fg-tertiary">{sub}</span>}
      </dd>
    </div>
  );
}
