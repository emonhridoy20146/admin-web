'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { cn } from '@/shared/lib/cn';
import { formatMoney, formatNumber, formatPercent, pickText } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/page';
import { Card } from '@/shared/ui/card';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Input, Select } from '@/shared/ui/form';
import { Switch } from '@/shared/ui/primitives';
import { StagedBar } from '@/shared/ui/staged-bar';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useBranches } from '@/features/shell';
import { useSaveSettings, useSettings } from '../api/settings';
import { BranchLocations } from '../components/branch-locations';
import { BreakWindows } from '../components/break-windows';
import { diff, FIELDS, KNOWN, read, SECTIONS, toDraft, type BreakWindow, type Draft, type FieldDef } from '../model/schema';

export function SettingsPage() {
  const { t } = useTranslation('admin-settings');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const canManage = useCan('settings.manage');
  // '' = the whole organisation; a branch id = that branch's own values (only settings a branch may override).
  const [branchId, setBranchId] = useState('');
  const branches = useBranches();
  const q = useSettings(branchId || undefined);
  const save = useSaveSettings();
  const [draft, setDraft] = useState<Draft>({});
  const [showErrors, setShowErrors] = useState(false);
  const [open, setOpen] = useState(false);
  const current = useMemo(() => q.data ?? {}, [q.data]);
  const { changes, errors, fieldChanges } = useMemo(() => diff(current, draft, { branchOnly: !!branchId }), [current, draft, branchId]);
  const nChanges = Object.keys(fieldChanges).length;
  const showBar = nChanges > 0 || Object.keys(errors).some((k) => k in draft);
  const others = Object.keys(current).filter((k) => !KNOWN.has(k));
  const sections = SECTIONS.map((sec) => ({ ...sec, fields: sec.fields.filter((f) => !branchId || f.branch) })).filter((sec) => sec.fields.length > 0);
  const branchName = pickText(branches.data?.find((b) => b.id === branchId)?.name, locale) || branchId;

  const value = (f: FieldDef) => (f.key in draft ? draft[f.key] : toDraft(f, read(f, current)));
  const set = (key: string, v: unknown) => setDraft((d) => ({ ...d, [key]: v }));

  return (
    <>
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>
      {(branches.data?.length ?? 0) > 1 && (
        <Card className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
          <label htmlFor="set-scope" className="text-base font-medium text-fg">{t('scope.label')}</label>
          <Select
            id="set-scope"
            value={branchId}
            onChange={(e) => (setBranchId(e.target.value), setDraft({}), setShowErrors(false))}
            className="w-full sm:w-72"
            aria-describedby="set-scope-d"
          >
            <option value="">{t('scope.all')}</option>
            {branches.data?.map((b) => <option key={b.id} value={b.id}>{pickText(b.name, locale) || b.code}</option>)}
          </Select>
          <p id="set-scope-d" className="basis-full text-sm text-fg-secondary">{branchId ? t('scope.branchNote', { name: branchName }) : t('scope.allNote')}</p>
        </Card>
      )}
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label={t('title')} className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5 text-sm">
            {[...sections.map((s) => s.id), ...(branchId ? [] : ['branches', ...(others.length ? ['other'] : [])])].map((id) => (
              <li key={id}>
                <a href={`#set-${id}`} className="block rounded-sm px-3 py-1.5 text-fg-secondary hover:bg-surface-hover hover:text-fg">{t(`sections.${id}.title`)}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-5">
          {q.isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-md" />)
            : sections.map((sec) => (
                <Card key={sec.id} id={`set-${sec.id}`} className="scroll-mt-20 p-0">
                  <div className="border-b border-line px-5 py-4">
                    <h2 className="text-md font-semibold text-fg">{t(`sections.${sec.id}.title`)}</h2>
                    <p className="mt-0.5 text-sm text-fg-secondary">{t(`sections.${sec.id}.desc`)}</p>
                  </div>
                  <div className="divide-y divide-line">
                    {sec.fields.map((f) => (
                      <FieldRow key={f.key} f={f} value={value(f)} changed={f.key in fieldChanges} error={showErrors || f.key in draft ? errors[f.key] : undefined} disabled={!canManage} onChange={(v) => set(f.key, v)} />
                    ))}
                  </div>
                </Card>
              ))}
          {!branchId && <BranchLocations canManage={canManage} />}
          {!branchId && others.length > 0 && (
            <Card id="set-other" className="scroll-mt-20 p-0">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-md font-semibold text-fg">{t('sections.other.title')}</h2>
                <p className="mt-0.5 text-sm text-fg-secondary">{t('sections.other.desc')}</p>
              </div>
              <dl className="divide-y divide-line">
                {others.map((k) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-5 py-3">
                    <dt className="font-mono text-xs text-fg-secondary">{k}</dt>
                    <dd className="truncate font-mono text-sm text-fg">{JSON.stringify(current[k])}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          <StagedBar
            label={showBar ? t('changed', { count: nChanges, n: formatNumber(nChanges) }) : null}
            discardLabel={t('discard')}
            saveLabel={t('review')}
            onDiscard={() => (setDraft({}), setShowErrors(false))}
            onSave={() => {
              if (Object.keys(errors).length) {
                setShowErrors(true);
                toast.error(t('fixErrors'));
                return;
              }
              if (nChanges) setOpen(true);
            }}
          />
        </div>
      </div>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={branchId ? t('saveTitleBranch', { n: formatNumber(nChanges), name: branchName }) : t('saveTitle', { n: formatNumber(nChanges) })}
        minLength={5}
        confirmLabel={t('saveConfirm')}
        onSubmit={async ({ reason }) => {
          await save.mutateAsync({ changes, reason, ...(branchId ? { branchId } : {}) });
          setDraft({});
          toast.success(t('saved'));
        }}
      >
        <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-sm border border-line bg-surface-subtle p-3 text-sm">
          {Object.entries(fieldChanges).map(([k, v]) => {
            const f = FIELDS.find((x) => x.key === k)!;
            return (
              <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-fg-secondary">{t(`fields.${k}.label`)}</span>
                <span className="tabular">
                  <span className="text-fg-tertiary line-through">{display(f, read(f, current), t)}</span>
                  <span className="mx-1.5 text-fg-tertiary" aria-hidden>→</span>
                  <span className="font-medium text-fg">{display(f, v, t)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </ReasonDialog>
    </>
  );
}

function display(f: FieldDef, v: unknown, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (v == null || v === '') return '—';
  switch (f.type) {
    case 'money':
      return formatMoney(Number(v));
    case 'ratio':
      return formatPercent(Number(v));
    case 'int':
      return `${formatNumber(Number(v))}${f.unit ? ` ${t(`units.${f.unit}`)}` : ''}`;
    case 'bool':
      return v ? t('on') : t('off');
    case 'enum':
      return t(`enum.${f.labels?.[String(v)] ?? String(v)}`);
    case 'weekdays': {
      const names = t('weekdays', { returnObjects: true }) as unknown as string[];
      return (v as number[]).map((d) => names[d]).join(', ') || '—';
    }
    case 'multi':
      return (v as string[]).map((o) => t(`enum.${o}`)).join(', ') || t('none');
    case 'windows': {
      const names = t('weekdays', { returnObjects: true }) as unknown as string[];
      return (v as BreakWindow[]).map((w) => `${names[w.weekday]} ${w.start}–${w.end}`).join(', ') || t('none');
    }
    default:
      return String(v);
  }
}

function FieldRow({ f, value, onChange, changed, error, disabled }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void; changed: boolean; error?: string; disabled: boolean }) {
  const { t } = useTranslation('admin-settings');
  const id = `f-${f.key}`;
  const help = t(`fields.${f.key}.help`);
  const describedBy = error || help ? `${id}-d` : undefined;
  const suffix = f.type === 'int' && f.unit ? t(`units.${f.unit}`) : f.type === 'ratio' ? t('units.pct') : null;

  let control: React.ReactNode;
  switch (f.type) {
    case 'bool':
      control = <Switch id={id} checked={!!value} onCheckedChange={onChange} disabled={disabled} aria-describedby={describedBy} />;
      break;
    case 'enum':
      control = (
        <Select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full sm:w-64" aria-describedby={describedBy}>
          {f.options.map((o) => <option key={o} value={o}>{t(`enum.${f.labels?.[o] ?? o}`)}</option>)}
        </Select>
      );
      break;
    case 'weekdays': {
      const names = t('weekdays', { returnObjects: true }) as unknown as string[];
      const sel = (value as number[]) ?? [];
      control = (
        <div role="group" aria-labelledby={`${id}-l`} aria-describedby={describedBy} className="flex flex-wrap gap-1">
          {names.map((n, d) => {
            const on = sel.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => onChange(on ? sel.filter((x) => x !== d) : [...sel, d])}
                className={cn('h-9 min-w-11 rounded-sm border px-2 text-sm font-medium transition-colors disabled:opacity-50', on ? 'border-primary bg-primary-subtle text-primary-subtle-fg' : 'border-line text-fg-secondary hover:bg-surface-hover')}
              >
                {n}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case 'multi': {
      const sel = (value as string[]) ?? [];
      control = (
        <div role="group" aria-labelledby={`${id}-l`} aria-describedby={describedBy} className="flex flex-wrap gap-1.5">
          {f.options.map((o) => {
            const on = sel.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => onChange(on ? sel.filter((x) => x !== o) : [...sel, o])}
                className={cn('inline-flex h-9 items-center gap-1.5 rounded-sm border px-3 text-sm font-medium transition-colors disabled:opacity-50 [@media(pointer:coarse)]:h-11', on ? 'border-primary bg-primary-subtle text-primary-subtle-fg' : 'border-line text-fg-secondary hover:bg-surface-hover')}
              >
                {on && <Check className="size-3.5" aria-hidden strokeWidth={2.5} />}
                {t(`enum.${o}`)}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case 'windows':
      control = <BreakWindows id={id} value={(value as BreakWindow[]) ?? []} onChange={onChange} disabled={disabled} describedBy={describedBy} invalid={!!error} />;
      break;
    default:
      control = (
        <div className="flex items-center gap-2">
          {f.type === 'money' && <span className="text-fg-tertiary">{t('units.taka')}</span>}
          <Input
            id={id}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            inputMode={f.type === 'time' || f.type === 'version' ? 'text' : 'numeric'}
            className={cn('tabular w-full sm:w-40', (f.type === 'time' || f.type === 'version') && 'font-mono')}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
          {suffix && <span className="shrink-0 text-sm text-fg-tertiary">{suffix}</span>}
        </div>
      );
  }

  return (
    <div className={cn('grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6', changed && 'bg-primary-subtle/40')}>
      <div className="min-w-0" title={f.src ? `${f.src.key}.${f.src.prop}` : f.key}>
        <label id={`${id}-l`} htmlFor={id} className="flex items-center gap-2 text-base font-medium text-fg">
          {t(`fields.${f.key}.label`)}
          {changed && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
        </label>
        <p id={describedBy} className={cn('mt-1 max-w-[68ch] text-sm leading-relaxed', error ? 'text-danger' : 'text-fg-secondary')}>
          {error ? t(error) : help}
        </p>

      </div>
      <div className="sm:justify-self-end">{control}</div>
    </div>
  );
}
