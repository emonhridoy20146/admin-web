'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Check, KeyRound, Languages, LogOut, Menu, Monitor, Moon, Search, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useSession } from '@/shared/auth/session';
import { navRoutes } from '@/shared/feature/registry';
import { useGate } from '@/shared/feature/useGate';
import { useUi, type ThemePref } from '@/shared/lib/ui-store';
import { formatNumber, formatRelative, formatTime, pickText } from '@/shared/lib/format';
import { minutesSince } from '@/shared/lib/time';
import { Button } from '@/shared/ui/button';
import { Avatar, DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger, Kbd, Popover, PopoverContent, PopoverTrigger, Switch } from '@/shared/ui/primitives';
import { logout } from '@/features/auth';
import { BranchSwitcher } from './branch-switcher';
import { ErpSyncButton } from './erp-sync-button';
import { useErpStatus } from '../api/queries';

export function Header({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { t } = useTranslation();
  const { t: ts } = useTranslation('shell');
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur-md sm:gap-3 lg:px-6 print:hidden">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label={ts('openMenu')}>
        <Menu className="size-5" />
      </Button>
      {/* The branch name gives way first on a phone: with two bells in the header (FR-W-046) nothing else can shrink. */}
      <div className="flex min-w-0 flex-1 sm:flex-initial">
        <BranchSwitcher />
      </div>
      <button
        type="button"
        onClick={onSearch}
        className="ms-auto flex h-9 shrink-0 items-center gap-2 rounded-sm border border-line bg-surface-subtle px-3 text-sm text-fg-tertiary transition-colors hover:border-line-strong hover:text-fg-secondary max-sm:size-9 max-sm:justify-center max-sm:px-0 sm:ms-2 sm:w-[min(440px,40vw)] [@media(pointer:coarse)]:h-11 max-sm:[@media(pointer:coarse)]:w-11"
        aria-label={t('search.placeholder')}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden flex-1 truncate text-start sm:inline">{t('search.placeholder')}</span>
        <span className="hidden gap-0.5 lg:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1 sm:ms-auto">
        <ErpSyncButton />
        <ErpIndicator />
        <HeaderBells />
        <UserMenu />
      </div>
    </header>
  );
}

