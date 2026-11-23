'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCan } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { pickText } from '@/shared/lib/format';
import type { components } from '@/shared/api/schema';
import { chainsOf } from '../model/promise';
import { CreatePromiseDialog, type FollowUpOf } from './create-promise-dialog';
import { NoPromises, PromiseChain } from './promise-chain';

type Customer = components['schemas']['CustomerDetail'];

/**
 * FR-PRM-006 (1.45.0): the customer's promises as chains (original → broken → follow-up → …), newest chain first,
 * from `recentPromises` (last 20). Office users with promise.create can make the follow-up of a broken promise here.
 * A customer-detail tab contributed through the manifest, so the customers feature is not edited.
 */
export function CustomerPromisesTab({ customerId, customer }: { customerId: string; customer: Customer }) {
  const { t } = useTranslation('promises');
  const locale = useUi((s) => s.locale);
  const canCreate = useCan('promise.create');
  const [follow, setFollow] = useState<FollowUpOf | null>(null);
  const all = customer.recentPromises ?? [];
  const chains = chainsOf(all.map((p) => ({ ...p, id: p.id ?? undefined })));
  const name = pickText(customer.name, locale);
  return (
    <div className="space-y-5" data-testid="customer-promises">
      {chains.length === 0 ? (
        <NoPromises />
      ) : (
        chains.map((c) => (
          <section key={c[0]!.id} className="rounded-md border border-line bg-surface-subtle/50 p-3">
            <h3 className="mb-2 text-xs font-semibold text-fg-secondary">{c.length > 1 ? t('chain.titleN', { n: c.length }) : t('chain.single')}</h3>
            <PromiseChain
              chain={c}
              hrefOf={(p) => `/promises/?drawer=${p.id}&range=all`}
              onFollowUp={
                canCreate
                  ? (p) =>
                      setFollow({ id: p.id!, customerId, customerName: name, promisedDate: p.promisedDate, promisedAmountPoisha: p.promisedAmountPoisha, paidTowardsPoisha: p.paidTowardsPoisha, attempt: p.attempt, erpPlanId: (p as { erpPlanId?: string }).erpPlanId })
                  : undefined
              }
            />
          </section>
        ))
      )}
      <CreatePromiseDialog open={!!follow} onOpenChange={(o) => !o && setFollow(null)} followUp={follow} />
    </div>
  );
}
