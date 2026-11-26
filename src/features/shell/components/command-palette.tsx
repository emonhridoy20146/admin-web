'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import { ArrowRight, CornerDownLeft, Receipt, Search, User, UserRound } from 'lucide-react';
import { commands, navRoutes, navSections } from '@/shared/feature/registry';
import { useGate } from '@/shared/feature/useGate';
import { Kbd } from '@/shared/ui/primitives';
import { Skeleton } from '@/shared/ui/feedback';
import { ReturnedMark } from '@/shared/ui/badge';
import type { ReturnedLike } from '@/shared/ui/status';
import { TagChip } from '@/shared/ui/tag-chip';
import { tagLookOf, type TagLike } from '@/shared/ui/tag-look';
import { cn } from '@/shared/lib/cn';
import { useSearch } from '../api/queries';

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return d;
}

/** ⌘K command palette (FR-W-014): jump to customers/staff/receipts and to any page you can open. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const gate = useGate();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 200);
  const searchOn = gate.flag('module.search');
  const { data, isFetching } = useSearch(searchOn ? dq : '');
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const routes = navRoutes(gate);
  const cmds = commands(gate);
  // FR-W-069: a sidebar section's name ("Admin", "Field work") opens it too, unless a page already has that name
  const pageTitles = new Set(routes.map((r) => t(r.title)));
  const sectionItems = navSections(gate)
    .filter((n) => !pageTitles.has(t(n.section.title)))
    .map((n) => ({ key: `section:${n.section.id}`, title: t(n.section.title), icon: n.section.icon, href: n.href }));
  const groups = {
    customer: { label: t('search.customers'), icon: UserRound, href: (id: string) => `/customers/${id}/` },
    user: { label: t('search.users'), icon: User, href: (id: string) => `/admin/users/?drawer=user:${id}` },
    receipt: { label: t('search.receipts'), icon: Receipt, href: (id: string) => `/collections/?drawer=collection:${id}` },
  } as const;

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade" />
        <D.Content className="fixed inset-x-3 top-[10vh] z-50 mx-auto max-w-[640px] overflow-hidden rounded-lg border border-line bg-surface-raised shadow-e3 animate-pop focus:outline-none">
          <D.Title className="sr-only">{t('search.short')}</D.Title>
          <D.Description className="sr-only">{t('search.placeholder')}</D.Description>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 text-fg-tertiary" aria-hidden />
              <Command.Input value={q} onValueChange={setQ} placeholder={t('search.placeholder')} className="h-12 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-fg-disabled" autoFocus />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
              {isFetching && dq.length >= 2 && (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}
              {dq.length >= 2 && !isFetching && data && data.length === 0 && <Command.Empty className="px-3 py-6 text-center text-sm text-fg-tertiary">{t('search.empty', { q: dq })}</Command.Empty>}
              {data &&
                (Object.keys(groups) as (keyof typeof groups)[]).map((type) => {
                  const items = data.filter((r) => r.type === type);
                  if (!items.length) return null;
                  const g = groups[type];
                  return (
                    <Command.Group key={type} heading={g.label} className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-tertiary">
                      {items.map((r) => (
                        // FR-W-073: an only-returned customer still opens in admin (coordinator decision 2026-11-26; the staff app does not)
                        <Item key={r.id} onSelect={() => go(g.href(r.id!))} icon={g.icon} title={r.title!} subtitle={r.subtitle} tag={type === 'customer' ? r.tag : undefined} returned={type === 'customer' ? r : undefined} />
                      ))}
                    </Command.Group>
                  );
                })}
              <Command.Group heading={t('search.commands')} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-tertiary">
                {[...cmds.map((c) => ({ key: c.id, title: t(c.title), icon: c.icon ?? ArrowRight, href: c.href })), ...routes.map((r) => ({ key: r.path, title: t(r.title), icon: r.icon ?? ArrowRight, href: r.path })), ...sectionItems]
                  .filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()))
                  .slice(0, q ? 8 : 10)
                  .map((c) => (
                    <Item key={c.key} onSelect={() => go(c.href)} icon={c.icon} title={c.title} />
                  ))}
              </Command.Group>
            </Command.List>
            <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-xs text-fg-tertiary sm:flex">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> {t('search.navigate')}</span>
              <span className="flex items-center gap-1"><Kbd><CornerDownLeft className="size-3" /></Kbd> {t('search.select')}</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/**
 * A customer result with a bad tag is framed and shows its chip (FR-W-072, contract 1.52.0 `SearchResult.tag`); one with
 * returned invoices shows the returned marker (FR-W-073, contract 1.53.0).
 */
function Item({ onSelect, icon: Icon, title, subtitle, tag, returned }: { onSelect: () => void; icon: typeof Search; title: string; subtitle?: string; tag?: TagLike; returned?: ReturnedLike }) {
  const look = tagLookOf(tag);
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn('flex min-h-10 cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-base text-fg data-[selected=true]:bg-primary-subtle data-[selected=true]:text-primary-subtle-fg [@media(pointer:coarse)]:min-h-11', look && `${look.className} fos-tag-box my-1`)}
      data-tag-border={look ? 'true' : undefined}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-surface text-fg-tertiary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="block truncate">{title}</span>
          <TagChip look={look} />
          <ReturnedMark of={returned} className="shrink-0" />
        </span>
        {subtitle && <span className="block truncate text-xs text-fg-tertiary">{subtitle}</span>}
      </span>
    </Command.Item>
  );
}
