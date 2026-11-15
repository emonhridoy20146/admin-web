'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronDown, Lock } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { formatDate, formatNumber, pickText } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/page';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Switch } from '@/shared/ui/primitives';
import { TriState } from '@/shared/ui/tri-state';
import { Button } from '@/shared/ui/button';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useFlags, useSetFlag, type FeatureFlag } from '../api/flags';
import { applyTri, isOnFor, overridesOf, sameOverrides, toBody, triOf, type Overrides } from '../model/flag';

export function FlagsPage() {
  const { t } = useTranslation('admin-flags');
  useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const q = useFlags();
  return (
    <>
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
      <div className="overflow-hidden rounded-md border border-line bg-surface shadow-e1">
        {q.isLoading ? (
          <div className="divide-y divide-line">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="p-4"><Skeleton className="h-5 w-64" /></div>)}</div>
        ) : (
          <ul className="divide-y divide-line">{(q.data ?? []).map((f) => <FlagRow key={f.key} f={f} />)}</ul>
        )}
      </div>
    </>
  );
}

function FlagRow({ f }: { f: FeatureFlag }) {
  const { t } = useTranslation('admin-flags');
  const locale = useUi((s) => s.locale);
  const canManage = useCan('flag.manage');
  const branches = useBranches();
  const set = useSetFlag();
  const [expanded, setExpanded] = useState(false);
  const [confirmGlobal, setConfirmGlobal] = useState(false);
  const [confirmBranches, setConfirmBranches] = useState(false);
  const saved = overridesOf(f);
  const [draft, setDraft] = useState<Overrides>(saved);
  useEffect(() => setDraft(overridesOf(f)), [f]);
  const locked = !!f.lockedReason;
  const name = t(`names.${f.key}`, { defaultValue: f.key ?? '' });
  const list = branches.data ?? [];
  const onCount = list.filter((b) => isOnFor(f.defaultEnabled, saved, b.id!)).length;
  const dirty = !sameOverrides(saved, draft);
  const disabled = !canManage || locked;

  return (
    <li className={cn(locked && 'bg-surface-subtle/50')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-fg">{name}</span>
            <span className="font-mono text-xs text-fg-tertiary">{f.key}</span>
            {locked && <Badge tone="neutral" icon={Lock}>{t('locked')}</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-fg-secondary">{locked ? f.lockedReason : f.description}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-fg-tertiary">
            {f.owner && <span>{t('owner', { owner: f.owner })}</span>}
            {f.reviewBy && <span>{t('review', { date: formatDate(f.reviewBy) })}</span>}
            {list.length > 0 && <span className={cn(onCount > 0 && onCount < list.length && 'font-medium text-warning')}>{t('onIn', { n: formatNumber(onCount), total: formatNumber(list.length) })}</span>}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((x) => !x)} aria-expanded={expanded} disabled={locked}>
          {t('editBranches')}
          {Object.keys(saved).length > 0 && <span className="tabular rounded-full bg-warning-bg px-1.5 text-xs text-warning">{formatNumber(Object.keys(saved).length)}</span>}
          <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
        </Button>
        <label className="flex items-center gap-2.5">
          <span className={cn('w-10 text-end text-sm font-medium', f.defaultEnabled ? 'text-success' : 'text-fg-tertiary')}>{f.defaultEnabled ? t('on') : t('off')}</span>
          <Switch checked={!!f.defaultEnabled} disabled={disabled || set.isPending} onCheckedChange={() => setConfirmGlobal(true)} aria-label={`${name} · ${t('global')}`} />
        </label>
      </div>

      {expanded && !locked && (
        <div className="border-t border-line bg-surface-subtle/60 px-4 py-3">
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((b) => {
              const v = triOf(draft, b.id!);
              const on = isOnFor(f.defaultEnabled, draft, b.id!);
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded-sm border border-line bg-surface px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium" lang={locale}>{pickText(b.name, locale)}</span>
                    <span className={cn('block text-xs', on ? 'text-success' : 'text-fg-tertiary')}>{on ? t('on') : t('off')}</span>
                  </span>
                  <TriState
                    value={v}
                    onChange={(nv) => setDraft((d) => applyTri(d, b.id!, nv))}
                    label={pickText(b.name, locale)}
                    labels={{ inherit: t('inherit'), on: t('on'), off: t('off') }}
                    disabled={disabled}
                    changed={triOf(saved, b.id!) !== v}
                  />
                </li>
              );
            })}
          </ul>
          {dirty && (
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDraft(saved)}>{t('reset')}</Button>
              <Button size="sm" variant="primary" onClick={() => setConfirmBranches(true)}>{t('saveBranches')}</Button>
            </div>
          )}
        </div>
      )}

      <ReasonDialog
        open={confirmGlobal}
        onOpenChange={setConfirmGlobal}
        title={f.defaultEnabled ? t('turnOffTitle', { name }) : t('turnOnTitle', { name })}
        description={t('toggleDesc')}
        minLength={5}
        destructive={!!f.defaultEnabled}
        confirmLabel={f.defaultEnabled ? t('turnOff') : t('turnOn')}
        onSubmit={async ({ reason }) => {
          await set.mutateAsync({ key: f.key!, body: { defaultEnabled: !f.defaultEnabled, reason } });
          toast.success(t('saved'));
        }}
      />
      <ReasonDialog
        open={confirmBranches}
        onOpenChange={setConfirmBranches}
        title={t('branchTitle', { name })}
        description={t('branchDesc')}
        minLength={5}
        confirmLabel={t('save')}
        onSubmit={async ({ reason }) => {
          await set.mutateAsync({ key: f.key!, body: { branchOverrides: toBody(draft), reason } });
          toast.success(t('saved'));
        }}
      />
    </li>
  );
}
