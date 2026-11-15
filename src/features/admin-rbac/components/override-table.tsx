'use client';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Lock, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatNumber, pickText } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { TriState } from '@/shared/ui/tri-state';
import { StagedBar as SharedStagedBar } from '@/shared/ui/staged-bar';
import { Button } from '@/shared/ui/button';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger, Tooltip } from '@/shared/ui/primitives';
import { resolve, type Effect, type ModuleGroup } from '../model/matrix';

const EFFECTS: Effect[] = ['inherit', 'allow', 'deny'];

export function Allowed({ value, muted }: { value: boolean; muted?: boolean }) {
  const { t } = useTranslation('admin-rbac');
  return value ? (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', muted ? 'text-fg-secondary' : 'text-success')}>
      <Check className="size-4" aria-hidden />
      {t('allowed')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm text-fg-tertiary">
      <Minus className="size-4" aria-hidden />
      {t('denied')}
    </span>
  );
}

const TO_TRI = { inherit: 'inherit', allow: 'on', deny: 'off' } as const;
const FROM_TRI = { inherit: 'inherit', on: 'allow', off: 'deny' } as const;

/** Tri-state: inherit / allow / deny (shared TriState with permission wording). */
export function EffectToggle({ value, onChange, label, disabled, changed }: { value: Effect; onChange: (e: Effect) => void; label: string; disabled?: boolean; changed?: boolean }) {
  const { t } = useTranslation('admin-rbac');
  return (
    <TriState
      value={TO_TRI[value]}
      onChange={(v) => onChange(FROM_TRI[v])}
      label={label}
      disabled={disabled}
      changed={changed}
      labels={{ inherit: t('effect.inherit'), on: t('effect.allow'), off: t('effect.deny') }}
    />
  );
}

export interface OverrideRowState {
  /** value without an override at this level */
  base: boolean;
  current: Effect;
  staged?: Effect;
  source?: string;
  locked?: boolean;
}

export function OverrideTable({
  groups, rows, onStage, onBulk, showSource,
}: {
  groups: ModuleGroup[];
  rows: (key: string) => OverrideRowState;
  onStage: (key: string, e: Effect) => void;
  onBulk: (g: ModuleGroup, e: Effect) => void;
  showSource?: boolean;
}) {
  const { t } = useTranslation('admin-rbac');
  const locale = useUi((s) => s.locale);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface shadow-e1">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('title')}</caption>
        <thead className="bg-surface-subtle text-start text-xs font-medium text-fg-secondary">
          <tr className="border-b border-line">
            <th scope="col" className="px-4 py-2.5 text-start font-medium">{t('col.permission')}</th>
            {showSource && <th scope="col" className="hidden px-3 py-2.5 text-start font-medium md:table-cell">{t('col.source')}</th>}
            <th scope="col" className="hidden px-3 py-2.5 text-start font-medium md:table-cell">{t('col.default')}</th>
            <th scope="col" className="px-3 py-2.5 text-start font-medium">{t('col.override')}</th>
            <th scope="col" className="hidden px-4 py-2.5 text-start font-medium sm:table-cell">{t('col.effective')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const allLocked = g.perms.every((p) => p.reserved || rows(p.key!).locked);
            return (
              <Fragment key={g.module}>
                <tr className="border-b border-line bg-surface-subtle/60">
                  <th scope="rowgroup" colSpan={showSource ? 5 : 4} className="px-4 py-2 text-start">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{t(`modules.${g.module}`, { defaultValue: g.module })}</span>
                      {!allLocked && (
                        <DropdownMenu>
                          <DropdownTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              {t('bulk.label', { module: t(`modules.${g.module}`, { defaultValue: g.module }) })}
                              <ChevronDown className="size-3.5" aria-hidden />
                            </Button>
                          </DropdownTrigger>
                          <DropdownContent>
                            {EFFECTS.map((e) => <DropdownItem key={e} onSelect={() => onBulk(g, e)}>{t(`bulk.${e}`)}</DropdownItem>)}
                          </DropdownContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </th>
                </tr>
                {g.perms.map((p) => {
                  const r = rows(p.key!);
                  const effect = r.staged ?? r.current;
                  const changed = r.staged != null && r.staged !== r.current;
                  const locked = p.reserved || r.locked;
                  const result = p.reserved ? false : resolve(effect, r.base);
                  return (
                    <tr key={p.key} className={cn('border-b border-line last:border-0', changed && 'bg-primary-subtle/40')}>
                      <th scope="row" className="px-4 py-2.5 text-start font-normal">
                        <span className="block font-mono text-xs text-fg">{p.key}</span>
                        <span className="block text-xs text-fg-tertiary" lang={locale}>{pickText(p.description, locale)}</span>
                      </th>
                      {showSource && (
                        <td className="hidden px-3 py-2.5 md:table-cell">
                          {r.source && <Badge tone={r.source === 'user' ? 'info' : r.source === 'branch' ? 'warning' : 'neutral'} icon={false}>{t(`source.${r.source}`)}</Badge>}
                        </td>
                      )}
                      <td className="hidden px-3 py-2.5 md:table-cell"><Allowed value={r.base && !p.reserved} muted /></td>
                      <td className="px-3 py-2">
                        {p.reserved ? (
                          <Tooltip content={t('reservedHint')}>
                            <span tabIndex={0} className="inline-flex items-center gap-1 text-xs text-fg-tertiary"><Lock className="size-3.5" aria-hidden />{t('reserved')}</span>
                          </Tooltip>
                        ) : (
                          <EffectToggle value={effect} onChange={(e) => onStage(p.key!, e)} label={p.key!} disabled={locked} changed={changed} />
                        )}
                      </td>
                      <td className="hidden px-4 py-2.5 sm:table-cell"><Allowed value={result} /></td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Save bar with permission wording. */
export function StagedBar({ count, onDiscard, onSave }: { count: number; onDiscard: () => void; onSave: () => void }) {
  const { t } = useTranslation('admin-rbac');
  return <SharedStagedBar label={count ? t('staged', { count, n: formatNumber(count) }) : null} discardLabel={t('discard')} saveLabel={t('review')} onDiscard={onDiscard} onSave={onSave} />;
}
