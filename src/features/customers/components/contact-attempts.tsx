'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Phone, PhoneMissed, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatDuration, formatNumber, formatRelative } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { useContactAttempts, type ContactAttempt } from '../api/customers';

const FAILED = new Set(['no_answer', 'busy', 'switched_off', 'wrong_number']);
const PREVIEW = 5;

function iconOf(a: ContactAttempt): LucideIcon {
  if (a.channel !== 'call') return MessageSquare;
  return a.outcome && FAILED.has(a.outcome) ? PhoneMissed : Phone;
}

/** FR-M-014: calls and messages staff logged for this customer. Shows the phone slot, never the number; a call to the guarantor (1.12.0) has no slot. */
export function ContactAttempts({ customerId }: { customerId: string }) {
  const { t } = useTranslation('customers');
  const q = useContactAttempts(customerId);
  const [all, setAll] = useState(false);
  if (q.isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>;
  if (q.error) return <ErrorBanner error={q.error} onRetry={() => q.refetch()} />;
  const list = [...(q.data ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1));
  if (!list.length) return <p className="text-sm text-fg-tertiary">{t('attempts.empty')}</p>;
  const shown = all ? list : list.slice(0, PREVIEW);
  return (
    <div>
      <ul className="space-y-2.5">
        {shown.map((a) => {
          const Icon = iconOf(a);
          const failed = !!a.outcome && FAILED.has(a.outcome);
          return (
            <li key={a.id ?? a.clientId} className="flex gap-3">
              <Icon className={cn('mt-0.5 size-4 shrink-0', failed ? 'text-warning' : 'text-fg-tertiary')} aria-hidden />
              <div className="min-w-0 text-sm">
                <p className="text-fg">
                  {a.target === 'guarantor' ? t('attempts.guarantorCall') : t(`attempts.channel.${a.channel}`)}
                  {a.outcome && <span className={cn('ms-1.5', failed ? 'text-warning' : 'text-fg-secondary')}>· {t(`attempts.outcome.${a.outcome}`)}</span>}
                  {a.channel === 'call' && !!a.durationSec && <span className="tabular ms-1.5 text-fg-secondary">· {formatDuration(Math.max(1, Math.round(a.durationSec / 60)))}</span>}
                </p>
                <p className="text-xs text-fg-tertiary">
                  {formatRelative(a.at)}
                  {a.phoneIndex != null && ` · ${t('attempts.phoneN', { n: formatNumber(a.phoneIndex + 1) })}`}
                </p>
                {a.note && <p className="mt-0.5 text-xs text-fg-secondary" lang={/[\u0980-\u09ff]/.test(a.note) ? 'bn' : 'en'}>{a.note}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {list.length > PREVIEW && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll((x) => !x)} aria-expanded={all}>
          {all ? t('attempts.less') : t('attempts.more', { n: formatNumber(list.length) })}
        </Button>
      )}
    </div>
  );
}
