'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/auth/session';
import { applyTheme, useUi } from '@/shared/lib/ui-store';
import { formatDateTime, pickText } from '@/shared/lib/format';
import { BrandMark } from '@/features/auth';
import { useBranches } from '../api/queries';

/**
 * Paper header for every printed page (FR-REP-003): organisation, branch in view, when and by whom it was printed.
 * Printing always uses the light theme, whatever the screen shows, and the time is taken when the dialog opens.
 */
export function PrintMasthead() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const locale = useUi((s) => s.locale);
  const theme = useUi((s) => s.theme);
  const branchId = useUi((s) => s.branchId);
  const { data: branches } = useBranches();
  const [at, setAt] = useState(() => new Date());

  useEffect(() => {
    const before = () => {
      setAt(new Date());
      document.documentElement.dataset.theme = 'light';
    };
    const after = () => applyTheme(theme);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [theme]);

  const current = branches?.find((b) => b.id === branchId);
  return (
    <div className="mb-4 hidden items-end justify-between gap-4 border-b border-line-strong pb-3 print:flex" data-testid="print-masthead">
      <div className="flex items-center gap-2.5">
        <BrandMark className="size-7" />
        <span className="leading-tight">
          <span className="block text-base font-semibold text-fg">{t('appName')}</span>
          <span className="block text-xs text-fg-tertiary">{t('appTagline')}</span>
        </span>
      </div>
      <div className="text-end text-xs text-fg-secondary">
        <p>{t('print.branch', { name: current ? pickText(current.name, locale) : t('allBranches') })}</p>
        <p className="tabular">{t('print.printedAt', { time: formatDateTime(at) })}</p>
        {user ? <p>{t('print.printedBy', { name: pickText(user.name, locale) })}</p> : null}
      </div>
    </div>
  );
}
