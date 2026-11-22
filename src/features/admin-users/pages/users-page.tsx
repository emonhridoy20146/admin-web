'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, SearchX, UsersRound } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { formatDateTime, formatMoney, formatRelative, pickText } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Avatar, Segmented, Tooltip } from '@/shared/ui/primitives';
import { SearchInput, Select } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { useUsers, type User } from '../api/users';
import { needsErpLink, ROLES } from '../model/user-form';
import { UserDrawer } from '../components/user-drawer';
import { UserFormDialog } from '../components/user-form-dialog';
import { TempPasswordDialog } from '../components/temp-password-dialog';

const STATUS = ['active', 'inactive', 'all'] as const;

export function UsersPage() {
  const { t } = useTranslation('admin-users');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const canManage = useCan('user.manage');
  const branches = useBranches();
  const url = useUrlState();
  const role = oneOf(url.get('role'), ['', ...ROLES] as const, '');
  const status = oneOf(url.get('status'), STATUS, 'active');
  const qParam = url.get('q');
  const cursor = url.get('cursor');
  const [q, setQ] = useState(qParam);
  const [limit, setLimit] = useState(25);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ name: string; password: string } | null>(null);
  useEffect(() => setQ(qParam), [qParam]);
  useEffect(() => {
    const id = setTimeout(() => q !== qParam && url.set({ q: q || null, cursor: null }), 300);
    return () => clearTimeout(id);
  }, [q, qParam, url]);

  const query = useUsers({
    role: role || undefined,
    active: status === 'all' ? undefined : status === 'active',
    q: qParam || undefined,
    cursor: cursor || undefined,
    limit,
  });
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const drawer = url.get('drawer');
  const drawerId = drawer.startsWith('user:') ? drawer.slice(5) : null;
  const branchCode = useMemo(
    () => Object.fromEntries((branches.data ?? []).map((b) => [b.id, b.code])),
    [branches.data],
  );

  const columns: Column<User>[] = [
    {
      id: 'name',
      header: t('col.name'),
      priority: 1,
      mobile: 'title',
      cell: (u) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={pickText(u.name, locale)} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg" lang={locale}>
              {pickText(u.name, locale)}
            </span>
            <span className="block truncate font-mono text-xs text-fg-tertiary">
              {u.employeeCode}
              {u.username ? ` · ${u.username}` : ''}
            </span>
          </span>
        </span>
      ),
    },
    { id: 'role', header: t('col.role'), priority: 1, mobile: 'subtitle', cell: (u) => tc(`role.${u.role}`) },
    {
      id: 'branches',
      header: t('col.branches'),
      priority: 2,
      mobile: 'meta',
      cell: (u) =>
        u.role === 'super_admin' ? (
          <span className="text-fg-secondary">{t('allBranches')}</span>
        ) : (
          <span className="font-mono text-xs">
            {(u.branchIds ?? []).map((b) => branchCode[b] ?? b).join(', ')}
          </span>
        ),
    },
    {
      id: 'phone',
      header: t('col.phone'),
      priority: 3,
      cell: (u) => <span className="tabular font-mono text-xs">{u.phone}</span>,
    },
    {
      id: 'cashLimit',
      header: t('col.cashLimit'),
      align: 'end',
      priority: 4,
      cell: (u) =>
        u.role !== 'field_staff' ? (
          <span className="text-fg-tertiary">—</span>
        ) : u.cashLimitPoisha != null ? (
          <span className="tabular">{formatMoney(u.cashLimitPoisha)}</span>
        ) : (
          <span className="text-fg-tertiary">{t('defaultLimit')}</span>
        ),
    },
    {
      id: 'lastLogin',
      header: t('col.lastLogin'),
      priority: 3,
      mobile: 'meta',
      cell: (u) =>
        u.lastLoginAt ? (
          <Tooltip content={formatDateTime(u.lastLoginAt)}>
            <span tabIndex={0}>{formatRelative(u.lastLoginAt)}</span>
          </Tooltip>
        ) : (
          <span className="text-fg-tertiary">{t('never')}</span>
        ),
    },
    {
      id: 'status',
      header: t('col.status'),
      priority: 2,
      mobile: 'badges',
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.active ? (
            <Badge tone="success">{t('status.active')}</Badge>
          ) : (
            <Badge tone="danger">{t('status.inactive')}</Badge>
          )}
          {needsErpLink(u) && (
            <Tooltip content={t('erpLinkMissing')}>
              <span tabIndex={0} data-testid="erp-link-missing">
                <Badge tone="warning">{t('erpLinkMissingShort')}</Badge>
              </span>
            </Tooltip>
          )}
          {u.active && u.mustChangePassword && (
            <Badge tone="warning" icon={false}>
              {t('mustChange')}
            </Badge>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        print
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              {t('new')}
            </Button>
          )
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="md:w-80"
        />
        <Select
          value={role}
          onChange={(e) => (pager.reset(), url.set({ role: e.target.value || null, cursor: null }))}
          className="h-9 md:w-48"
          aria-label={t('col.role')}
        >
          <option value="">{t('allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {tc(`role.${r}`)}
            </option>
          ))}
        </Select>
        <Segmented
          className="md:ms-auto"
          label={t('col.status')}
          value={status}
          onChange={(v) => (pager.reset(), url.set({ status: v === 'active' ? null : v, cursor: null }))}
          options={STATUS.map((s) => ({ value: s, label: t(`status.${s}`) }))}
        />
      </div>

      <DataTable
        tableId="admin-users"
        caption={t('title')}
        columns={columns}
        rows={query.data?.items}
        rowKey={(u) => u.id ?? ''}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        activeRowKey={drawerId}
        onRowClick={(u) => url.set({ drawer: `user:${u.id}` }, { push: true })}
        pager={{
          page: pager.page,
          hasPrev: pager.hasPrev,
          hasNext: !!query.data?.nextCursor,
          onPrev: pager.prev,
          onNext: () => pager.next(query.data?.nextCursor),
          pageSize: limit,
          onPageSize: (n) => (pager.reset(), setLimit(n), url.set({ cursor: null })),
        }}
        empty={
          <EmptyState
            icon={qParam || role ? SearchX : UsersRound}
            title={t('emptyTitle')}
            body={t('emptyBody')}
          />
        }
      />

      <UserDrawer id={drawerId} onClose={() => url.set({ drawer: null })} />
      <UserFormDialog
        open={creating}
        onOpenChange={setCreating}
        user={null}
        onCreated={(r) =>
          r.temporaryPassword &&
          setCreated({ name: pickText(r.user?.name, locale), password: r.temporaryPassword })
        }
      />
      <TempPasswordDialog
        value={created?.password ?? null}
        name={created?.name ?? ''}
        onClose={() => setCreated(null)}
      />
    </>
  );
}
