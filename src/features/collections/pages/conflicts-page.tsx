'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { formatDateTime, formatDuration, formatMoney, pickText } from '@/shared/lib/format';
import { minutesSince } from '@/shared/lib/time';
import { PageHeader, DescList } from '@/shared/ui/page';
import { Card } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge, StatusBadge } from '@/shared/ui/badge';
import { Field, Select } from '@/shared/ui/form';
import { MoneyText } from '@/shared/ui/money';
import { Button } from '@/shared/ui/button';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import {
  useConflicts,
  useCustomerForConflict,
  useResolve,
  type Collection,
  type ResolveBody,
} from '../api/collections';
import { ProofPicker } from '../components/proof-picker';

const ACTIONS = ['post_to_plan', 'post_as_advance', 'retry_post', 'refund', 'void'] as const;
type Action = (typeof ACTIONS)[number];

export function ConflictsPage() {
  const { t } = useTranslation('collections');
  useUi((s) => s.bnDigits);
  useUi((s) => s.locale);
  const q = useConflicts();
  const items = q.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t('conflicts')}
        crumbs={[{ label: t('title'), href: '/collections/' }, { label: t('conflicts') }]}
      >
        <span>{t('conflictsSubtitle')}</span>
      </PageHeader>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 && !q.error ? (
        <Card>
          <EmptyState icon={CheckCircle2} title={t('noConflicts')} body={t('noConflictsBody')} />
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((c) => (
            <ConflictCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}

function ConflictCard({ c }: { c: Collection }) {
  const { t } = useTranslation('collections');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const canResolve = useCan('collection.resolve');
  const customer = useCustomerForConflict(c.customer?.id);
  const resolve = useResolve();
  const [action, setAction] = useState<Action>('post_to_plan');
  const plans = (customer.data?.plans ?? []).filter((p) => p.status === 'active' || p.status === 'defaulted');
  const [planId, setPlanId] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [proofId, setProofId] = useState<string | null>(null);
  const chosenPlan = planId || c.erpPlanId || plans[0]?.erpPlanId || '';
  const name = pickText(c.customer?.name, locale);
  const amount = formatMoney(c.amountPoisha ?? 0);
  const waited = c.conflict?.raisedAt ? minutesSince(c.conflict.raisedAt) : null;

  const submit = async ({ reason, idempotencyKey }: { reason: string; idempotencyKey: string }) => {
    const body: ResolveBody = {
      action,
      reason,
      ...(action === 'post_to_plan' ? { erpPlanId: chosenPlan } : {}),
      ...(action === 'refund' && proofId ? { proofMediaId: proofId } : {}),
    };
    await resolve.mutateAsync({ id: c.id!, key: idempotencyKey, body });
    toast.success(t('resolved'));
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start gap-3 border-b border-line px-5 py-4">
        <span
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-st-overdue-bg text-st-overdue"
          aria-hidden
        >
          <AlertTriangle className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link
              href={`/customers/${c.customer?.id}/`}
              className="truncate text-md font-semibold text-fg hover:text-primary"
              lang={locale}
            >
              {name}
            </Link>
            <span className="font-mono text-xs text-fg-tertiary">{c.customer?.code}</span>
          </div>
          <p className="mt-1 text-sm text-st-overdue">
            {pickText(c.conflict?.message, locale)}{' '}
            <span className="font-mono text-xs text-fg-tertiary">· {c.conflict?.code}</span>
          </p>
        </div>
        <div className="text-end">
          <MoneyText poisha={c.amountPoisha} className="text-xl font-semibold" />
          <div className="mt-1 flex justify-end gap-1.5">
            <StatusBadge status={c.status ?? 'conflict'} />
            {waited != null && (
              <Badge tone={waited > 24 * 60 ? 'danger' : 'warning'} icon={false}>
                {t('age', { t: formatDuration(waited) })}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-line md:grid-cols-2 xl:grid-cols-[1.25fr_1fr_0.75fr]">
        <section className="bg-surface px-5 py-4" aria-label={t('fieldRecord')}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            {t('fieldRecord')}
          </h3>
          <DescList
            items={[
              { label: t('col.receipt'), value: <span className="font-mono">{c.receiptNo}</span> },
              { label: t('col.method'), value: tc(`method.${c.method}`) },
              ...(c.transactionRef
                ? [{ label: t('detail.txn'), value: <span className="font-mono">{c.transactionRef}</span> }]
                : []),
              { label: t('col.collector'), value: c.collector?.name ?? '—' },
              { label: t('detail.recorded'), value: c.recordedAt ? formatDateTime(c.recordedAt) : '—' },
              { label: t('detail.plan'), value: <span className="font-mono">{c.erpPlanId ?? '—'}</span> },
            ]}
          />
        </section>
        <section className="bg-surface px-5 py-4" aria-label={t('customerNow')}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            {t('customerNow')}
          </h3>
          {customer.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : customer.error ? (
            <ErrorBanner error={customer.error} onRetry={() => customer.refetch()} />
          ) : (
            <>
              <div className="mb-3 text-sm text-fg-secondary">
                {t('outstandingNow')}
                <MoneyText
                  poisha={customer.data?.totalOutstandingPoisha}
                  className="ms-2 font-semibold text-fg"
                />
              </div>
              <ul className="space-y-1.5">
                {(customer.data?.plans ?? []).map((p) => (
                  <li
                    key={p.erpPlanId}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5 text-sm',
                      p.erpPlanId === c.erpPlanId ? 'border-primary/50 bg-primary-subtle' : 'border-line',
                    )}
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs">{p.erpPlanId}</span>{' '}
                      <span className="text-fg-secondary">{p.product}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <MoneyText poisha={p.outstandingPoisha} className="text-sm" />
                      <StatusBadge status={p.status ?? 'active'} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section
          className="bg-surface px-5 py-4 md:col-span-2 xl:col-span-1"
          aria-label={t('cashWithCollector')}
        >
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            {t('cashWithCollector')}
          </h3>
          {c.cashOnHand ? (
            <>
              <MoneyText poisha={c.cashOnHand.onHandPoisha} className="text-lg font-semibold" />
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className={cn(
                    'h-full rounded-full',
                    c.cashOnHand.state === 'exceeded'
                      ? 'bg-st-overdue'
                      : c.cashOnHand.state === 'warning'
                        ? 'bg-warning'
                        : 'bg-success',
                  )}
                  style={{
                    width: `${Math.min(100, ((c.cashOnHand.onHandPoisha ?? 0) / Math.max(1, c.cashOnHand.limitPoisha ?? 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-fg-tertiary">{formatMoney(c.cashOnHand.limitPoisha ?? 0)}</p>
            </>
          ) : (
            <span className="text-sm text-fg-tertiary">—</span>
          )}
        </section>
      </div>

      {canResolve && (
        <div className="flex flex-col gap-3 border-t border-line bg-surface-subtle px-5 py-4 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <Field label={t('action')} help={t(`actionHelp.${action}`)}>
              {(id, d) => (
                <Select
                  id={id}
                  aria-describedby={d}
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value as Action);
                    setProofId(null);
                  }}
                >
                  {ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {t(`actions.${a}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {action === 'post_to_plan' && (
              <Field label={t('targetPlan')}>
                {(id) => (
                  <Select
                    id={id}
                    value={chosenPlan}
                    onChange={(e) => setPlanId(e.target.value)}
                    disabled={!plans.length}
                  >
                    {plans.map((p) => (
                      <option
                        key={p.erpPlanId}
                        value={p.erpPlanId}
                      >{`${p.erpPlanId} · ${p.product ?? ''} · ${formatMoney(p.outstandingPoisha ?? 0)}`}</option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {action === 'refund' && (
              <div className="sm:col-span-2">
                <ProofPicker onChange={setProofId} />
              </div>
            )}
          </div>
          <Button
            onClick={() => setOpen(true)}
            disabled={(action === 'post_to_plan' && !chosenPlan) || (action === 'refund' && !proofId)}
            className="lg:mb-6"
          >
            {t('resolve')}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      )}

      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={t('resolveTitle', { amount, name })}
        description={
          <span className="flex items-start gap-2 text-warning">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('rule')}
          </span>
        }
        confirmLabel={t('resolveConfirm', { amount })}
        destructive={action === 'void' || action === 'refund'}
        minLength={5}
        onSubmit={submit}
      >
        <DescList
          items={[
            { label: t('action'), value: t(`actions.${action}`) },
            ...(action === 'post_to_plan'
              ? [{ label: t('targetPlan'), value: <span className="font-mono">{chosenPlan}</span> }]
              : []),
            ...(action === 'refund' ? [{ label: t('proof.label'), value: t('proof.attached') }] : []),
            {
              label: t('col.amount'),
              value: <MoneyText poisha={c.amountPoisha} className="font-semibold" />,
            },
          ]}
        />
      </ReasonDialog>
    </Card>
  );
}
