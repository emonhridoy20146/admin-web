'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { Card, CardHeader } from '@/shared/ui/card';
import { MoneyText } from '@/shared/ui/money';
import { Badge, StatusBadge } from '@/shared/ui/badge';
import { EmptyState } from '@/shared/ui/feedback';
import type { CustomerDetail } from '../api/customers';

/**
 * Payments: ERP-posted and field-pending are shown apart, never summed (03 §1.4). A payment to an invoice returned in
 * the ERP (`returned`, contract 1.53.0) is listed with a "Returned invoice" tag; it counts nowhere (FR-W-073).
 */
export function PaymentsTab({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const pending = c.pendingCollections ?? [];
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-st-pending/30">
        <CardHeader title={t('payments.field')} subtitle={<MoneyText poisha={c.pendingFieldPoisha ?? 0} pending />} />
        {pending.length === 0 ? (
          <p className="px-4 py-4 text-sm text-fg-tertiary">{t('payments.noPending')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/collections/?drawer=collection:${p.id}`} className="font-mono text-sm text-fg hover:text-primary">{p.receiptNo}</Link>
                  <div className="text-xs text-fg-tertiary">{formatDateTime(p.recordedAt!)} · {p.collector?.name} · {tc(`method.${p.method}`)}</div>
                </div>
                <StatusBadge status={p.status!} />
                <MoneyText poisha={p.amountPoisha ?? 0} pending className="w-28 text-end font-medium" />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title={t('payments.erp')} />
        {!c.payments?.length ? (
          <EmptyState icon={Receipt} title={t('payments.none')} className="py-8" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-xs text-fg-secondary">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start font-semibold">{t('dueDate')}</th>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">{t('payments.receipt')}</th>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">{t('payments.method')}</th>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">{t('payments.source')}</th>
                  <th scope="col" className="px-4 py-2 text-end font-semibold">{t('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {c.payments.map((p) => (
                  <tr key={p.erpPaymentId} className="border-t border-line" data-returned={p.returned ? 'true' : undefined}>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(p.date!)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.receiptNo}</td>
                    <td className="px-3 py-2">
                      {tc(`method.${p.method}`, { defaultValue: p.method })}
                      {p.methodLabel && <span className="block text-xs text-fg-tertiary">{p.methodLabel}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={p.source === 'field' ? 'brand' : 'neutral'} icon={false}>{p.source === 'field' ? t('payments.fieldSource') : t('payments.office')}</Badge>
                      {p.advance && <Badge tone="info" icon={false} className="ms-1">{t('payments.advance')}</Badge>}
                      {p.reversed && <Badge tone="danger" className="ms-1">{t('payments.reversed')}</Badge>}
                      {p.returned && <StatusBadge status="returned_payment" className="ms-1" testId="returned-payment-tag" />}
                      {p.collectorName && <span className="mt-0.5 block text-xs text-fg-tertiary">{t('payments.collector', { name: p.collectorName })}</span>}
                      {p.referrerName && p.referrerName !== p.collectorName && <span className="mt-0.5 block text-xs text-fg-tertiary">{t('payments.referrer', { name: p.referrerName })}</span>}
                    </td>
                    <td className="px-4 py-2 text-end">
                      <MoneyText poisha={p.amountPoisha ?? 0} className={p.reversed ? 'font-medium text-fg-tertiary line-through' : p.returned ? 'font-medium text-fg-secondary' : 'font-medium'} />
                      {(p.discountPoisha ?? 0) > 0 && <span className="block text-xs whitespace-nowrap text-fg-tertiary">{t('payments.discount', { amount: formatMoney(p.discountPoisha ?? 0) })}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
