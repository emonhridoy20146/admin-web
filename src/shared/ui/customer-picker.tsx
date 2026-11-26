'use client';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { pickText } from '../lib/format';
import { useUi } from '../lib/ui-store';
import { useBranchId } from '../lib/ui-store';
import { api, unwrap } from '../api/client';
import { cn } from '../lib/cn';
import { TagChip, tagBoxClass } from './tag-chip';

interface Props {
  id?: string;
  value: string;
  displayName: string;
  onChange: (customerId: string, displayName: string) => void;
}

export function CustomerPicker({ id, value, displayName, onChange }: Props) {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const branchId = useBranchId();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: ['customer-picker', branchId, search],
    queryFn: () => unwrap(api.GET('/customers', { params: { query: { branchId, q: search, limit: 10 } } })),
    enabled: search.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const items = q.data?.items ?? [];

  if (value && displayName) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 shadow-e1">
        <span className="flex-1 truncate text-base font-medium" lang={locale}>{displayName}</span>
        <button
          type="button"
          onClick={() => { onChange('', ''); setSearch(''); }}
          className="grid size-6 place-items-center rounded-xs text-fg-tertiary hover:bg-surface-hover hover:text-fg"
          aria-label={t('actions.clear')}
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          type="search"
          className="w-full h-10 rounded-sm border border-line-strong bg-surface ps-9 pe-3 text-base text-fg placeholder:text-fg-disabled shadow-e1 transition-[border-color,box-shadow] hover:border-fg-disabled focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={t('search.placeholder')}
          autoComplete="off"
        />
      </div>
      {open && search.length >= 2 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-surface-raised shadow-e3">
          {items.length === 0 && !q.isLoading && (
            <li className="px-3 py-2 text-sm text-fg-tertiary">{t('search.empty', { q: search })}</li>
          )}
          {q.isLoading && items.length === 0 && (
            <li className="px-3 py-2 text-sm text-fg-tertiary">{t('search.hint')}</li>
          )}
          {items.map((c) => (
            <li key={c.id} className={cn(tagBoxClass(c.tag) && 'px-1.5 py-1')}>
              <button
                type="button"
                className={cn('flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-surface-hover', tagBoxClass(c.tag))}
                data-tag-border={tagBoxClass(c.tag) ? 'true' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c.id!, pickText(c.name, locale));
                  setSearch('');
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="block truncate font-medium" lang={locale}>{pickText(c.name, locale)}</span>
                    <TagChip tag={c.tag} />
                  </span>
                  <span className="block font-mono text-xs text-fg-tertiary">{c.code}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
