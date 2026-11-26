'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Rows3, Inbox } from 'lucide-react';
import { cn } from '../lib/cn';
import { readStore, writeStore, useUi } from '../lib/ui-store';
import { formatNumber } from '../lib/format';
import { pageList, rowRange } from '../lib/pages';
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
  /** page sizes offered (default 25, 50, 100) */
  pageSizes?: number[];
  /** with `pageCount` and `onPage` the pager shows numbered pages (1 … 4 5 6 … 20), first and last (FR-W-060) */
  pageCount?: number;
  onPage?: (n: number) => void;
  /** rows on this page, for "Showing 101–200 of 2,430" */
  rowsOnPage?: number;
  /** a page is being fetched (the buttons stay usable, the range shows a hint) */
  busy?: boolean;
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
  selectable, selection, onSelectionChange, bulkBar, activeRowKey, caption, rowBorderClass,
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
  /**
   * Classes that give a row a coloured border (the bad-tag border, FR-W-072: `fos-tag fos-tag--<reason>`).
   * The table draws it around the row; the < 640 px card list draws it around the card.
   */
  rowBorderClass?: (r: T) => string | null | undefined;
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
                    const border = rowBorderClass?.(row.original);
                    return (
                      <tr
                        key={k}
                        className={cn(
                          rowH,
                          border,
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
                        data-tag-border={border ? 'true' : undefined}
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
                const border = rowBorderClass?.(r);
                return (
                  <li key={k} className={cn(border && 'px-2 py-1.5')}>
                    <div
                      role={onRowClick ? 'button' : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button,a,[role=checkbox]')) return;
                        onRowClick?.(r);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && onRowClick?.(r)}
                      className={cn('flex min-h-14 items-start gap-3 px-4 py-3 active:bg-surface-hover', selection?.has(k) && 'bg-primary-subtle', border && `${border} fos-tag-box px-2.5`)}
                      data-tag-border={border ? 'true' : undefined}
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

        {pager && <PagerBar pager={pager} />}
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

/**
 * The pager under a table. Numbered when the page count is known (`pageCount` + `onPage`): first, previous, pages with
 * gaps, next, last; otherwise previous / next. Every button has a name for screen readers; the current page carries
 * `aria-current="page"`. Below 640 px the numbers shrink to "Page 3 of 20" so the bar never scrolls sideways.
 */
export function PagerBar({ pager }: { pager: Pager }) {
  const { t } = useTranslation();
  const sizes = pager.pageSizes ?? [25, 50, 100];
  const numbered = pager.pageCount != null && !!pager.onPage;
  const count = Math.max(1, pager.pageCount ?? 1);
  const range = pager.rowsOnPage != null ? rowRange(pager.page, pager.pageSize, pager.rowsOnPage) : null;
  const navBtn = 'h-9 min-w-9 px-2 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11';
  return (
    <nav aria-label={t('table.pagination')} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-3 py-2 text-sm text-fg-secondary print:hidden" data-testid="pager">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        {sizes.length > 1 && (
          <label className="flex items-center gap-2">
            {t('table.perPage')}
            <select
              className="h-9 rounded-sm border border-line-strong bg-surface px-2 text-sm text-fg [@media(pointer:coarse)]:h-11"
              value={pager.pageSize}
              onChange={(e) => pager.onPageSize(Number(e.target.value))}
            >
              {sizes.map((n) => <option key={n} value={n}>{formatNumber(n)}</option>)}
            </select>
          </label>
        )}
        <span className="tabular" aria-live="polite" data-testid="pager-range">
          {pager.busy
            ? t('table.loadingPage')
            : range && range.last > 0
              ? pager.total != null
                ? t('table.showing', { first: formatNumber(range.first), last: formatNumber(range.last), total: formatNumber(pager.total) })
                : t('table.showingNoTotal', { first: formatNumber(range.first), last: formatNumber(range.last) })
              : numbered
                ? t('table.pageOf', { n: formatNumber(pager.page), pages: formatNumber(count) })
                : t('table.page', { n: formatNumber(pager.page) })}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {numbered && (
          <Button size="sm" variant="ghost" className={navBtn} disabled={pager.page <= 1} onClick={() => pager.onPage!(1)} aria-label={t('table.first')} title={t('table.first')}>
            <ChevronsLeft className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        )}
        <Button size="sm" variant="secondary" className={navBtn} disabled={!pager.hasPrev} onClick={pager.onPrev} aria-label={t('table.prev')}>
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          <span className={cn('hidden', !numbered && 'sm:inline')}>{t('table.prev')}</span>
        </Button>
        {numbered && (
          <>
            <ul className="hidden items-center gap-1 sm:flex">
              {pageList(pager.page, count).map((p, i) =>
                p === 'gap' ? (
                  <li key={`gap-${i}`} className="px-1 text-fg-tertiary" aria-hidden>…</li>
                ) : (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => p !== pager.page && pager.onPage!(p)}
                      aria-current={p === pager.page ? 'page' : undefined}
                      aria-label={p === pager.page ? t('table.current', { n: formatNumber(p) }) : t('table.goTo', { n: formatNumber(p) })}
                      className={cn(
                        'tabular inline-flex h-9 min-w-9 items-center justify-center rounded-sm px-2 text-sm font-medium transition-colors duration-[var(--dur-fast)] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11',
                        p === pager.page ? 'bg-primary text-primary-fg shadow-e1' : 'text-fg hover:bg-surface-hover',
                      )}
                    >
                      {formatNumber(p)}
                    </button>
                  </li>
                ),
              )}
            </ul>
            <span className="tabular px-2 text-fg sm:hidden">{t('table.pageOf', { n: formatNumber(pager.page), pages: formatNumber(count) })}</span>
          </>
        )}
        <Button size="sm" variant="secondary" className={navBtn} disabled={!pager.hasNext} onClick={pager.onNext} aria-label={t('table.next')}>
          <span className={cn('hidden', !numbered && 'sm:inline')}>{t('table.next')}</span>
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
        {numbered && (
          <Button size="sm" variant="ghost" className={navBtn} disabled={pager.page >= count} onClick={() => pager.onPage!(count)} aria-label={t('table.last')} title={t('table.last')}>
            <ChevronsRight className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        )}
      </div>
    </nav>
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
