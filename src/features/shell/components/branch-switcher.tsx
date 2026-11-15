'use client';
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useSession } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { pickText } from '@/shared/lib/format';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/shared/ui/primitives';
import { useBranches } from '../api/queries';

/** Global branch filter (FR-W-003): URL `?branch=` ⇄ store ⇄ localStorage, validated against the user's branches. */
export function useBranchSync() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const user = useSession((s) => s.user);
  const branchId = useUi((s) => s.branchId);
  const setUi = useUi((s) => s.set);
  const urlBranch = sp.get('branch') ?? '';
  const mine = user?.branchIds ?? [];
  const isGlobal = user?.role === 'super_admin' || user?.role === 'viewer';

  useEffect(() => {
    // single-branch users are pinned; others validate URL/store against their branches
    let want = urlBranch || branchId;
    if (!isGlobal && mine.length === 1) want = mine[0]!;
    if (want && !mine.includes(want)) want = isGlobal ? '' : (mine[0] ?? '');
    if (!isGlobal && !want) want = mine[0] ?? '';
    if (want !== branchId) setUi({ branchId: want });
    if (want !== urlBranch && (isGlobal || mine.length > 1)) {
      const next = new URLSearchParams(sp.toString());
      if (want) next.set('branch', want);
      else next.delete('branch');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlBranch, user?.id]);
}

export function BranchSwitcher() {
  const { t } = useTranslation();
  const { t: ts } = useTranslation('shell');
  const { data: branches } = useBranches();
  const user = useSession((s) => s.user);
  const branchId = useUi((s) => s.branchId);
  const setUi = useUi((s) => s.set);
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isGlobal = user?.role === 'super_admin' || user?.role === 'viewer';
  const current = branches?.find((b) => b.id === branchId);
  const label = current ? pickText(current.name) : t('allBranches');

  const choose = (id: string) => {
    setUi({ branchId: id });
    const next = new URLSearchParams(sp.toString());
    if (id) next.set('branch', id);
    else next.delete('branch');
    next.delete('cursor');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (!isGlobal && (user?.branchIds?.length ?? 0) <= 1)
    return (
      <span className="inline-flex h-9 items-center gap-2 rounded-sm px-2 text-base font-medium text-fg" title={ts('branchFixed')}>
        <Building2 className="size-4 text-fg-tertiary" aria-hidden />
        <span className="max-w-[140px] truncate">{label}</span>
      </span>
    );

  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-sm border border-line bg-surface px-2.5 text-base font-medium text-fg shadow-e1 hover:bg-surface-hover [@media(pointer:coarse)]:h-11"
          aria-label={`${ts('branch')}: ${label}`}
        >
          <Building2 className="size-4 text-fg-tertiary" aria-hidden />
          <span className="max-w-[120px] truncate sm:max-w-[180px]">{label}</span>
          <ChevronsUpDown className="size-3.5 text-fg-tertiary" aria-hidden />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" className="w-64">
        <DropdownLabel>{ts('branch')}</DropdownLabel>
        {isGlobal && (
          <>
            <DropdownItem onSelect={() => choose('')}>
              <span className="flex-1">{t('allBranches')}</span>
              {!branchId && <Check className="size-4 text-primary" aria-hidden />}
            </DropdownItem>
            <DropdownSeparator />
          </>
        )}
        {branches?.map((b) => (
          <DropdownItem key={b.id} onSelect={() => choose(b.id!)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{pickText(b.name)}</span>
              <span className="block font-mono text-xs text-fg-tertiary">{b.code} · {b.district}</span>
            </span>
            {branchId === b.id && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownItem>
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}
