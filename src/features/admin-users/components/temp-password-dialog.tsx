'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Dialog } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';

/** Shows a server-issued temporary password exactly once. It lives only in component state; never stored. */
export function TempPasswordDialog({
  value,
  name,
  onClose,
}: {
  value: string | null;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin-users');
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      open={!!value}
      onOpenChange={(o) => !o && (setCopied(false), onClose())}
      title={t('tempTitle')}
      description={t('tempBody', { name })}
      footer={
        <Button variant="primary" onClick={() => (setCopied(false), onClose())}>
          {t('done')}
        </Button>
      }
    >
      <div className="flex items-center gap-3 rounded-md border border-line bg-surface-subtle p-3">
        <KeyRound className="size-5 shrink-0 text-fg-tertiary" aria-hidden />
        <code
          className="min-w-0 flex-1 truncate font-mono text-xl font-semibold tracking-wider text-fg"
          translate="no"
        >
          {value}
        </code>
        <Button
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(value ?? '').then(() => setCopied(true));
          }}
        >
          {copied ? (
            <Check className="size-4 text-success" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? t('copied') : t('copy')}
        </Button>
      </div>
    </Dialog>
  );
}
