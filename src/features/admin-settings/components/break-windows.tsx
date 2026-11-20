'use client';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { formatNumber } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Input, Select } from '@/shared/ui/form';
import type { BreakWindow } from '../model/schema';

/**
 * Weekly break windows of the duty hours (field-api FR-ATT-010): on that weekday, break time inside the window is
 * allowed on top of the daily break limit. The owner's case is Friday 12:30–15:30 for branches without an off day.
 */
export function BreakWindows({ id, value, onChange, disabled, describedBy, invalid }: { id: string; value: BreakWindow[]; onChange: (v: BreakWindow[]) => void; disabled: boolean; describedBy?: string; invalid: boolean }) {
  const { t } = useTranslation('admin-settings');
  const days = t('weekdaysLong', { returnObjects: true }) as unknown as string[];
  const set = (i: number, patch: Partial<BreakWindow>) => onChange(value.map((w, k) => (k === i ? { ...w, ...patch } : w)));
  return (
    <div role="group" aria-labelledby={`${id}-l`} aria-describedby={describedBy} className="space-y-2">
      {value.length === 0 && <p className="text-sm text-fg-tertiary">{t('windows.none')}</p>}
      {value.map((w, i) => {
        const n = formatNumber(i + 1);
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Select aria-label={t('windows.day', { n })} value={String(w.weekday)} onChange={(e) => set(i, { weekday: Number(e.target.value) })} disabled={disabled} className="w-full sm:w-36">
              {days.map((d, k) => <option key={k} value={k}>{d}</option>)}
            </Select>
            <Input aria-label={t('windows.from', { n })} value={w.start} onChange={(e) => set(i, { start: e.target.value })} disabled={disabled} inputMode="text" aria-invalid={invalid} className="tabular w-24 font-mono" />
            <span className="text-fg-tertiary" aria-hidden>–</span>
            <Input aria-label={t('windows.to', { n })} value={w.end} onChange={(e) => set(i, { end: e.target.value })} disabled={disabled} inputMode="text" aria-invalid={invalid} className="tabular w-24 font-mono" />
            <Button type="button" variant="ghost" size="icon" aria-label={t('windows.remove', { n })} disabled={disabled} onClick={() => onChange(value.filter((_, k) => k !== i))}>
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="secondary" size="sm" disabled={disabled || value.length >= 14} onClick={() => onChange([...value, { weekday: 5, start: '12:30', end: '15:30' }])}>
        <Plus className="size-4" aria-hidden />
        {t('windows.add')}
      </Button>
    </div>
  );
}
