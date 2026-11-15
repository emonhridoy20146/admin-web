'use client';
import { Button } from './button';

/** Sticky save bar shown while edits are staged (permissions matrix, settings). Labels come from the caller. */
export function StagedBar({ label, discardLabel, saveLabel, onDiscard, onSave }: { label: string | null; discardLabel: string; saveLabel: string; onDiscard: () => void; onSave: () => void }) {
  if (!label) return null;
  return (
    <div className="sticky bottom-3 z-10 mt-4 flex items-center gap-3 rounded-md border border-line-strong bg-surface-raised px-4 py-3 shadow-e3 animate-pop" role="status">
      <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
      <span className="min-w-0 truncate text-sm font-medium text-fg">{label}</span>
      <Button variant="ghost" size="sm" className="ms-auto" onClick={onDiscard}>{discardLabel}</Button>
      <Button variant="primary" size="sm" onClick={onSave}>{saveLabel}</Button>
    </div>
  );
}
