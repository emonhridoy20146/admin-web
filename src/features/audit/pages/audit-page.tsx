'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, ScrollText, X } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, formatRelative, pickText } from '@/shared/lib/format';
import { dhakaDayStartIso } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader, DescList } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Avatar, Segmented, Tooltip } from '@/shared/ui/primitives';
import { Select } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { Drawer } from '@/shared/ui/overlay';
import { useAudit, type AuditEntry } from '../api/audit';
import { diffRows, show } from '../model/diff';

const RANGES = ['today', '7d', '30d', 'all'] as const;
const RANGE_DAYS: Record<(typeof RANGES)[number], number | null> = { today: 0, '7d': 6, '30d': 29, all: null };
const GROUPS = ['user', 'rbac', 'settings', 'flag', 'collection', 'deposit', 'tag', 'handover', 'auth', 'location'] as const;
const ENTITIES = ['user', 'branch', 'settings', 'feature_flag', 'collection', 'deposit', 'customer', 'handover', 'session'] as const;

export function AuditPage() {
  const { t } = useTranslation('audit');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const range = oneOf(url.get('range'), RANGES, '7d');
  const action = oneOf(url.get('action'), ['', ...GROUPS] as const, '');
  const entity = oneOf(url.get('entity'), ['', ...ENTITIES] as const, '');
  const entityId = url.get('entityId');
  const cursor = url.get('cursor');
  const [limit, setLimit] = useState(25);
  const from = useMemo(() => (RANGE_DAYS[range] == null ? undefined : dhakaDayStartIso(RANGE_DAYS[range]!)), [range]);
  const q = useAudit({ from, action: action || undefined, entity: entity || undefined, entityId: entityId || undefined, cursor: cursor || undefined, limit });
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const drawer = url.get('drawer');
  const drawerId = drawer.startsWith('audit:') ? drawer.slice(6) : null;
  const selected = q.data?.items?.find((a) => a.id === drawerId) ?? null;
  const reset = (patch: Record<string, string | null>) => (pager.reset(), url.set({ ...patch, cursor: null }));

  const actionLabel = (a?: string) => t(`actions.${a}`, { defaultValue: a ?? '' });
  const columns: Column<AuditEntry>[] = [
    {
      id: 'at', header: t('col.at'), priority: 1, mobile: 'meta', width: '150px',
      cell: (a) => (a.at ? <Tooltip content={formatDateTime(a.at)}><span tabIndex={0} className="whitespace-nowrap">{formatRelative(a.at)}</span></Tooltip> : '—'),
    },
    {
      id: 'actor', header: t('col.actor'), priority: 1, mobile: 'subtitle',
      cell: (a) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={a.actor?.name ?? '?'} className="size-7 text-[10px]" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg">{a.actor?.name}</span>
            {a.actor?.role && <span className="block text-xs text-fg-tertiary">{tc(`role.${a.actor.role}`, { defaultValue: a.actor.role })}</span>}
          </span>
        </span>
      ),
    },
    {
      id: 'action', header: t('col.action'), priority: 1, mobile: 'title',
      cell: (a) => (
        <span className="min-w-0">
          <span className="block font-medium text-fg">{actionLabel(a.action)}</span>
          <span className="block font-mono text-xs text-fg-tertiary">{a.action}</span>
        </span>
      ),
    },
    {
      id: 'entity', header: t('col.entity'), priority: 3,
      cell: (a) => (
        <span className="min-w-0">
          <span className="block text-fg-secondary">{t(`entities.${a.entity}`, { defaultValue: a.entity ?? '' })}</span>
          <span className="block max-w-[140px] truncate font-mono text-xs text-fg-tertiary">{a.entityId}</span>
        </span>
      ),
    },
    {
      id: 'reason', header: t('col.reason'), priority: 2, mobile: 'badges',
      cell: (a) => (a.reason ? <span className="line-clamp-2 max-w-[360px] text-fg-secondary">{a.reason}</span> : <span className="text-fg-tertiary">{t('noReason')}</span>),
    },
  ];

  return (
    <>
      <PageHeader title={t('title')} print>
        <span>{t('subtitle')}</span>
      </PageHeader>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented label={t('col.at')} value={range} onChange={(v) => reset({ range: v === '7d' ? null : v })} options={RANGES.map((r) => ({ value: r, label: t(`range.${r}`) }))} />
        <div className="flex flex-wrap gap-2 lg:ms-auto">
          <Select value={action} onChange={(e) => reset({ action: e.target.value || null })} className="h-9 w-48" aria-label={t('col.action')}>
            <option value="">{t('allActions')}</option>
            {GROUPS.map((g) => <option key={g} value={g}>{t(`groups.${g}`)}</option>)}
          </Select>
          <Select value={entity} onChange={(e) => reset({ entity: e.target.value || null })} className="h-9 w-44" aria-label={t('col.entity')}>
            <option value="">{t('allEntities')}</option>
            {ENTITIES.map((g) => <option key={g} value={g}>{t(`entities.${g}`)}</option>)}
          </Select>
        </div>
      </div>
      {entityId && (
        <div className="mb-3">
          <Badge tone="info" icon={false} className="gap-2">
            {t('entityFilter', { entity: entity ? t(`entities.${entity}`) : '', id: entityId })}
            <button type="button" onClick={() => reset({ entityId: null })} aria-label={t('clear')} className="rounded-full hover:bg-info/10"><X className="size-3.5" aria-hidden /></button>
          </Badge>
        </div>
      )}
      <DataTable
        tableId="audit"
        caption={t('title')}
        columns={columns}
        rows={q.data?.items}
        rowKey={(a) => a.id ?? ''}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        activeRowKey={drawerId}
        onRowClick={(a) => url.set({ drawer: `audit:${a.id}` }, { push: true })}
        pager={{ page: pager.page, hasPrev: pager.hasPrev, hasNext: !!q.data?.nextCursor, onPrev: pager.prev, onNext: () => pager.next(q.data?.nextCursor), pageSize: limit, onPageSize: (n) => (pager.reset(), setLimit(n), url.set({ cursor: null })) }}
        empty={<EmptyState icon={ScrollText} title={t('emptyTitle')} body={t('emptyBody')} />}
      />
      <AuditDrawer entry={selected} open={!!drawerId} onClose={() => url.set({ drawer: null })} locale={locale} />
    </>
  );
}

