'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatDate, formatNumber } from '../lib/format';
import { todayDhaka } from '../lib/time';
import { useUrlState } from '../lib/url-state';
import {
  daysIn,
  isIsoDay,
  normalizeRange,
  PAST_PRESETS,
  presetRange,
  rangeParams,
  readRange,
  type DayRange,
  type RangeChoice,
  type RangePreset,
  type ResolvedRange,
} from '../lib/date-range';
import { Button } from './button';
import { Input } from './form';
import { Popover, PopoverContent, PopoverTrigger } from './primitives';

/**
 * FR-W-063: the range in the link, read with the page's presets and default. `set` writes the choice and clears the
 * keys in `reset` (the page number, a cursor) in the same URL change.
 */
export function useDateRange(opts: { presets?: readonly RangePreset[]; fallback?: RangePreset; reset?: string[] } = {}) {
  const url = useUrlState();
  const presets = opts.presets ?? PAST_PRESETS;
  const fallback = opts.fallback ?? 'today';
  const today = todayDhaka();
  const range = readRange({ range: url.get('range'), from: url.get('from'), to: url.get('to') }, today, presets, fallback);
  const resetKeys = (opts.reset ?? ['cursor', 'page']).join(',');
  const set = useMemo(
    () => (choice: RangeChoice, r?: DayRange) => {
      const clear = Object.fromEntries(resetKeys.split(',').filter(Boolean).map((k) => [k, null]));
      url.set({ ...rangeParams(choice, r ?? null, fallback), ...clear });
    },
    [url, fallback, resetKeys],
  );
  return { ...range, presets, fallback, today, set };
}

/** A short label for a range: "Today", "17 Nov – 23 Nov", "23 Nov". */
export function rangeLabel(r: DayRange): string {
  if (!r.from) return '';
  if (r.from === r.to) return formatDate(r.from);
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  return `${formatDate(r.from, { withYear: !sameYear })} – ${formatDate(r.to)}`;
}

/**
 * One date filter for every list: a button that names the range ("Last 7 days · 17 Nov – 23 Nov") and opens a panel
 * with the presets and a custom range (two date fields, Apply). Keyboard: the button opens with Enter/Space, Esc
 * closes, Tab walks the presets and fields. On a phone the panel spans the screen width.
 */
export function DateRangeFilter({ value, onChange, className, label }: {
  value: ResolvedRange & { presets: readonly RangePreset[]; today: string };
  onChange: (choice: RangeChoice, r?: DayRange) => void;
  className?: string;
  /** what the range filters, for screen readers ("Promised date") */
  label?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from || value.today);
  const [to, setTo] = useState(value.to || value.today);
  useEffect(() => {
    if (open) {
      setFrom(value.from || value.today);
      setTo(value.to || value.today);
    }
  }, [open, value.from, value.to, value.today]);
  const valid = isIsoDay(from) && isIsoDay(to);
  const draft = valid ? normalizeRange({ from, to }) : null;
  const name = value.choice === 'custom' ? t('range.custom') : t(`range.${value.choice}`);
  const span = rangeLabel(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label ?? t('range.label')}: ${name}${span ? `, ${span}` : ''}`}
          data-testid="date-range"
          className={cn(
            'inline-flex h-9 max-w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm shadow-e1 transition-colors duration-[var(--dur-fast)] hover:bg-surface-hover data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/20 [@media(pointer:coarse)]:h-11 print:border-0 print:p-0 print:shadow-none',
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-primary print:hidden" aria-hidden />
          <span className="font-medium whitespace-nowrap text-fg">{name}</span>
          {span && <span className="tabular truncate text-fg-tertiary">{span}</span>}
          <ChevronDown className="size-4 shrink-0 text-fg-tertiary print:hidden" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(calc(100vw-32px),560px)] p-0" aria-label={label ?? t('range.label')}>
        <div className="grid sm:grid-cols-[200px_minmax(0,1fr)]">
          <ul className="grid grid-cols-2 gap-1 border-b border-line p-2 sm:grid-cols-1 sm:border-e sm:border-b-0" aria-label={t('range.presets')}>
            {value.presets.map((p) => {
              const r = presetRange(p, value.today);
              const on = value.choice === p;
              return (
                <li key={p}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => (onChange(p), setOpen(false))}
                    className={cn(
                      'flex min-h-10 w-full items-center gap-2 rounded-sm px-2.5 text-start text-sm transition-colors duration-[var(--dur-fast)] [@media(pointer:coarse)]:min-h-11',
                      on ? 'bg-primary-subtle font-semibold text-primary-subtle-fg' : 'text-fg hover:bg-surface-hover',
                    )}
                  >
                    <span className="flex-1">
                      <span className="block">{t(`range.${p}`)}</span>
                      {r.from && <span className={cn('tabular block text-xs font-normal', on ? 'text-primary-subtle-fg/80' : 'text-fg-tertiary')}>{rangeLabel(r)}</span>}
                    </span>
                    {on && <Check className="size-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          <form
            className="flex flex-col gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft) return;
              onChange('custom', draft);
              setOpen(false);
            }}
          >
            <div>
              <div className="text-sm font-semibold text-fg">{t('range.custom')}</div>
              <p className="text-xs text-fg-tertiary">{t('range.customHelp')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-fg-secondary">
                {t('range.from')}
                <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="tabular h-10 px-2 text-sm" required />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-fg-secondary">
                {t('range.to')}
                <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="tabular h-10 px-2 text-sm" required />
              </label>
            </div>
            <p className="tabular min-h-5 text-xs text-fg-secondary" aria-live="polite">
              {draft ? t('range.days', { count: daysIn(draft), n: formatNumber(daysIn(draft)), span: rangeLabel(draft) }) : t('range.pickBoth')}
            </p>
            <div className="mt-auto flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('actions.cancel')}</Button>
              <Button size="sm" variant="primary" type="submit" disabled={!draft}>{t('range.apply')}</Button>
            </div>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
