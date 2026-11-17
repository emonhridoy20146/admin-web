'use client';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from './button';

/**
 * FR-REP-003 / OD-26: reports become PDFs through the browser's print dialog ("Save as PDF"). The browser shapes Bangla
 * conjuncts and embeds the self-hosted Noto Sans Bengali, which a server-side PDF library would not do correctly.
 * `name` becomes the suggested file name while the dialog is open.
 */
export function printPage(name?: string) {
  const prev = document.title;
  if (name) document.title = name;
  const restore = () => {
    document.title = prev;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

export function PrintButton({ name, className }: { name?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" size="sm" onClick={() => printPage(name)} className={cn('print:hidden', className)} title={t('print.help')}>
      <Printer className="size-4" aria-hidden />
      {t('print.button')}
    </Button>
  );
}

/** Shown on paper only: what the screen says with controls (period, date, filters) that are hidden in print. */
export function PrintOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('hidden text-sm text-fg-secondary print:block', className)}>{children}</div>;
}
