'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Info, Lock, Search, ShieldCheck, Users } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { formatNumber, pickText } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { Card } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Avatar, Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives';
import { Input, Select } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useBranchOverrides, useCatalog, useEffective, useRoleHolders, useSetBranchOverrides, useSetUserOverrides, useUserPick, useUserSearch, type PermissionDef, type Role } from '../api/rbac';
import { currentOverrides, groupByModule, neverFor, overridesForRole, ROLES, stageModule, toChanges, type Effect, type ModuleGroup } from '../model/matrix';
import { Allowed, OverrideTable, StagedBar } from '../components/override-table';

const TABS = ['roles', 'branch', 'user'] as const;

export function PermissionsPage() {
  const { t } = useTranslation('admin-rbac');
  useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const userParam = url.get('user');
  const tab = oneOf(url.get('tab'), TABS, userParam ? 'user' : 'roles');
  const catalog = useCatalog();
  const groups = useMemo(() => groupByModule(catalog.data ?? []), [catalog.data]);

  return (
    <>
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>
      {catalog.error ? <ErrorBanner error={catalog.error} onRetry={() => catalog.refetch()} /> : null}
      <Tabs value={tab} onValueChange={(v) => url.set({ tab: v === 'roles' ? null : v })}>
        <TabsList className="mb-5">
          {TABS.map((x) => <TabsTrigger key={x} value={x}>{t(`tabs.${x}`)}</TabsTrigger>)}
        </TabsList>
        {/* contents always mounted so each trigger's aria-controls points at a real panel */}
        <TabsContent value="roles">{catalog.isLoading ? <Skeleton className="h-96 w-full rounded-md" /> : <RoleDefaults groups={groups} />}</TabsContent>
        <TabsContent value="branch">{catalog.isLoading ? <Skeleton className="h-96 w-full rounded-md" /> : <BranchOverrides groups={groups} catalog={catalog.data ?? []} />}</TabsContent>
        <TabsContent value="user">{catalog.isLoading ? <Skeleton className="h-96 w-full rounded-md" /> : <UserOverrides groups={groups} catalog={catalog.data ?? []} />}</TabsContent>
      </Tabs>
    </>
  );
}

