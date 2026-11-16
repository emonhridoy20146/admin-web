'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CircleCheck, CircleSlash, Hourglass, ShieldAlert, Smartphone, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatNumber, formatRelative, pickText } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { EmptyState, ErrorBanner } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Dialog } from '@/shared/ui/overlay';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { Segmented } from '@/shared/ui/primitives';
import { useApproveDevice, useDevices, useDeviceUsers, useUnbindDevice, type Device } from '../api/devices';
import { counts, filterDevices, IDLE_WARN_DAYS, idleDays, risks, sortDevices, statusOf, VIEWS, type DeviceStatus } from '../model/device';

const TONE: Record<DeviceStatus, 'warning' | 'success' | 'neutral'> = { pending_approval: 'warning', active: 'success', unbound: 'neutral' };
const ICON: Record<DeviceStatus, LucideIcon> = { pending_approval: Hourglass, active: CircleCheck, unbound: CircleSlash };

export function DevicesPage() {
  const { t } = useTranslation('admin-devices');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const view = oneOf(url.get('view'), VIEWS, 'all');
  const q = useDevices();
  const users = useDeviceUsers();
  const approve = useApproveDevice();
  const unbind = useUnbindDevice();
  const [toApprove, setToApprove] = useState<Device | null>(null);
  const [toUnbind, setToUnbind] = useState<Device | null>(null);

  const names = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, { name: pickText(u.name, locale), code: u.employeeCode ?? '' }])), [users.data, locale]);
  const n = useMemo(() => counts(q.data), [q.data]);
  const rows = useMemo(() => sortDevices(filterDevices(q.data ?? [], view)), [q.data, view]);
  const nameOf = (d: Device | null) => names.get(d?.userId)?.name ?? t('unknownStaff');
  const phoneOf = (d: Device | null) => d?.model || t('unknownPhone');
  const riskText = (d: Device) => risks(d).map((r) => t(`risk.${r}`)).join(', ');

  const columns: Column<Device>[] = [
    {
      id: 'staff', header: t('col.staff'), priority: 1, mobile: 'title',
      cell: (d) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-fg" lang={locale}>{nameOf(d)}</span>
          {names.get(d.userId)?.code ? <span className="block font-mono text-xs text-fg-tertiary">{names.get(d.userId)!.code}</span> : null}
        </span>
      ),
    },
    {
      id: 'phone', header: t('col.phone'), priority: 1, mobile: 'subtitle',
      cell: (d) => (
        <span className="block">
          <span className="block text-fg">{phoneOf(d)}</span>
          <span className="block text-xs text-fg-tertiary">{d.androidVersion ? t('android', { v: d.androidVersion }) : ''}</span>
        </span>
      ),
    },
    {
      id: 'status', header: t('col.status'), priority: 1, mobile: 'badges',
      cell: (d) => {
        const s = statusOf(d);
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={TONE[s]} icon={ICON[s]}>{t(`status.${s}`)}</Badge>
            {risks(d).map((r) => <Badge key={r} tone="danger" icon={ShieldAlert}>{t(`risk.${r}`)}</Badge>)}
          </span>
        );
      },
    },
    { id: 'app', header: t('col.app'), priority: 3, cell: (d) => <span className="font-mono text-sm text-fg-secondary">{d.appVersion ?? '—'}</span> },
    { id: 'bound', header: t('col.bound'), priority: 4, cell: (d) => <span className="tabular text-fg-secondary">{d.boundAt ? formatDate(d.boundAt, { withYear: true }) : '—'}</span> },
    {
      id: 'seen', header: t('col.seen'), priority: 2, mobile: 'meta',
      cell: (d) => {
        const idle = idleDays(d);
        return (
          <span className="block">
            <span className="tabular block text-fg-secondary">{d.lastSeenAt ? formatRelative(d.lastSeenAt) : t('never')}</span>
            {statusOf(d) === 'active' && idle !== null && idle >= IDLE_WARN_DAYS ? <span className="block text-xs text-warning">{t('idle', { n: formatNumber(idle) })}</span> : null}
          </span>
        );
      },
    },
    {
      id: 'actions', header: t('col.actions'), priority: 1, align: 'end', mobile: 'amount', hideable: false,
      cell: (d) => {
        const s = statusOf(d);
        return (
          <span className="flex justify-end gap-2">
            {s === 'pending_approval' && <Button size="sm" variant="primary" aria-label={t('approveFor', { name: nameOf(d) })} onClick={() => setToApprove(d)}>{t('approve')}</Button>}
            {s !== 'unbound' && <Button size="sm" aria-label={t('unbindFor', { name: nameOf(d) })} onClick={() => setToUnbind(d)}>{t('unbind')}</Button>}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>

      <Segmented className="mb-4" label={t('col.status')} value={view} onChange={(v) => url.set({ view: v === 'all' ? null : v })} options={VIEWS.map((v) => ({ value: v, label: t(`view.${v}`), count: q.data ? n[v] : undefined }))} />

      <DataTable
        tableId="devices"
        caption={t('title')}
        columns={columns}
        rows={q.isLoading ? undefined : rows}
        rowKey={(d) => d.id ?? ''}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        empty={<EmptyState icon={Smartphone} title={t('empty')} body={t('emptyBody')} />}
      />

      <Dialog
        open={!!toApprove}
        onOpenChange={(o) => !o && !approve.isPending && setToApprove(null)}
        title={t('approveTitle')}
        description={t('approveDesc', { name: nameOf(toApprove), phone: phoneOf(toApprove) })}
        footer={
          <>
            <Button onClick={() => setToApprove(null)} disabled={approve.isPending}>{tc('actions.cancel')}</Button>
            <Button variant="primary" loading={approve.isPending} onClick={() => approve.mutate(toApprove!.id!, { onSuccess: () => (toast.success(t('approved')), setToApprove(null)) })}>{t('approve')}</Button>
          </>
        }
      >
        {approve.error ? <ErrorBanner error={approve.error} /> : null}
        {toApprove && risks(toApprove).length > 0 && (
          <p className="flex items-start gap-2 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('approveRisk', { risks: riskText(toApprove) })}
          </p>
        )}
      </Dialog>

      <ReasonDialog
        open={!!toUnbind}
        onOpenChange={(o) => !o && setToUnbind(null)}
        title={t('unbindTitle')}
        description={t('unbindDesc', { name: nameOf(toUnbind), phone: phoneOf(toUnbind) })}
        minLength={5}
        destructive
        confirmLabel={t('unbind')}
        onSubmit={async ({ reason }) => {
          await unbind.mutateAsync({ id: toUnbind!.id!, reason });
          toast.success(t('unbound'));
          setToUnbind(null);
        }}
      />
    </>
  );
}
