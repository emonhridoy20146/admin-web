'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowRight, Ban, CircleCheck, CopyPlus, Link2, MapPin, PhoneCall, RotateCcw } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useCan } from '@/shared/auth/session';
import { formatDateTime, formatRelative } from '@/shared/lib/format';
import { Drawer } from '@/shared/ui/overlay';
import { DescList } from '@/shared/ui/page';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useCreateProspect, useProspect, useReopenProspect, useSetProspectStatus, type Prospect } from '../api/prospects';
import { actionsFor, displayPhone, reentryOf, STATUS_TONE } from '../model/prospect';
import { ConvertDialog } from './prospect-dialogs';

const textLang = (s: string) => (/[ঀ-৿]/.test(s) ? 'bn' : 'en');

/** FR-PRO-001: one possible customer, its status history and what the office can do next. */
export function ProspectDrawer({ id, seed, onClose, onOpen }: { id: string | null; seed?: Prospect | null; onClose: () => void; onOpen: (id: string) => void }) {
  const { t } = useTranslation('prospects');
  const q = useProspect(id);
  const p = q.data ?? seed ?? null;
  const canManage = useCan('prospect.manage');
  const canCreate = useCan('prospect.create');
  const setStatus = useSetProspectStatus();
  const reopen = useReopenProspect();
  const create = useCreateProspect();
  const [dialog, setDialog] = useState<'dropped' | 'reopen' | 'convert' | null>(null);
  const acts = p ? actionsFor(p.status) : [];

  const contacted = () => setStatus.mutate({ id: p!.id, status: 'contacted' }, { onSuccess: () => toast.success(t('done.contacted')) });
  const reentry = () =>
    create.mutate(reentryOf(p!, crypto.randomUUID()), {
      onSuccess: (n) => {
        toast.success(t('done.reentry'));
        onOpen(n.id);
      },
    });

  return (
    <>
      <Drawer
        open={!!id}
        onOpenChange={(o) => !o && onClose()}
        title={p?.name ?? ''}
        subtitle={p ? t('createdLine', { name: p.createdBy.name, when: formatRelative(p.createdAt) }) : undefined}
        headerExtra={p ? <Badge tone={STATUS_TONE[p.status]}>{t(`status.${p.status}`)}</Badge> : undefined}
        footer={
          p && canManage ? (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&>button]:w-full [&>button]:min-w-0 [&>button]:h-auto [&>button]:min-h-11 [&>button]:py-2 [&>button]:whitespace-normal sm:[&>button]:w-auto [&>button:last-child:nth-child(odd)]:col-span-2" data-testid="prospect-actions">
              {acts.includes('dropped') && (
                <Button onClick={() => setDialog('dropped')}>
                  <Ban className="size-4" aria-hidden />
                  {t('act.dropped')}
                </Button>
              )}
              {acts.includes('contacted') && (
                <Button onClick={contacted} loading={setStatus.isPending}>
                  <PhoneCall className="size-4" aria-hidden />
                  {t('act.contacted')}
                </Button>
              )}
              {acts.includes('reentry') && canCreate && (
                <Button onClick={reentry} loading={create.isPending}>
                  <CopyPlus className="size-4" aria-hidden />
                  {t('act.reentry')}
                </Button>
              )}
              {acts.includes('reopen') && (
                <Button onClick={() => setDialog('reopen')}>
                  <RotateCcw className="size-4" aria-hidden />
                  {t('act.reopen')}
                </Button>
              )}
              {acts.includes('convert') && (
                <Button variant="primary" onClick={() => setDialog('convert')}>
                  <CircleCheck className="size-4" aria-hidden />
                  {t('act.convert')}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {q.error && !p ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="m-5" /> : null}
        {!p ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <div className="space-y-6 p-5">
            {setStatus.error || create.error ? <ErrorBanner error={setStatus.error ?? create.error} /> : null}
            {p.status === 'converted' && (
              <div className="flex items-start gap-3 rounded-md border border-success/30 bg-success-bg px-3 py-2.5 text-sm text-success">
                <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  {t('convertedTo')}{' '}
                  {p.convertedCustomerId ? (
                    <Link href={`/customers/${p.convertedCustomerId}/`} className="font-semibold underline underline-offset-2">
                      {p.convertedErpCustomerId ?? t('openCustomer')}
                    </Link>
                  ) : (
                    <span className="font-mono font-semibold">{p.convertedErpCustomerId}</span>
                  )}
                  {p.convertedBy && <span className="block text-xs opacity-80">{t('convertedBy', { name: p.convertedBy.name, when: p.convertedAt ? formatDateTime(p.convertedAt) : '' })}</span>}
                </span>
              </div>
            )}
            <DescList
              items={[
                {
                  label: t('col.phones'),
                  value: p.phones.length ? (
                    <span className="flex flex-col gap-0.5">
                      {p.phones.map((ph) => (
                        <a key={ph.number} href={`tel:${ph.number}`} className="tabular font-mono text-sm text-primary hover:underline">
                          {displayPhone(ph.number)}
                          {ph.label ? <span className="ms-1.5 font-sans text-xs text-fg-tertiary">{ph.label}</span> : null}
                        </a>
                      ))}
                    </span>
                  ) : (
                    '—'
                  ),
                },
                { label: t('col.createdAt'), value: formatDateTime(p.createdAt) },
                { label: t('col.address'), value: p.address ? <span lang={textLang(p.address)}>{p.address}</span> : '—' },
                {
                  label: t('location'),
                  value: p.location && 'lat' in p.location && p.location.lat != null ? (
                    <span className="tabular inline-flex items-center gap-1 font-mono text-xs"><MapPin className="size-3.5" aria-hidden />{p.location.lat.toFixed(5)}, {p.location.lng?.toFixed(5)}</span>
                  ) : (
                    '—'
                  ),
                },
              ]}
            />
            {p.note && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-fg-secondary">{t('col.note')}</h3>
                <p className="text-base text-fg" lang={textLang(p.note)}>{p.note}</p>
              </section>
            )}
            {p.fromProspectId && (
              <button type="button" onClick={() => onOpen(p.fromProspectId!)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                {t('fromOld')}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </button>
            )}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{t('history')}</h3>
              <ol className="space-y-0" data-testid="prospect-history">
                {[...p.history].reverse().map((h, i, all) => (
                  <li key={`${h.at}-${i}`} className="flex gap-3">
                    <span className="flex w-3 flex-col items-center pt-1.5" aria-hidden>
                      <span className={cn('size-2.5 rounded-full', i === 0 ? 'bg-primary' : 'bg-fg-disabled')} />
                      {i < all.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                    </span>
                    <div className="min-w-0 flex-1 pb-4">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={STATUS_TONE[h.status]}>{t(`status.${h.status}`)}</Badge>
                        <span className="text-xs text-fg-tertiary">{formatDateTime(h.at)} · {h.by.name}</span>
                      </div>
                      {h.reason && <p className="mt-1 text-sm text-fg-secondary" lang={textLang(h.reason)}>{h.reason}</p>}
                      {h.status === 'converted' && (h.convertedErpCustomerId || h.convertedCustomerId) && <p className="mt-1 font-mono text-xs text-fg-tertiary">{h.convertedErpCustomerId ?? h.convertedCustomerId}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Drawer>

      <ReasonDialog
        open={dialog === 'dropped'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t('dropTitle')}
        description={p ? t('dropDesc', { name: p.name }) : undefined}
        minLength={3}
        destructive
        confirmLabel={t('act.dropped')}
        onSubmit={async ({ reason }) => {
          await setStatus.mutateAsync({ id: p!.id, status: 'dropped', reason });
          toast.success(t('done.dropped'));
        }}
      />
      <ReasonDialog
        open={dialog === 'reopen'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t('reopenTitle')}
        description={p ? t('reopenDesc', { name: p.name }) : undefined}
        minLength={3}
        confirmLabel={t('act.reopen')}
        onSubmit={async ({ reason }) => {
          await reopen.mutateAsync({ id: p!.id, reason });
          toast.success(t('done.reopen'));
        }}
      />
      <ConvertDialog prospect={dialog === 'convert' ? p : null} onClose={() => setDialog(null)} />
    </>
  );
}
