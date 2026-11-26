'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { Button } from './button';
import { Field, Select, Textarea } from './form';
import { Dialog } from './overlay';
import { ErrorBanner } from './feedback';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/cn';

export interface ReasonValue {
  reasonCode: string;
  reason: string;
  idempotencyKey: string;
}

/**
 * Shared ReasonDialog (FR-W-008): reason code + text (min length, counter), optional diff/summary slot.
 * One idempotency key per dialog opening, reused on retry/double submit (W-E5).
 */
export interface CodeLook {
  /** classes that set the option's colour (e.g. `fos-tag fos-tag--absconded`) */
  className: string;
  /** shown in the swatch, in the option's colour on its tint */
  icon?: LucideIcon;
}

export function ReasonDialog({
  open, onOpenChange, title, description, codes, minLength = 10, confirmLabel, destructive, children, onSubmit, codeLook, afterCodes,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** [value, label] pairs; omit for free text only */
  codes?: [string, string][];
  minLength?: number;
  confirmLabel: string;
  destructive?: boolean;
  children?: React.ReactNode;
  onSubmit: (v: ReasonValue) => Promise<unknown>;
  /**
   * With a look per code the codes are shown as a radio list, each option with its colour (border + swatch), so users
   * learn the colours they will see in the lists (FR-W-072 tag dialog).
   */
  codeLook?: (code: string) => CodeLook;
  /** shown under the codes, given the picked code (e.g. a preview of the result) */
  afterCodes?: (code: string) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const key = useRef<string>('');

  const firstCode = codes?.[0]?.[0] ?? '';
  // Reset only when the dialog opens. Callers often pass `codes` inline, so it must not be a dependency
  // (a new array each render would wipe what the user is typing).
  useEffect(() => {
    if (open) {
      key.current = crypto.randomUUID();
      setCode(firstCode);
      setText('');
      setError(null);
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tooShort = text.trim().length < minLength;
  const submit = async () => {
    setTouched(true);
    if (tooShort || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ reasonCode: code, reason: text.trim(), idempotencyKey: key.current });
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>{t('actions.cancel')}</Button>
          <Button variant={destructive ? 'destructive' : 'primary'} onClick={submit} loading={busy}>{confirmLabel}</Button>
        </>
      }
    >
      <form
        className="space-y-4 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {children}
        {codes && codes.length > 0 && codeLook && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-fg">
              {t('reason.code')}
              <span className="text-danger" aria-hidden> *</span>
            </legend>
            <div role="radiogroup" aria-label={t('reason.code')} className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="reason-options">
              {codes.map(([v, l]) => {
                const look = codeLook(v);
                const on = code === v;
                return (
                  <label
                    key={v}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-fg fos-tag-box',
                      look.className,
                      on ? 'fos-tag-picked font-medium' : 'bg-surface',
                    )}
                    data-code={v}
                  >
                    <input type="radio" name="reason-code" value={v} checked={on} onChange={() => setCode(v)} className="size-4 shrink-0 accent-[var(--tag-c)]" />
                    <span className="fos-tag-swatch grid size-7 shrink-0 place-items-center rounded-sm" aria-hidden data-testid="reason-swatch">
                      {look.icon && <look.icon className="size-4" strokeWidth={2.25} />}
                    </span>
                    <span className="min-w-0 flex-1">{l}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {codes && codes.length > 0 && !codeLook && (
          <Field label={t('reason.code')} required>
            {(id) => (
              <Select id={id} value={code} onChange={(e) => setCode(e.target.value)}>
                {codes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
          </Field>
        )}
        {afterCodes?.(code)}
        <Field
          label={t('reason.text')}
          required
          counter={`${formatNumber(text.trim().length)} / ${formatNumber(minLength)}+`}
          error={touched && tooShort ? t('reason.tooShort', { n: formatNumber(minLength) }) : undefined}
          help={t('reason.help')}
        >
          {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={touched && tooShort} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('reason.placeholder')} autoFocus />}
        </Field>
        {error ? <ErrorBanner error={error} /> : null}
      </form>
    </Dialog>
  );
}