function RoleDefaults({ groups }: { groups: ModuleGroup[] }) {
  const { t } = useTranslation('admin-rbac');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  return (
    <>
      <p className="mb-3 flex items-start gap-2 text-sm text-fg-secondary"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{t('rolesHint')}</p>
      <div className="scrollbar-thin overflow-x-auto rounded-md border border-line bg-surface shadow-e1">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">{t('tabs.roles')}</caption>
          <thead className="bg-surface-subtle text-xs text-fg-secondary">
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-2.5 text-start font-medium">{t('col.permission')}</th>
              {ROLES.map((r) => <th key={r} scope="col" className="w-36 px-3 py-2.5 text-start font-medium">{tc(`role.${r}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.module}>
                <tr className="border-b border-line bg-surface-subtle/60">
                  <th scope="rowgroup" colSpan={ROLES.length + 1} className="px-4 py-2 text-start text-xs font-semibold uppercase tracking-wide text-fg-secondary">{t(`modules.${g.module}`, { defaultValue: g.module })}</th>
                </tr>
                {g.perms.map((p) => (
                  <tr key={p.key} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-start font-normal">
                      <span className="block font-mono text-xs text-fg">{p.key}</span>
                      <span className="block text-xs text-fg-tertiary" lang={locale}>{pickText(p.description, locale)}</span>
                    </th>
                    {ROLES.map((r) => (
                      <td key={r} className="px-3 py-2.5">
                        {p.reserved ? (
                          <span className="inline-flex items-center gap-1 text-xs text-fg-tertiary"><Lock className="size-3.5" aria-hidden />{t('reserved')}</span>
                        ) : neverFor(p, r) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-fg-tertiary" title={t('neverHint')}><Lock className="size-3.5" aria-hidden />{t('never')}</span>
                        ) : (
                          <Allowed value={!!p.defaults?.[r]} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function useStaged(resetOn: unknown) {
  const [staged, setStaged] = useState<Record<string, Effect>>({});
  useEffect(() => setStaged({}), [resetOn]);
  return [staged, setStaged] as const;
}

function BranchOverrides({ groups, catalog }: { groups: ModuleGroup[]; catalog: PermissionDef[] }) {
  const { t } = useTranslation('admin-rbac');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const globalBranch = useUi((s) => s.branchId);
  const canManage = useCan('rbac.manage');
  const branches = useBranches();
  const url = useUrlState();
  const branchId = url.get('b') || globalBranch || branches.data?.[0]?.id || '';
  const role = oneOf(url.get('role'), ['branch_manager', 'field_staff', 'viewer'] as const, 'field_staff');
  const holders = useRoleHolders(branchId, role);
  const holderList = holders.data?.items ?? [];
  const effective = useBranchOverrides(branchId || undefined);
  const current = useMemo(() => overridesForRole(effective.data?.items, role), [effective.data, role]);
  const [staged, setStaged] = useStaged(`${branchId}:${role}`);
  const save = useSetBranchOverrides();
  const [open, setOpen] = useState(false);
  const changes = toChanges(current, staged);
  const branch = branches.data?.find((b) => b.id === branchId);
  const defaults = Object.fromEntries(catalog.map((p) => [p.key, !!p.defaults?.[role]]));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('branch')}
          <Select value={branchId} onChange={(e) => url.set({ b: e.target.value })} className="sm:w-60">
            {(branches.data ?? []).map((b) => <option key={b.id} value={b.id}>{`${pickText(b.name, locale)} · ${b.code}`}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('role')}
          <Select value={role} onChange={(e) => url.set({ role: e.target.value })} className="sm:w-52">
            {(['branch_manager', 'field_staff', 'viewer'] as const).map((r) => <option key={r} value={r}>{tc(`role.${r}`)}</option>)}
          </Select>
        </label>
        <span className="inline-flex items-center gap-1.5 pb-2 text-sm text-fg-secondary sm:ms-auto">
          <Users className="size-4" aria-hidden />
          {holders.isLoading ? <Skeleton className="h-4 w-32" /> : holderList.length ? t('affects', { n: formatNumber(holderList.length) }) : t('affectsNone')}
        </span>
      </div>
      {effective.error ? <ErrorBanner error={effective.error} onRetry={() => effective.refetch()} /> : null}
      <OverrideTable
        groups={groups}
        rows={(key) => ({ base: !!defaults[key], current: current[key] ?? 'inherit', staged: staged[key], locked: !canManage })}
        onStage={(key, e) => setStaged((s) => ({ ...s, [key]: e }))}
        onBulk={(g, e) => setStaged((s) => stageModule(s, g, e))}
      />
      <StagedBar count={changes.length} onDiscard={() => setStaged({})} onSave={() => setOpen(true)} />
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={t('saveTitle', { n: formatNumber(changes.length) })}
        description={t('scopeBranch', { role: tc(`role.${role}`), branch: pickText(branch?.name, locale) })}
        minLength={5}
        confirmLabel={t('saveConfirm')}
        onSubmit={async ({ reason }) => {
          await save.mutateAsync({ branchId, role: role as Role, changes, reason });
          setStaged({});
          toast.success(t('saved'));
        }}
      >
        <ChangeList changes={changes} />
      </ReasonDialog>
    </>
  );
}

function ChangeList({ changes }: { changes: { key: string; effect: Effect }[] }) {
  const { t } = useTranslation('admin-rbac');
  return (
    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-sm border border-line bg-surface-subtle p-2">
      {changes.map((c) => (
        <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
          <span className="font-mono text-xs">{c.key}</span>
          <Badge tone={c.effect === 'allow' ? 'success' : c.effect === 'deny' ? 'danger' : 'neutral'} icon={false}>{t(`effect.${c.effect}`)}</Badge>
        </li>
      ))}
    </ul>
  );
}

function UserOverrides({ groups, catalog }: { groups: ModuleGroup[]; catalog: PermissionDef[] }) {
  const { t } = useTranslation('admin-rbac');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const canManage = useCan('rbac.manage');
  const url = useUrlState();
  const userId = url.get('user') || null;
  const user = useUserPick(userId);
  const effective = useEffective(userId);
  const current = useMemo(() => currentOverrides(effective.data, 'user'), [effective.data]);
  const [staged, setStaged] = useStaged(userId);
  const save = useSetUserOverrides();
  const [open, setOpen] = useState(false);
  const changes = toChanges(current, staged);
  const u = user.data;
  const name = pickText(u?.name, locale);
  const isSuper = u?.role === 'super_admin';
  const byKey = useMemo(() => Object.fromEntries((effective.data ?? []).map((e) => [e.key, e])), [effective.data]);
  const roleDefault = (key: string) => !!catalog.find((p) => p.key === key)?.defaults?.[u?.role ?? 'viewer'];

  if (!userId) return <UserPicker onPick={(id) => url.set({ user: id, tab: 'user' })} />;

  return (
    <>
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        {u ? <Avatar name={name} className="size-10 text-sm" /> : <Skeleton className="size-10 rounded-full" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-fg" lang={locale}>{u ? name : <Skeleton className="h-5 w-40" />}</div>
          {u && <div className="text-sm text-fg-tertiary"><span className="font-mono">{u.employeeCode}</span> · {tc(`role.${u.role}`)}</div>}
        </div>
        <Button size="sm" onClick={() => url.set({ user: null })}>{t('changeUser')}</Button>
      </Card>
      {isSuper && <p className="mb-3 flex items-start gap-2 rounded-sm bg-info-bg px-3 py-2 text-sm text-info"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />{t('superAdminNote')}</p>}
      {effective.error ? <ErrorBanner error={effective.error} onRetry={() => effective.refetch()} /> : null}
      {effective.isLoading ? (
        <Skeleton className="h-96 w-full rounded-md" />
      ) : (
        <OverrideTable
          groups={groups}
          showSource
          rows={(key) => {
            const e = byKey[key];
            // inherited value: what the user would have without a user-level override
            const base = e && e.source !== 'user' ? !!e.allowed : roleDefault(key);
            const def = catalog.find((p) => p.key === key);
            return { base, current: current[key] ?? 'inherit', staged: staged[key], source: e?.source, locked: !canManage || isSuper, never: !!def && neverFor(def, u?.role) };
          }}
          onStage={(key, e) => setStaged((s) => ({ ...s, [key]: e }))}
          onBulk={(g, e) => setStaged((s) => stageModule(s, g, e))}
        />
      )}
      <StagedBar count={changes.length} onDiscard={() => setStaged({})} onSave={() => setOpen(true)} />
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={t('saveTitleUser', { n: formatNumber(changes.length), name })}
        minLength={5}
        confirmLabel={t('saveConfirm')}
        onSubmit={async ({ reason }) => {
          await save.mutateAsync({ userId: userId!, changes, reason });
          setStaged({});
          toast.success(t('saved'));
        }}
      >
        <ChangeList changes={changes} />
      </ReasonDialog>
    </>
  );
}

function UserPicker({ onPick }: { onPick: (id: string) => void }) {
  const { t } = useTranslation('admin-rbac');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(id);
  }, [q]);
  const res = useUserSearch(debounced);
  return (
    <Card className="mx-auto max-w-xl p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary-subtle-fg"><Search className="size-5" aria-hidden /></span>
        <div>
          <h2 className="text-md font-semibold text-fg">{t('pickUser')}</h2>
          <p className="text-sm text-fg-secondary">{t('pickUserHint')}</p>
        </div>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchUser')} aria-label={t('searchUser')} autoFocus />
      {debounced.trim().length >= 2 && (
        <ul className="mt-2 divide-y divide-line rounded-sm border border-line" aria-live="polite">
          {res.isLoading && <li className="p-3"><Skeleton className="h-5 w-48" /></li>}
          {res.data?.items?.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => onPick(u.id!)} className={cn('flex min-h-12 w-full items-center gap-3 px-3 py-2 text-start hover:bg-surface-hover')}>
                <Avatar name={pickText(u.name, locale)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg" lang={locale}>{pickText(u.name, locale)}</span>
                  <span className="block text-xs text-fg-tertiary"><span className="font-mono">{u.employeeCode}</span> · {tc(`role.${u.role}`)}</span>
                </span>
              </button>
            </li>
          ))}
          {res.data && !res.data.items?.length && <li><EmptyState icon={Search} title={t('noResults')} /></li>}
        </ul>
      )}
    </Card>
  );
}
