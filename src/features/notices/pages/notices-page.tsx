'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, CheckCheck, Clock, MailWarning, Megaphone, Plus } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useCan } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, formatNumber, formatPercent, formatRelative, pickText } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { cn } from '@/shared/lib/cn';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Drawer } from '@/shared/ui/overlay';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Segmented } from '@/shared/ui/primitives';
import { useNotices, useRecipients, type Notice } from '../api/notices';
import { readShare, sortRecipients, waiting } from '../model/notices';
import { ComposeDialog } from '../components/compose-dialog';

/** How many of the recipients read it: number, share and a bar (the bar is never the only signal). */
function ReadCount({ n }: { n: Notice }) {
  const { t } = useTranslation('notices');
  const share = readShare(n);
  return (
    <span className="inline-flex min-w-0 flex-col gap-1">
      <span className="tabular whitespace-nowrap text-sm">
        {t('readOf', { read: formatNumber(n.ackCount ?? 0), total: formatNumber(n.recipientCount ?? 0) })}
        <span className="ms-1.5 text-fg-secondary">· {formatPercent(share)}</span>
      </span>
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
        <span className={cn('block h-full rounded-full', share >= 1 ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.round(share * 100)}%` }} />
      </span>
    </span>
  );
}

function MustReadBadge({ n }: { n: Notice }) {
  const { t } = useTranslation('notices');
  if (!n.requireAck) return <Badge tone="neutral" icon={Megaphone}>{t('info')}</Badge>;
  const left = waiting(n);
  return left > 0 ? <Badge tone="warning" icon={MailWarning}>{t('mustRead')}</Badge> : <Badge tone="success" icon={CheckCheck}>{t('allRead')}</Badge>;
}

/** FR-NOT-005 / FR-W: notices sent to staff phones, how many read them, and who has not. */
export function NoticesPage() {
  const { t } = useTranslation('notices');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const canSend = useCan('notification.broadcast');
  const branches = useBranches();
  const url = useUrlState();
  const cursor = url.get('cursor');
  const [limit, setLimit] = useState(25);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const q = useNotices(cursor || undefined, limit);
  const [composing, setComposing] = useState(false);
  const openId = url.get('drawer');
  const open = q.data?.items.find((n) => n.id === openId) ?? null;
  const branchName = (id: string) => pickText(branches.data?.find((b) => b.id === id)?.name, locale) || id;
  const audience = (n: Notice) =>
    `${(n.roles ?? []).map((r) => tc(`role.${r}`)).join(', ')} · ${n.branchIds?.length ? n.branchIds.map(branchName).join(', ') : t('allBranches')}`;

  const columns: Column<Notice>[] = [
    {
      id: 'title',
      header: t('col.title'),
      priority: 1,
      mobile: 'title',
      cell: (n) => (
        <button type="button" onClick={() => url.set({ drawer: n.id }, { push: true })} className="block max-w-[340px] text-start">
          <span className="block truncate font-medium text-fg hover:text-primary" lang={locale}>{pickText(n.title, locale)}</span>
          <span className="block truncate text-xs text-fg-tertiary" lang={locale}>{pickText(n.body, locale)}</span>
        </button>
      ),
    },
    { id: 'kind', header: t('col.kind'), priority: 1, mobile: 'badges', cell: (n) => <MustReadBadge n={n} /> },
    { id: 'read', header: t('col.read'), priority: 1, mobile: 'meta', cell: (n) => <ReadCount n={n} /> },
    { id: 'to', header: t('col.to'), priority: 3, cell: (n) => <span className="block max-w-[240px] truncate text-fg-secondary">{audience(n)}</span> },
    { id: 'by', header: t('col.by'), priority: 4, cell: (n) => <span className="whitespace-nowrap">{n.createdBy?.name}</span> },
    { id: 'at', header: t('col.at'), priority: 2, mobile: 'subtitle', cell: (n) => <span className="whitespace-nowrap text-fg-secondary" title={formatDateTime(n.createdAt!)}>{formatRelative(n.createdAt!)}</span> },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          canSend ? (
            <Button variant="primary" onClick={() => setComposing(true)}>
              <Plus className="size-4" aria-hidden />
              {t('new')}
            </Button>
          ) : undefined
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      <DataTable
        tableId="notices"
        caption={t('title')}
        columns={columns}
        rows={q.data?.items}
        rowKey={(n) => n.id!}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={(n) => url.set({ drawer: n.id }, { push: true })}
        activeRowKey={openId || undefined}
        empty={t('empty')}
        pager={{ page: pager.page, hasPrev: pager.hasPrev, hasNext: !!q.data?.nextCursor, onPrev: pager.prev, onNext: () => pager.next(q.data?.nextCursor), pageSize: limit, onPageSize: (n) => (pager.reset(), setLimit(n)) }}
      />

      <NoticeDrawer n={open} audience={open ? audience(open) : ''} onClose={() => url.set({ drawer: null })} />
      {canSend && <ComposeDialog open={composing} onOpenChange={setComposing} onSent={(n) => (pager.reset(), url.set({ cursor: null, drawer: n.id }, { push: true }))} />}
    </>
  );
}

const SHOW = ['unread', 'read', 'all'] as const;

function NoticeDrawer({ n, audience, onClose }: { n: Notice | null; audience: string; onClose: () => void }) {
  const { t } = useTranslation('notices');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const url = useUrlState();
  const show = oneOf(url.get('show'), SHOW, 'unread');
  const r = useRecipients(n?.id ?? null);
  const items = useMemo(() => sortRecipients(r.data?.items ?? [], locale), [r.data, locale]);
  const unread = items.filter((x) => !x.acked);
  const shown = show === 'all' ? items : show === 'read' ? items.filter((x) => x.acked) : unread;
  const other = locale === 'bn' ? 'en' : 'bn';
  const otherTitle = n?.title?.[other];
  const otherBody = n?.body?.[other];

  return (
    <Drawer
      open={!!n}
      onOpenChange={(o) => !o && (url.set({ show: null }), onClose())}
      title={n ? <span lang={locale}>{pickText(n.title, locale)}</span> : ''}
      subtitle={n ? <span>{t('sentBy', { name: n.createdBy?.name ?? '', at: formatDateTime(n.createdAt!) })}</span> : undefined}
      width={560}
    >
      {n && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <MustReadBadge n={n} />
            <span className="text-sm text-fg-secondary">{audience}</span>
          </div>
          <section className="space-y-2 rounded-md border border-line bg-surface p-3">
            <p className="whitespace-pre-line text-base text-fg" lang={locale}>{pickText(n.body, locale)}</p>
            {otherBody && otherBody !== pickText(n.body, locale) && (
              <div className="border-t border-line pt-2" lang={other}>
                {otherTitle && otherTitle !== pickText(n.title, locale) && <p className="text-sm font-medium text-fg-secondary">{otherTitle}</p>}
                <p className="whitespace-pre-line text-sm text-fg-secondary">{otherBody}</p>
              </div>
            )}
          </section>
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-fg">{t('recipients.title')}</h3>
              <ReadCount n={r.data ? { ...n, recipientCount: r.data.recipientCount, ackCount: r.data.ackCount } : n} />
            </div>
            <Segmented
              className="mb-3"
              label={t('recipients.show')}
              value={show}
              onChange={(v) => url.set({ show: v === 'unread' ? null : v })}
              options={SHOW.map((s) => ({ value: s, label: t(`recipients.${s}`), count: s === 'unread' ? unread.length : s === 'read' ? items.length - unread.length : undefined }))}
            />
            {r.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : r.error ? (
              <ErrorBanner error={r.error} onRetry={() => r.refetch()} />
            ) : shown.length === 0 ? (
              <p className="text-sm text-fg-tertiary">{show === 'unread' ? t('recipients.noneUnread') : t('recipients.none')}</p>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {shown.map((x) => (
                  <li key={x.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg" lang={locale}>{pickText(x.name, locale)}</span>
                      <span className="block text-xs text-fg-tertiary">
                        <span className="font-mono">{x.employeeCode}</span> · {x.role ? tc(`role.${x.role}`) : ''}
                      </span>
                    </span>
                    {x.acked ? (
                      <Badge tone="success" icon={CheckCheck}>{x.ackedAt ? t('recipients.readAt', { at: formatDateTime(x.ackedAt) }) : t('recipients.readNoTime')}</Badge>
                    ) : (
                      <Badge tone={n.requireAck ? 'warning' : 'neutral'} icon={n.requireAck ? BellRing : Clock}>{t('recipients.notRead')}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
