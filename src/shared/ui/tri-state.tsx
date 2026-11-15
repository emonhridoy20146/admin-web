'use client';
import { Check, X } from 'lucide-react';
import { cn } from '../lib/cn';

export type TriValue = 'inherit' | 'on' | 'off';

/** Tri-state radio group: inherit / on / off (permission overrides, per-branch flags). Labels come from the caller. */
export function TriState({ value, onChange, label, labels, disabled, changed }: { value: TriValue; onChange: (v: TriValue) => void; label: string; labels: Record<TriValue, string>; disabled?: boolean; changed?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-sm border bg-surface p-0.5', changed ? 'border-primary ring-2 ring-primary/15' : 'border-line')}>
      {(['inherit', 'on', 'off'] as const).map((v) => {
        const sel = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={sel}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-[3px] px-2 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 [@media(pointer:coarse)]:h-9',
              !sel && 'text-fg-tertiary hover:text-fg',
              sel && v === 'inherit' && 'bg-surface-subtle text-fg',
              sel && v === 'on' && 'bg-success-bg text-success',
              sel && v === 'off' && 'bg-danger-bg text-danger',
            )}
          >
            {v === 'on' && <Check className="size-3.5" aria-hidden />}
            {v === 'off' && <X className="size-3.5" aria-hidden />}
            {labels[v]}
          </button>
        );
      })}
    </div>
  );
}
