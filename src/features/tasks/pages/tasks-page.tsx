'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useCan } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatRelative, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { Button } from '@/shared/ui/button';
import { SearchInput, Select } from '@/shared/ui/form';
import { Segmented } from '@/shared/ui/primitives';
import { useStaffOf, useTask, useTasks, type Task } from '../api/tasks';
import { TABS, tabQuery, type Tab } from '../model/tasks';
import { DueBadge, TaskStatusBadge } from '../components/task-badges';
import { TaskDialog } from '../components/task-dialog';
import { TaskDrawer } from '../components/task-drawer';

/** FR-TASK-004: tasks given to staff, what is waiting for the admin to verify, and who is late. */
export function TasksPage() {
  const { t } = useTranslation('tasks');
  const locale = useUi((s) => s.locale);
  const branchId = useUi((s) => s.branchId);
  useUi((s) => s.bnDigits);
  const canManage = useCan('task.manage');
  const url = useUrlState();
  const today = todayDhaka();
  const tab: Tab = oneOf(url.get('status') || (url.get('overdue') ? 'overdue' : ''), TABS, 'open');
  const userId = url.get('userId');
  const cursor = url.get('cursor');
  const urlQ = url.get('q');
  const [search, setSearch] = useState(urlQ);
  const [limit, setLimit] = useState(25);
  const [creating, setCreating] = useState(false);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const branches = useBranches();
  const staff = useStaffOf(branchId || undefined);
  const q = useTasks({ ...tabQuery(tab), assigneeId: userId || undefined, q: urlQ || undefined, cursor: cursor || undefined, limit });

  // the search box writes to the link after a short pause, so typing does not reload the list on every key
  useEffect(() => {
    const h = setTimeout(() => search !== urlQ && (pager.reset(), url.set({ q: search || null, cursor: null })), 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openId = url.get('drawer');
  const inList = q.data?.items.find((x) => x.id === openId) ?? null;
  // a link from the inbox or a notification can name a task that is not on this page of the list
  const one = useTask(openId, !inList && !q.isLoading);
  const open = inList ?? one.data ?? null;
  const show = (x: Task) => url.set({ drawer: x.id }, { push: true });
  const branchName = (id: string) => pickText(branches.data?.find((b) => b.id === id)?.name, locale) || id;
  const counts = q.data?.counts;

  const columns: Column<Task>[] = [
    {
      id: 'title',
      header: t('col.title'),
      priority: 1,
      mobile: 'title',
      cell: (x) => (
        <button type="button" onClick={() => show(x)} className="block max-w-[360px] text-start">
          <span className="block truncate font-medium text-fg hover:text-primary" lang={locale}>{x.title}</span>
          {x.note && <span className="block truncate text-xs text-fg-tertiary" lang={locale}>{x.note}</span>}
        </button>
      ),
    },
    {
      id: 'assignee',
      header: t('col.assignee'),
      priority: 1,
      mobile: 'meta',
      cell: (x) => (
        <span className="inline-flex flex-col">
          <span lang={locale}>{x.assignee.name}</span>
          <span className="font-mono text-xs text-fg-tertiary">{x.assignee.employeeCode}</span>
        </span>
      ),
    },
    { id: 'status', header: t('col.status'), priority: 1, mobile: 'badges', cell: (x) => <TaskStatusBadge status={x.status} /> },
    {
      id: 'due',
      header: t('col.due'),
      priority: 2,
      mobile: 'subtitle',
      cell: (x) =>
        x.dueDate ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="tabular whitespace-nowrap">{formatDate(x.dueDate)}</span>
            <DueBadge task={x} today={today} />
          </span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
    { id: 'branch', header: t('col.branch'), priority: 3, cell: (x) => <span className="whitespace-nowrap text-fg-secondary" lang={locale}>{branchName(x.branchId)}</span> },
    { id: 'updated', header: t('col.updated'), priority: 4, cell: (x) => <span className="whitespace-nowrap text-fg-secondary">{formatRelative(x.updatedAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              {t('new')}
            </Button>
          ) : undefined
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3">
        <Segmented
          label={t('tabs')}
          value={tab}
          onChange={(v) => (pager.reset(), url.set({ status: v === 'open' ? null : v, overdue: null, cursor: null, drawer: null }))}
          options={TABS.map((x) => ({ value: x, label: t(`tab.${x}`), count: counts ? counts[x] : undefined }))}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} aria-label={t('search')} className="sm:w-80" />
          <Select aria-label={t('staff')} value={userId} onChange={(e) => (pager.reset(), url.set({ userId: e.target.value || null, cursor: null }))} className="h-9 sm:w-60">
            <option value="">{t('allStaff')}</option>
            {(staff.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>{pickText(u.name, locale)}</option>
            ))}
          </Select>
        </div>
      </div>

      <DataTable
        tableId="tasks"
        caption={t('title')}
        columns={columns}
        rows={q.data?.items}
        rowKey={(x) => x.id}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={show}
        activeRowKey={openId || undefined}
        empty={t(`empty.${tab}`)}
        pager={{ page: pager.page, hasPrev: pager.hasPrev, hasNext: !!q.data?.nextCursor, onPrev: pager.prev, onNext: () => pager.next(q.data?.nextCursor), pageSize: limit, onPageSize: (n) => (pager.reset(), setLimit(n)) }}
      />

      <TaskDrawer task={open} onClose={() => url.set({ drawer: null })} />
      {canManage && <TaskDialog open={creating} onOpenChange={setCreating} onDone={(x) => (pager.reset(), url.set({ status: null, overdue: null, cursor: null, drawer: x.id }, { push: true }))} />}
    </>
  );
}
