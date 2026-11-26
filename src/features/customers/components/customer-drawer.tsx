'use client';
import { useTranslation } from 'react-i18next';
import { Drawer } from '@/shared/ui/overlay';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { AsOf } from '@/shared/ui/page';
import { tagBoxClass } from '@/shared/ui/tag-chip';
import { useCustomer } from '../api/customers';
import { BadSuggestionCallout, ContactCard, CustomerFigures, CustomerStatusRow, CustomerTitle, NotesList, PendingCallout, PlanCard } from './customer-parts';
import { MonthActivity } from './work-marks';
import { sortPlans } from '../model/plan';

/** Row → drawer (FR-W-005). URL `?drawer=customer:<id>` makes it shareable; Esc closes and focus returns. */
export function CustomerDrawer({ id, onClose, footer }: { id: string | null; onClose: () => void; footer?: React.ReactNode }) {
  const { t } = useTranslation('customers');
  const q = useCustomer(id);
  const c = q.data;
  return (
    <Drawer
      open={!!id}
      onOpenChange={(o) => !o && onClose()}
      width={520}
      headerClassName={tagBoxClass(c?.tag) || undefined}
      title={c ? <CustomerTitle c={c} /> : <Skeleton className="h-5 w-48" />}
      headerExtra={c ? <CustomerStatusRow c={c} /> : null}
      footer={footer}
    >
      <div className="space-y-5">
        {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
        {q.isLoading || !c ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <>
            <CustomerFigures c={c} className="sm:grid-cols-2" />
            <MonthActivity c={c} className="[&_dl]:sm:grid-cols-2" />
            {c.erpFetchedAt && <AsOf at={c.erpFetchedAt} />}
            <BadSuggestionCallout c={c} />
            <PendingCallout c={c} />
            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{t('contact')}</h3>
              <ContactCard c={c} />
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-fg-secondary">{t('plans')}</h3>
              {sortPlans(c.plans ?? []).map((p) => <PlanCard key={p.erpPlanId} plan={p} />)}
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{t('tabs.notes')}</h3>
              <NotesList notes={c.recentNotes} limit={3} />
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}
