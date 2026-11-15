'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowRight, Flag, FlagOff, History, Lock } from 'lucide-react';
import { useCan } from '@/shared/auth/session';
import { formatDateTime, formatMoney, formatDate, pickText } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { Button } from '@/shared/ui/button';
import { Card, CardHeader } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Field, Select } from '@/shared/ui/form';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import type { components } from '@/shared/api/schema';
import { useSetTag, useTagHistory } from '../api/tags';

type Customer = components['schemas']['CustomerDetail'];
type Tag = components['schemas']['Tag'];
const TAG_CODES = ['plan_ended_unpaid', 'repeated_broken_promise', 'refused_to_pay', 'absconded', 'fraud_suspected', 'other'] as const;
const UNTAG_CODES = ['cleared', 'mistake', 'other'] as const;

/** Customer-detail extension tab (FR-TAG-002/003/005/008): suggestion, current tag, tag/untag with reason, history. */
export function TagTab({ customerId, customer: c }: { customerId: string; customer: Customer }) {
  const { t } = useTranslation('tags');
  const locale = useUi((s) => s.locale);
  const canSet = useCan('tag.set');
  const history = useTagHistory(customerId);
  const setTag = useSetTag(customerId, c.version);
  const [open, setOpen] = useState<'tag' | 'untag' | null>(null);
  const [severity, setSeverity] = useState<'watch' | 'bad' | 'legal'>('bad');
  const tagged = c.tag?.state === 'tagged';
  const name = pickText(c.name, locale);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="h-fit p-5">
        <div className="text-sm font-semibold text-fg-secondary">{t('current')}</div>
        <div className="mt-3 flex items-center gap-3">
          <span className={tagged ? 'grid size-10 place-items-center rounded-md bg-st-tagged-bg text-st-tagged' : 'grid size-10 place-items-center rounded-md bg-surface-hover text-fg-tertiary'}>
            {tagged ? <Flag className="size-5 fill-current" aria-hidden /> : <FlagOff className="size-5" aria-hidden />}
          </span>
          <div>
            <div className="text-md font-semibold">{tagged ? t('tagged') : t('none')}</div>
            {tagged && c.tag?.severity && <Badge tone="tagged" icon={false} className="mt-1">{t(`sev.${c.tag.severity}`)}</Badge>}
          </div>
        </div>
        {tagged && (
          <div className="mt-4 rounded-md bg-surface-subtle px-3 py-2.5 text-sm">
            <p className="font-medium">{t(`codes.${c.tag?.reasonCode}`, { defaultValue: c.tag?.reasonCode })}</p>
            {c.tag?.reason && <p className="mt-1 text-fg-secondary">{c.tag.reason}</p>}
            {c.tag?.setAt && <p className="mt-1.5 text-xs text-fg-tertiary">{formatDateTime(c.tag.setAt)}</p>}
          </div>
        )}
        {tagged && (c.totalOutstandingPoisha ?? 0) === 0 && <p className="mt-3 rounded-md bg-info-bg px-3 py-2 text-sm text-info">{t('cleared')}</p>}
        {!tagged && c.badSuggestion && (
          <p className="mt-4 rounded-md border border-dashed border-st-bad-suggested bg-st-bad-suggested-bg px-3 py-2 text-sm text-st-bad-suggested">
            {formatDate(c.badSuggestion.finalDueDate!)} · {formatMoney(c.badSuggestion.outstandingPoisha ?? 0)}
          </p>
        )}
        <div className="mt-5">
          {canSet ? (
            tagged ? (
              <Button variant="secondary" className="w-full" onClick={() => setOpen('untag')}>
                <FlagOff className="size-4" aria-hidden />
                {t('untagAction')}
              </Button>
            ) : (
              <Button variant="destructive" className="w-full" onClick={() => setOpen('tag')}>
                <Flag className="size-4" aria-hidden />
                {t('tagAction')}
              </Button>
            )
          ) : (
            <p className="flex items-center gap-2 text-sm text-fg-tertiary">
              <Lock className="size-4" aria-hidden />
              {t('noPermission')}
            </p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={t('history')} />
        {history.error ? <ErrorBanner error={history.error} onRetry={() => history.refetch()} className="m-4" /> : null}
        {history.isLoading ? (
          <div className="space-y-3 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        ) : !history.data?.length ? (
          <EmptyState icon={History} title={t('noHistory')} />
        ) : (
          <ul className="divide-y divide-line">
            {history.data.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <TagPill tag={e.previous} />
                  <ArrowRight className="size-3.5 text-fg-tertiary" aria-hidden />
                  <TagPill tag={e.next} />
                  <span className="ms-auto text-xs text-fg-tertiary">{formatDateTime(e.at!)}</span>
                </div>
                <p className="mt-1.5 text-base">
                  <span className="font-medium">{t(`codes.${e.reasonCode}`, { defaultValue: e.reasonCode })}</span>
                  {e.reason && <span className="text-fg-secondary"> — {e.reason}</span>}
                </p>
                <p className="mt-0.5 text-xs text-fg-tertiary">{e.actor?.name} · {t(`source.${e.source}`, { defaultValue: e.source })}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReasonDialog
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open === 'untag' ? t('untagTitle', { name }) : t('tagTitle', { name })}
        description={open === 'untag' ? t('untagDesc') : t('tagDesc')}
        codes={(open === 'untag' ? UNTAG_CODES : TAG_CODES).map((k) => [k, t(`codes.${k}`)] as [string, string])}
        confirmLabel={open === 'untag' ? t('untagAction') : t('tagAction')}
        destructive={open === 'tag'}
        onSubmit={async (v) => {
          await setTag.mutateAsync({ state: open === 'untag' ? 'none' : 'tagged', severity: open === 'tag' ? severity : undefined, reasonCode: v.reasonCode as never, reason: v.reason });
          toast.success(t('done'));
        }}
      >
        {open === 'tag' && (
          <Field label={t('severity')} required>
            {(id) => (
              <Select id={id} value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
                {(['watch', 'bad', 'legal'] as const).map((s) => <option key={s} value={s}>{t(`sev.${s}`)}</option>)}
              </Select>
            )}
          </Field>
        )}
      </ReasonDialog>
    </div>
  );
}

function TagPill({ tag }: { tag?: Tag }) {
  const { t } = useTranslation('tags');
  return tag?.state === 'tagged' ? <Badge tone="tagged" icon={Flag} filled>{t(`sev.${tag.severity ?? 'bad'}`)}</Badge> : <Badge tone="neutral" icon={FlagOff}>{t('none')}</Badge>;
}
