'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { ErrorBanner } from './feedback';
import { Field, Input } from './form';
import { Dialog } from './overlay';

/**
 * Destructive confirmation with a type-to-confirm box (owner request 2026-11-18): the action button stays disabled
 * until the user has typed the confirm word (not case-sensitive, spaces around it ignored). `children` names what is
 * deleted (customer, coordinates). The word is a plain Latin word so it can be typed on any keyboard. With `exact` the
 * text must match character for character (the server checks it again, e.g. `DELETE 2026-11` for the photo purge).
 */
export function ConfirmTypeDialog({
  open, onOpenChange, title, description, word, confirmLabel, children, onConfirm, exact,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** What the user must type, e.g. `DELETE`. */
  word: string;
  confirmLabel: string;
  children?: React.ReactNode;
  /** receives what was typed, e.g. to send it to the server as the confirmation */
  onConfirm: (typed: string) => Promise<unknown>;
  /** case and spaces must match exactly */
  exact?: boolean;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setTyped('');
      setError(null);
    }
  }, [open]);

  const matches = exact ? typed === word : typed.trim().toLowerCase() === word.toLowerCase();
  const submit = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(typed);
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
          <Button variant="destructive" onClick={submit} loading={busy} disabled={!matches}>{confirmLabel}</Button>
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
        <Field label={t('confirmType.label', { word })} help={t(exact ? 'confirmType.helpExact' : 'confirmType.help')}>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              lang="en"
              dir="ltr"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={word}
              className="font-mono"
              autoFocus
            />
          )}
        </Field>
        {error ? <ErrorBanner error={error} /> : null}
      </form>
    </Dialog>
  );
}
