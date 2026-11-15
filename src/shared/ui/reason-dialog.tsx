'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { Field, Select, Textarea } from './form';
import { Dialog } from './overlay';
import { ErrorBanner } from './feedback';
import { formatNumber } from '../lib/format';

export interface ReasonValue {
  reasonCode: string;
  reason: string;
  idempotencyKey: string;
}

/**
 * Shared ReasonDialog (FR-W-008): reason code + text (min length, counter), optional diff/summary slot.
 * One idempotency key per dialog opening, reused on retry/double submit (W-E5).
 */
export function ReasonDialog({
  open, onOpenChange, title, description, codes, minLength = 10, confirmLabel, destructive, children, onSubmit,
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
        {codes && codes.length > 0 && (
          <Field label={t('reason.code')} required>
            {(id) => (
              <Select id={id} value={code} onChange={(e) => setCode(e.target.value)}>
                {codes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
          </Field>
        )}
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