function AuditDrawer({ entry, open, onClose, locale }: { entry: AuditEntry | null; open: boolean; onClose: () => void; locale: string }) {
  const { t } = useTranslation('audit');
  const { t: tc } = useTranslation();
  const branches = useBranches();
  const [copied, setCopied] = useState(false);
  const rows = diffRows(entry?.before, entry?.after);
  const branch = branches.data?.find((b) => b.id === entry?.branchId);
  return (
    <Drawer
      open={open && !!entry}
      onOpenChange={(o) => !o && (setCopied(false), onClose())}
      width={560}
      title={entry ? t(`actions.${entry.action}`, { defaultValue: entry.action ?? '' }) : t('detail.title')}
      subtitle={entry?.at ? `${formatDateTime(entry.at)} · ${entry.actor?.name ?? ''}` : undefined}
    >
      {entry && (
        <div className="space-y-6">
          {entry.reason ? (
            <blockquote className="rounded-md border-s-4 border-primary bg-primary-subtle/50 px-4 py-3 text-sm text-fg">{entry.reason}</blockquote>
          ) : (
            <p className="text-sm text-fg-tertiary">{t('noReason')}</p>
          )}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t('detail.changes')}</h3>
            {rows.length === 0 ? (
              <p className="text-sm text-fg-tertiary">{t('detail.noChanges')}</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-line">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-surface-subtle text-xs text-fg-secondary">
                    <tr>
                      <th scope="col" className="w-[34%] px-3 py-2 text-start font-medium">{t('detail.field')}</th>
                      <th scope="col" className="px-3 py-2 text-start font-medium">{t('detail.before')}</th>
                      <th scope="col" className="px-3 py-2 text-start font-medium">{t('detail.after')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className={cn('border-t border-line align-top', r.kind === 'same' && 'text-fg-tertiary')}>
                        <th scope="row" className="px-3 py-2 text-start font-normal">
                          <span className="block break-all font-mono text-xs">{r.key}</span>
                          {r.kind !== 'same' && <span className="sr-only">{t(`kind.${r.kind}`)}</span>}
                        </th>
                        <td className={cn('px-3 py-2 font-mono text-xs break-all', r.kind !== 'same' && r.kind !== 'added' && 'bg-danger-bg/60 text-danger')}>{show(r.before)}</td>
                        <td className={cn('px-3 py-2 font-mono text-xs break-all', r.kind !== 'same' && r.kind !== 'removed' && 'bg-success-bg/60 text-success')}>{show(r.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{t('detail.meta')}</h3>
            <DescList
              items={[
                { label: t('col.actor'), value: `${entry.actor?.name ?? '—'}${entry.actor?.role ? ` · ${tc(`role.${entry.actor.role}`, { defaultValue: entry.actor.role })}` : ''}` },
                { label: t('col.entity'), value: <span><span>{t(`entities.${entry.entity}`, { defaultValue: entry.entity ?? '' })}</span> <span className="font-mono text-xs text-fg-tertiary">{entry.entityId}</span></span> },
                ...(branch ? [{ label: t('detail.branch'), value: <span lang={locale}>{pickText(branch.name, locale as 'bn' | 'en')}</span> }] : []),
                { label: t('detail.ip'), value: <span className="font-mono">{entry.ip ?? '—'}</span> },
                ...(entry.deviceId ? [{ label: t('detail.device'), value: <span className="font-mono">{entry.deviceId}</span> }] : []),
                {
                  label: t('detail.requestId'),
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono">{entry.requestId ?? '—'}</span>
                      {entry.requestId && (
                        <Button variant="ghost" size="icon-sm" className="size-7" aria-label={t('detail.copy')} onClick={() => void navigator.clipboard?.writeText(entry.requestId!).then(() => setCopied(true))}>
                          {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                        </Button>
                      )}
                    </span>
                  ),
                },
              ]}
            />
          </section>
        </div>
      )}
    </Drawer>
  );
}
