'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Rows3, Inbox } from 'lucide-react';
import { cn } from '../lib/cn';
import { readStore, writeStore, useUi } from '../lib/ui-store';
import { formatNumber } from '../lib/format';
import { Button } from './button';
import { Checkbox, DropdownContent, DropdownMenu, DropdownTrigger, DropdownLabel } from './primitives';
import { EmptyState, ErrorBanner, Skeleton } from './feedback';
import * as Menu from '@radix-ui/react-dropdown-menu';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: 'start' | 'end';
  /** 1 = always shown; higher numbers hide first on narrow screens (03 §6) */
  priority?: 1 | 2 | 3 | 4 | 5;
  width?: string;
  sortKey?: string;
  /** role in the < 640 px card list */
  mobile?: 'title' | 'subtitle' | 'badges' | 'amount' | 'meta';
  hideable?: boolean;
}

export interface Pager {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  total?: number;
}

const prioClass: Record<number, string> = {
  1: '',
  2: '',
  3: 'hidden lg:table-cell print:table-cell',
  4: 'hidden xl:table-cell print:table-cell',
  5: 'hidden 2xl:table-cell print:table-cell',
};

export function DataTable<T>({
  tableId, columns, rows, rowKey, loading, error, onRetry, onRowClick, sort, onSortChange, empty, pager,
  selectable, selection, onSelectionChange, bulkBar, activeRowKey, caption,
}: {
  tableId: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (r: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (r: T) => void;
  sort?: string;
  onSortChange?: (s: string) => void;
  empty?: React.ReactNode;
  pager?: Pager;
  selectable?: boolean;
  selection?: Set<string>;
  onSelectionChange?: (s: Set<string>) => void;
  bulkBar?: React.ReactNode;
  activeRowKey?: string | null;
  caption: string;
}) {
  const { t } = useTranslation();
  const density = useUi((s) => s.density);
  const setUi = useUi((s) => s.set);
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => setHidden(readStore(`fos.table.${tableId}`, { v: 1, hidden: [] as string[] }).hidden), [tableId]);
  const toggleCol = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
    setHidden(next);
    writeStore(`fos.table.${tableId}`, { v: 1, hidden: next });
  };
  const visible = columns.filter((c) => !hidden.includes(c.id));

  const defs = useMemo<ColumnDef<T>[]>(() => visible.map((c) => ({ id: c.id, header: c.header, cell: (ctx) => c.cell(ctx.row.original) })), [visible]);
  const rowSelection: RowSelectionState = useMemo(() => Object.fromEntries([...(selection ?? [])].map((k) => [k, true])), [selection]);
  const table = useReactTable({
    data: rows ?? [],
    columns: defs,
    getCoreRowModel: getCoreRowModel(),
    getRowId: rowKey,
    manualPagination: true,
    manualSorting: true,
    state: { rowSelection },
    enableRowSelection: !!selectable,
  });

  const allKeys = (rows ?? []).map(rowKey);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selection?.has(k));
  const someSelected = allKeys.some((k) => selection?.has(k));
  const toggleRow = (k: string) => {
    const s = new Set(selection);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    onSelectionChange?.(s);
  };
  const rowH = density === 'compact' ? 'h-9' : 'h-11';
  const colMeta = (id: string) => columns.find((c) => c.id === id)!;
  const showEmpty = !loading && !error && rows && rows.length === 0;

  const sortHeader = (c: Column<T>) => {
    if (!c.sortKey || !onSortChange) return c.header;
    const active = sort === c.sortKey || sort === `-${c.sortKey}`;
    const desc = sort === `-${c.sortKey}`;
    return (
      <button
        type="button"
        className={cn('inline-flex items-center gap-1 hover:text-fg', active && 'text-fg')}
        onClick={() => onSortChange(active && !desc ? `-${c.sortKey}` : active && desc ? c.sortKey! : `-${c.sortKey}`)}
        aria-label={`${c.header}: ${t('table.sort')}`}
      >
        {c.header}
        {active && (desc ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUp className="size-3.5" aria-hidden />)}
      </button>
    );
  };

  return (
    <div className="relative">
      {error ? <ErrorBanner error={error} onRetry={onRetry} className="mb-3" /> : null}
      <div className="overflow-hidden rounded-md border border-line bg-surface shadow-e1">
        <div className="flex items-center justify-end gap-1 border-b border-line px-2 py-1.5 print:hidden">
          <span className="me-auto ps-2 text-sm text-fg-tertiary">
            {pager?.total != null ? t('table.total', { n: formatNumber(pager.total) }) : null}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label={t('table.density')} onClick={() => setUi({ density: density === 'compact' ? 'comfortable' : 'compact' })} className="hidden sm:inline-flex">
            <Rows3 className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('table.columns')} className="hidden sm:inline-flex">
                <Columns3 className="size-4" />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>{t('table.columns')}</DropdownLabel>
              {columns.filter((c) => c.hideable !== false && c.priority !== 1).map((c) => (
                <Menu.CheckboxItem
                  key={c.id}
                  checked={!hidden.includes(c.id)}
                  onCheckedChange={() => toggleCol(c.id)}
                  onSelect={(e) => e.preventDefault()}
                  className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-base outline-none data-[highlighted]:bg-surface-hover"
                >
                  <Checkbox checked={!hidden.includes(c.id)} tabIndex={-1} aria-hidden />
                  {c.header}
                </Menu.CheckboxItem>
              ))}
            </DropdownContent>
          </DropdownMenu>
        </div>

        {/* ≥ 640 px: table */}
        <div className="scrollbar-thin hidden overflow-x-auto sm:block print:block print:overflow-visible">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 z-10">
              <tr>
                {selectable && (
                  <th scope="col" className="w-10 border-b border-line bg-surface-subtle ps-4">
                    <Checkbox
                      aria-label={t('table.selectAll')}
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={() => onSelectionChange?.(allSelected ? new Set() : new Set(allKeys))}
                    />
                  </th>
                )}
                {table.getHeaderGroups()[0]!.headers.map((h, i) => {
                  const c = colMeta(h.id);
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      style={{ width: c.width }}
                      aria-sort={c.sortKey && sort?.replace('-', '') === c.sortKey ? (sort.startsWith('-') ? 'descending' : 'ascending') : undefined}
                      className={cn(
                        'h-10 border-b border-line bg-surface-subtle px-3 text-start text-xs font-semibold whitespace-nowrap text-fg-secondary',
                        c.align === 'end' && 'text-end',
                        i === 0 && !selectable && 'ps-4 sticky start-0 z-[1]',
                        prioClass[c.priority ?? 2],
                      )}
                    >
                      {sortHeader(c)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, r) => (
                    <tr key={r} className={rowH}>
                      {selectable && <td className="border-b border-line ps-4" />}
                      {visible.map((c, i) => (
                        <td key={c.id} className={cn('border-b border-line px-3', i === 0 && 'ps-4', prioClass[c.priority ?? 2])}>
                          <Skeleton className={cn('h-3.5', i === 0 ? 'w-40' : 'w-20', c.align === 'end' && 'ms-auto')} />
                        </td>
                      ))}
                    </tr>
                  ))
                : table.getRowModel().rows.map((row) => {
                    const k = row.id;
                    const sel = selection?.has(k);
                    return (
                      <tr
                        key={k}
                        className={cn(
                          rowH,
                          'group transition-colors duration-[var(--dur-fast)]',
                          onRowClick && 'cursor-pointer',
                          sel || activeRowKey === k ? 'bg-primary-subtle' : 'hover:bg-surface-hover',
                        )}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button,a,input,[role=checkbox]')) return;
                          onRowClick?.(row.original);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick?.(row.original);
                        }}
                        tabIndex={onRowClick ? 0 : undefined}
                        data-row-key={k}
                      >
                        {selectable && (
                          <td className="border-b border-line ps-4">
                            <Checkbox aria-label={t('table.selectRow')} checked={!!sel} onCheckedChange={() => toggleRow(k)} />
                          </td>
                        )}
                        {row.getVisibleCells().map((cell, i) => {
                          const c = colMeta(cell.column.id);
                          return (
                            <td
                              key={cell.id}
                              className={cn(
                                'border-b border-line px-3 align-middle whitespace-nowrap text-fg',
                                c.align === 'end' && 'tabular text-end',
                                i === 0 && !selectable && 'ps-4',
                                prioClass[c.priority ?? 2],
                              )}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* < 640 px: card list */}
        <ul className="divide-y divide-line sm:hidden print:hidden" aria-label={caption}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="space-y-2 px-4 py-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </li>
              ))
            : (rows ?? []).map((r) => {
                const by = (role: Column<T>['mobile']) => columns.filter((c) => c.mobile === role);
                const k = rowKey(r);
                return (
                  <li key={k}>
                    <div
                      role={onRowClick ? 'button' : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button,a,[role=checkbox]')) return;
                        onRowClick?.(r);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && onRowClick?.(r)}
                      className={cn('flex min-h-14 items-start gap-3 px-4 py-3 active:bg-surface-hover', selection?.has(k) && 'bg-primary-subtle')}
                    >
                      {selectable && <Checkbox className="mt-1" aria-label={t('table.selectRow')} checked={!!selection?.has(k)} onCheckedChange={() => toggleRow(k)} />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 truncate font-medium text-fg">{by('title').map((c) => <span key={c.id}>{c.cell(r)}</span>)}</div>
                          <div className="tabular shrink-0 text-end font-medium">{by('amount').map((c) => <span key={c.id}>{c.cell(r)}</span>)}</div>
                        </div>
                        {by('subtitle').length > 0 && <div className="mt-0.5 truncate text-sm text-fg-tertiary">{by('subtitle').map((c) => <span key={c.id}>{c.cell(r)}</span>)}</div>}
                        {by('meta').length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-fg-secondary">
                            {by('meta').slice(0, 3).map((c) => (
                              <span key={c.id} className="inline-flex items-center gap-1">
                                <span className="text-fg-tertiary">{c.header}:</span> {c.cell(r)}
                              </span>
                            ))}
                          </div>
                        )}
                        {by('badges').length > 0 && <div className="mt-2">{by('badges').map((c) => <span key={c.id}>{c.cell(r)}</span>)}</div>}
                      </div>
                      {onRowClick && <ChevronRight className="mt-1 size-4 shrink-0 text-fg-disabled" aria-hidden />}
                    </div>
                  </li>
                );
              })}
        </ul>

        {showEmpty && (empty ?? <EmptyState icon={Inbox} title={t('table.empty')} />)}

        {pager && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-sm text-fg-secondary print:hidden">
            <label className="hidden items-center gap-2 sm:flex">
              {t('table.perPage')}
              <select
                className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-sm"
                value={pager.pageSize}
                onChange={(e) => pager.onPageSize(Number(e.target.value))}
              >
                {[25, 50, 100].map((n) => <option key={n} value={n}>{formatNumber(n)}</option>)}
              </select>
            </label>
            <span className="tabular">{t('table.page', { n: formatNumber(pager.page) })}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" disabled={!pager.hasPrev} onClick={pager.onPrev} aria-label={t('table.prev')}>
                <ChevronLeft className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t('table.prev')}</span>
              </Button>
              <Button size="sm" variant="secondary" disabled={!pager.hasNext} onClick={pager.onNext} aria-label={t('table.next')}>
                <span className="hidden sm:inline">{t('table.next')}</span>
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>
      {selectable && selection && selection.size > 0 && bulkBar && (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit max-w-[calc(100vw-32px)] items-center gap-3 rounded-lg border border-line bg-surface-raised px-4 py-2 shadow-e3 animate-pop">
          <span className="tabular text-sm font-medium">{t('table.selected', { n: formatNumber(selection.size) })}</span>
          <span className="h-5 w-px bg-line" aria-hidden />
          {bulkBar}
          <Button size="sm" variant="ghost" onClick={() => onSelectionChange?.(new Set())}>{t('actions.clear')}</Button>
        </div>
      )}
    </div>
  );
}

/** Cursor pager state: cursor in URL, previous cursors kept in memory. */
export function useCursorPager(cursor: string, setCursor: (c: string | null) => void) {
  const [stack, setStack] = useState<string[]>([]);
  return {
    page: stack.length + 1,
    reset: () => setStack([]),
    next: (nextCursor: string | null | undefined) => {
      if (!nextCursor) return;
      setStack((s) => [...s, cursor]);
      setCursor(nextCursor);
    },
    prev: () => {
      setStack((s) => {
        const copy = [...s];
        const c = copy.pop();
        setCursor(c || null);
        return copy;
      });
    },
    hasPrev: stack.length > 0,
  };
}