function ErpIndicator() {
  const { t } = useTranslation();
  const { t: ts } = useTranslation('shell');
  const { data } = useErpStatus();
  const mins = data?.lastSuccessAt ? minutesSince(data.lastSuccessAt) : null;
  const tone = mins == null ? 'neutral' : mins < 15 && data?.circuit !== 'open' ? 'ok' : mins < 60 ? 'warn' : 'bad';
  const dot = { ok: 'bg-success', warn: 'bg-warning', bad: 'bg-danger', neutral: 'bg-fg-disabled' }[tone];
  const word = { ok: t('erp.fresh'), warn: t('erp.stale'), bad: t('erp.down'), neutral: '' }[tone];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex h-9 items-center gap-2 rounded-sm px-2 text-sm text-fg-secondary hover:bg-surface-hover [@media(pointer:coarse)]:h-11" aria-label={`${ts('erpPanel')}: ${word}`}>
          <span className="relative flex size-2">
            {tone === 'ok' && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-50', dot)} />}
            <span className={cn('relative inline-flex size-2 rounded-full', dot)} />
          </span>
          <span className="hidden font-medium xl:inline">{t('erp.label')}</span>
          {mins != null && <span className="tabular hidden text-fg-tertiary xl:inline">{formatRelative(data!.lastSuccessAt!)}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', dot)} aria-hidden />
          <span className="font-semibold">{data?.mode ? t(`erp.${data.mode}`) : ts('erpPanel')}</span>
        </div>
        {data && (
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k={t('erp.lastSync', { time: '' }).trim()} v={data.lastSuccessAt ? formatTime(data.lastSuccessAt) : '—'} />
            <Row k={ts('erpCircuit')} v={data.circuit ?? '—'} />
            <Row k={t('money.pending')} v={t('erp.outbox', { n: formatNumber(data.outboxPending ?? 0) })} />
            {(data.outboxFailed ?? 0) > 0 && <Row k="" v={<span className="text-danger">{t('erp.failed', { n: formatNumber(data.outboxFailed ?? 0) })}</span>} />}
          </dl>
        )}
      </PopoverContent>
    </Popover>
  );
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-fg-tertiary">{k}</dt>
    <dd className="tabular text-end text-fg">{v}</dd>
  </div>
);

/** One bell per feature route that asks for one (the inbox, the staff activity feed), each with its own count. */
function HeaderBells() {
  const { t } = useTranslation();
  const gate = useGate();
  const bells = navRoutes(gate)
    .filter((r) => r.bell && r.useBadge)
    .sort((a, b) => a.bell!.order - b.bell!.order);
  return (
    <>
      {bells.map((r) => (
        <BellButton key={r.path} href={r.path} useBadge={r.useBadge!} label={t(r.bell!.label)} icon={r.bell!.icon} />
      ))}
    </>
  );
}
function BellButton({ href, useBadge, label, icon: Icon }: { href: string; useBadge: () => number | undefined; label: string; icon: LucideIcon }) {
  const n = useBadge();
  return (
    <Link href={href} className="relative grid size-9 place-items-center rounded-sm text-fg-secondary hover:bg-surface-hover hover:text-fg [@media(pointer:coarse)]:size-11" aria-label={n ? `${label}: ${n}` : label}>
      <Icon className="size-[18px]" aria-hidden />
      {!!n && <span className="tabular absolute top-1 end-0.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-semibold text-white ring-2 ring-surface">{formatNumber(n > 99 ? 99 : n)}</span>}
    </Link>
  );
}

function UserMenu() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const ui = useUi();
  const router = useRouter();
  const name = pickText(user?.name, ui.locale);
  const themes: [ThemePref, typeof Sun][] = [['light', Sun], ['dark', Moon], ['system', Monitor]];
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button type="button" className="flex h-9 items-center gap-2 rounded-sm ps-1 pe-1 hover:bg-surface-hover sm:pe-2 [@media(pointer:coarse)]:h-11" aria-label={name}>
          <Avatar name={user?.name?.en ?? name} />
          <span className="hidden min-w-0 text-start leading-tight 2xl:block">
            <span className="block max-w-[160px] truncate text-sm font-medium text-fg">{name}</span>
            <span className="block text-xs text-fg-tertiary">{t(`role.${user?.role}`)}</span>
          </span>
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-64">
        <div className="px-2 py-2">
          <div className="truncate text-base font-semibold">{name}</div>
          <div className="text-sm text-fg-tertiary">{t(`role.${user?.role}`)} · <span className="font-mono">{user?.employeeCode}</span></div>
        </div>
        <DropdownSeparator />
        <DropdownLabel>{t('user.language')}</DropdownLabel>
        {(['bn', 'en'] as const).map((l) => (
          <DropdownItem key={l} onSelect={(e) => (e.preventDefault(), ui.set({ locale: l, bnDigits: l === 'bn' ? ui.bnDigits : false }))}>
            <Languages className="size-4 text-fg-tertiary" aria-hidden />
            <span className="flex-1" lang={l}>{l === 'bn' ? t('user.bangla') : t('user.english')}</span>
            {ui.locale === l && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownItem>
        ))}
        <DropdownItem onSelect={(e) => (e.preventDefault(), ui.set({ bnDigits: !ui.bnDigits }))}>
          <span className="w-4 text-center font-semibold text-fg-tertiary" aria-hidden>৳</span>
          <span className="flex-1">{t('user.bnDigits')}</span>
          <Switch checked={ui.bnDigits} tabIndex={-1} aria-hidden />
        </DropdownItem>
        <DropdownSeparator />
        <DropdownLabel>{t('user.theme')}</DropdownLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          {themes.map(([th, Icon]) => (
            <button key={th} type="button" onClick={() => ui.set({ theme: th })} className={cn('flex h-9 flex-col items-center justify-center gap-0.5 rounded-sm text-xs [@media(pointer:coarse)]:h-11', ui.theme === th ? 'bg-primary-subtle text-primary-subtle-fg' : 'text-fg-secondary hover:bg-surface-hover')} aria-pressed={ui.theme === th}>
              <Icon className="size-4" aria-hidden />
              {t(`user.${th}`)}
            </button>
          ))}
        </div>
        <DropdownSeparator />
        <DropdownItem onSelect={() => router.push('/change-password/')}>
          <KeyRound className="size-4 text-fg-tertiary" aria-hidden />
          {t('user.changePassword')}
        </DropdownItem>
        <DropdownItem onSelect={() => void logout().then(() => router.replace('/login/'))} className="text-danger">
          <LogOut className="size-4" aria-hidden />
          {t('user.logout')}
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}
