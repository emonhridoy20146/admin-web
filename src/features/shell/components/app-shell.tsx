'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Lock, PanelLeftClose, PanelLeftOpen, PowerOff, WifiOff } from 'lucide-react';
import * as D from '@radix-ui/react-dialog';
import { cn } from '@/shared/lib/cn';
import { useSession } from '@/shared/auth/session';
import { onForcedLogout, refreshSession, scheduleProactiveRefresh } from '@/shared/auth/refresh';
import { navRoutes, featureForPath } from '@/shared/feature/registry';
import { useGate } from '@/shared/feature/useGate';
import type { FeatureRoute, NavGroup } from '@/shared/feature/types';
import { useUi } from '@/shared/lib/ui-store';
import { formatNumber } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/feedback';
import { Tooltip } from '@/shared/ui/primitives';
import { BrandMark } from '@/features/auth';
import { Header } from './header';
import { IdleWatcher } from './idle-watcher';
import { CommandPalette } from './command-palette';
import { useBranchSync } from './branch-switcher';
import { useBranchFlags, useMe } from '../api/queries';

const GROUPS: NavGroup[] = ['top', 'field', 'people', 'insights', 'admin'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const status = useSession((s) => s.status);
  const mustChange = useSession((s) => s.user?.mustChangePassword);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'booting')
      void refreshSession().then((ok) => {
        if (!ok) router.replace(`/login/?next=${encodeURIComponent(pathname)}`);
      });
    else if (status === 'anonymous') router.replace(`/login/?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  useEffect(() => {
    if (status === 'authenticated' && mustChange) router.replace(`/change-password/?next=${encodeURIComponent(pathname)}`);
  }, [status, mustChange, router, pathname]);

  useEffect(() => {
    const off = onForcedLogout((reason) => router.replace(`/login/?reason=${reason}`));
    const stop = scheduleProactiveRefresh();
    return () => {
      off();
      stop();
    };
  }, [router]);

  if (status !== 'authenticated' || mustChange) return <ShellSkeleton />;
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <ShellFrame>{children}</ShellFrame>
    </Suspense>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const online = useOnline();
  const pathname = usePathname();
  const router = useRouter();
  useMe();
  useBranchFlags();
  useBranchSync();
  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    let g = false;
    let gTimer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest('input,textarea,select,[contenteditable=true]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === 'g') {
        g = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => (g = false), 900);
      } else if (g) {
        const map: Record<string, string> = { i: '/inbox/', c: '/customers/', o: '/', l: '/collections/', h: '/cash/' };
        if (map[e.key]) router.push(map[e.key]!); // client-side: keeps state, no full reload
        g = false;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only z-[80] rounded-sm bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        {t('skip')}
      </a>
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-20 hidden flex-col border-e border-line bg-surface transition-[width] duration-[var(--dur-base)] ease-standard md:flex',
          collapsed ? 'w-16' : 'w-16 lg:w-[248px]',
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>
      <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade md:hidden" />
          <D.Content className="fixed inset-y-0 start-0 z-40 flex w-[min(300px,86vw)] flex-col bg-surface shadow-e3 animate-drawer focus:outline-none md:hidden">
            <D.Title className="sr-only">{t('nav.menu')}</D.Title>
            <D.Description className="sr-only">{t('nav.menu')}</D.Description>
            <SidebarContent collapsed={false} mobile />
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className={cn('transition-[padding] duration-[var(--dur-base)] ease-standard md:ps-16', !collapsed && 'lg:ps-[248px]')}>
        <Header onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
        {!online && (
          <div role="status" className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning-bg px-4 py-2 text-sm font-medium text-warning">
            <WifiOff className="size-4" aria-hidden />
            {t('offline')}
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1600px] px-4 pt-5 pb-16 sm:pt-6 lg:px-6" data-offline={!online || undefined}>
          <ModuleGate>{children}</ModuleGate>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <IdleWatcher />
    </div>
  );
}

function SidebarContent({ collapsed, mobile }: { collapsed: boolean; mobile?: boolean }) {
  const { t } = useTranslation();
  const gate = useGate();
  const routes = navRoutes(gate);
  const pathname = usePathname();
  const sp = useSearchParams();
  const setUi = useUi((s) => s.set);
  const wide = mobile || !collapsed;
  const branch = sp.get('branch');
  const isActive = (r: FeatureRoute) => (r.path === '/' ? pathname === '/' : pathname === r.path || pathname.startsWith(r.path.replace(/\/$/, '') + '/'));
  // longest-prefix wins, so "/collections/conflicts" is not also highlighting "/collections"
  const active = routes.filter(isActive).sort((a, b) => b.path.length - a.path.length)[0]?.path;

  return (
    <>
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4', !wide && 'lg:justify-center lg:px-0', !mobile && 'max-lg:justify-center max-lg:px-0')}>
        <Link href="/" className="flex items-center gap-2.5" aria-label={t('appName')}>
          <BrandMark className="size-7" />
          <span className={cn('leading-tight', wide ? (mobile ? '' : 'hidden lg:block') : 'hidden')}>
            <span className="block text-base font-semibold text-fg">{t('appName')}</span>
            <span className="block text-xs text-fg-tertiary">{t('appTagline')}</span>
          </span>
        </Link>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3" aria-label={t('nav.menu')}>
        {GROUPS.map((g) => {
          const items = routes.filter((r) => r.navGroup === g);
          if (!items.length) return null;
          return (
            <div key={g} className="mb-3">
              {g !== 'top' && (
                <div className={cn('px-2.5 pt-2 pb-1 text-xs font-medium text-fg-tertiary', wide ? (mobile ? '' : 'hidden lg:block') : 'hidden')}>{t(`nav.${g}`)}</div>
              )}
              {g !== 'top' && !mobile && <div className={cn('mx-3 my-2 h-px bg-line', wide ? 'lg:hidden' : '')} aria-hidden />}
              <ul className="space-y-0.5">
                {items.map((r) => (
                  <NavItem key={r.path} route={r} active={active === r.path} wide={wide} mobile={mobile} href={branch ? `${r.path}?branch=${branch}` : r.path} />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      {!mobile && (
        <div className="hidden border-t border-line p-2 lg:block">
          <Button variant="ghost" size="sm" className={cn('w-full justify-start text-fg-tertiary', collapsed && 'justify-center px-0')} onClick={() => setUi({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && t('nav.collapse')}
          </Button>
        </div>
      )}
    </>
  );
}

function NavItem({ route, active, wide, mobile, href }: { route: FeatureRoute; active: boolean; wide: boolean; mobile?: boolean; href: string }) {
  const { t } = useTranslation();
  const Icon = route.icon;
  const badge = route.useBadge?.();
  const label = t(route.title);
  const link = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-base font-medium transition-colors duration-[var(--dur-fast)] [@media(pointer:coarse)]:h-11',
        active ? 'bg-primary-subtle text-primary-subtle-fg' : 'text-fg-secondary hover:bg-surface-hover hover:text-fg',
        !wide && 'justify-center px-0',
        !mobile && wide && 'max-lg:justify-center max-lg:px-0',
      )}
    >
      {active && <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-primary" aria-hidden />}
      {Icon && <Icon className={cn('size-[18px] shrink-0', active ? 'text-primary' : 'text-fg-tertiary group-hover:text-fg-secondary')} aria-hidden />}
      <span className={cn('truncate', !wide && 'sr-only', !mobile && wide && 'max-lg:sr-only')}>{label}</span>
      {badge ? (
        <span
          className={cn(
            'tabular ms-auto rounded-full bg-danger px-1.5 text-xs leading-5 font-semibold text-white',
            (!wide || (!mobile && wide)) && 'absolute -top-0.5 end-0.5 ms-0 min-w-4 px-1 text-center text-[10px] leading-4',
            !mobile && wide && 'lg:static lg:ms-auto lg:px-1.5 lg:text-xs lg:leading-5',
          )}
        >
          {formatNumber(badge > 99 ? 99 : badge)}
        </span>
      ) : null}
    </Link>
  );
  return <li>{wide ? link : <Tooltip content={label} side="right">{link}</Tooltip>}</li>;
}

/** Hides disabled modules and pages without permission (W-E9). Direct URLs show a calm explanation. */
function ModuleGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const gate = useGate();
  const hit = featureForPath(pathname);
  if (hit && !gate.flag(hit.manifest.flag))
    return (
      <EmptyState
        icon={PowerOff}
        title={t('moduleOff.title')}
        body={t('moduleOff.body')}
        className="mt-16"
        action={gate.can('flag.manage') ? <Link href="/admin/flags/" className="text-primary hover:underline">{t('moduleOff.manage')}</Link> : undefined}
      />
    );
  if (hit && !gate.can(hit.route.permission)) return <EmptyState icon={Lock} title={t('forbidden.title')} body={t('forbidden.body')} className="mt-16" />;
  return <>{children}</>;
}

function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(navigator.onLine);
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-bg" aria-busy="true">
      <div className="fixed inset-y-0 start-0 hidden w-16 border-e border-line bg-surface md:block lg:w-[248px]" />
      <div className="h-14 border-b border-line bg-surface md:ms-16 lg:ms-[248px]" />
    </div>
  );
}
