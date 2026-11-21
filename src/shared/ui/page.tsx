'use client';
import Link from 'next/link';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { formatTime, formatRelative } from '../lib/format';
import { Tooltip } from './primitives';
import { PrintButton } from './print';

/**
 * `print` adds the "Print / PDF" button after the page's own actions (FR-W-045): `true` names the file after the
 * page title, a string gives the file name (e.g. title plus the period in view).
 */
export function PageHeader({ title, crumbs, asOf, actions, children, className, print }: { title: React.ReactNode; crumbs?: { label: string; href?: string }[]; asOf?: string | null; actions?: React.ReactNode; children?: React.ReactNode; className?: string; print?: boolean | string }) {
  const printName = typeof print === 'string' ? print : typeof title === 'string' ? title : undefined;
  return (
    <header className={cn('mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="breadcrumb" className="mb-1 flex items-center gap-1 text-sm text-fg-tertiary">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                {c.href ? <Link href={c.href} className="hover:text-fg">{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight text-fg lg:text-2xl">{title}</h1>
        {(asOf || children) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-tertiary">
            {asOf && <AsOf at={asOf} />}
            {children}
          </div>
        )}
      </div>
      {(actions || print) && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {actions}
          {print && <PrintButton name={printName} />}
        </div>
      )}
    </header>
  );
}

/** "as of 10:42" freshness for ERP-derived values (FR-W-007). */
export function AsOf({ at, className }: { at: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <Tooltip content={formatRelative(at)}>
      <span className={cn('inline-flex items-center gap-1 text-sm text-fg-tertiary', className)} tabIndex={0}>
        <RefreshCw className="size-3" aria-hidden />
        {t('asOf', { time: formatTime(at) })}
      </span>
    </Tooltip>
  );
}

export function Section({ title, actions, children, className }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-fg">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function DescList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-sm text-fg-tertiary">{it.label}</dt>
          <dd className="mt-0.5 truncate text-base text-fg">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
