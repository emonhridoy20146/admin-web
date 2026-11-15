'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, SearchX } from 'lucide-react';
import { useGate } from '@/shared/feature/useGate';
import { customerTabs } from '@/shared/feature/registry';
import { useUrlState } from '@/shared/lib/url-state';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton, useErrorMessage } from '@/shared/ui/feedback';
import { AsOf } from '@/shared/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives';
import { isApiError } from '@/shared/api/problem';
import { useCustomer, useRefreshCustomer } from '../api/customers';
import { ContactAttempts } from '../components/contact-attempts';
import { BadSuggestionCallout, ContactCard, CustomerFigures, CustomerStatusRow, CustomerTitle, NotesList, PendingCallout, PlanCard } from '../components/customer-parts';
import { PaymentsTab } from '../components/payments-tab';
import { TimelineTab } from '../components/timeline-tab';

/** Reads the id client-side: static export serves /customers/view/ for every id (or ?id= fallback) via host rewrite (ADR-W02). */
export function useIdFromPath(prefix: string) {
  const pathname = usePathname();
  const rest = pathname.slice(prefix.length).replace(/^\/+/, '').split('/')[0];
  return rest && rest !== 'view' ? decodeURIComponent(rest) : new URLSearchParams(globalThis.location?.search ?? '').get('id');
}

export function CustomerDetailPage() {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const id = useIdFromPath('/customers');
  const q = useCustomer(id);
  const refresh = useRefreshCustomer(id ?? '');
  const gate = useGate();
  const url = useUrlState();
  const errMsg = useErrorMessage();
  const extTabs = customerTabs(gate);
  const tab = url.get('tab') || 'overview';
  const c = q.data;

  if (q.error && isApiError(q.error) && q.error.status === 404)
    return <EmptyState icon={SearchX} title={t('notFound')} className="mt-16" action={<Link href="/customers/" className="text-primary hover:underline">{tc('actions.back')}</Link>} />;

  return (
    <>
      <Link href="/customers/" className="mb-3 inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        {t('title')}
      </Link>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="mb-4" /> : null}
      {!c ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2.5">
              <CustomerTitle c={c} size="lg" />
              <CustomerStatusRow c={c} />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {c.erpFetchedAt && <AsOf at={c.erpFetchedAt} />}
              <Button
                variant="secondary"
                size="sm"
                loading={refresh.isPending}
                onClick={() => refresh.mutate(undefined, { onSuccess: () => toast.success(t('refreshed')), onError: (e) => toast.error(errMsg(e)) })}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                {t('refresh')}
              </Button>
            </div>
          </header>

          <CustomerFigures c={c} className="mb-4" />
          <div className="mb-5 space-y-3">
            <BadSuggestionCallout c={c} />
            <PendingCallout c={c} />
          </div>

          <Tabs value={tab} onValueChange={(v) => url.set({ tab: v === 'overview' ? null : v })}>
            <TabsList className="mb-5">
              <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
              <TabsTrigger value="payments">{t('tabs.payments')}</TabsTrigger>
              <TabsTrigger value="timeline">{t('tabs.timeline')}</TabsTrigger>
              <TabsTrigger value="notes">{t('tabs.notes')}</TabsTrigger>
              {extTabs.map((x) => (
                <TabsTrigger key={x.id} value={x.id}>{tc(x.title)}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                  {c.plans?.map((p) => <PlanCard key={p.erpPlanId} plan={p} showSchedule />)}
                </div>
                <div className="space-y-4">
                  <Card className="h-fit p-4">
                    <h2 className="mb-3 text-sm font-semibold text-fg-secondary">{t('contact')}</h2>
                    <ContactCard c={c} />
                  </Card>
                  <Card className="h-fit p-4">
                    <h2 className="mb-3 text-sm font-semibold text-fg-secondary">{t('attempts.title')}</h2>
                    <ContactAttempts customerId={c.id!} />
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="payments"><PaymentsTab c={c} /></TabsContent>
            <TabsContent value="timeline"><TimelineTab customerId={c.id!} /></TabsContent>
            <TabsContent value="notes"><div className="max-w-3xl"><NotesList notes={c.recentNotes} /></div></TabsContent>
            {extTabs.map((x) => (
              <TabsContent key={x.id} value={x.id}>
                <x.component customerId={c.id!} customer={c} />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </>
  );
}
