'use client';
import { forwardRef, useId } from 'react';
import { ChevronDown, CircleAlert, Search } from 'lucide-react';
import { cn } from '../lib/cn';

const control =
  'w-full rounded-sm border border-line-strong bg-surface text-base text-fg placeholder:text-fg-disabled shadow-e1 transition-[border-color,box-shadow] duration-[var(--dur-fast)] hover:border-fg-disabled focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:bg-surface-hover disabled:text-fg-disabled aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, 'h-10 px-3 [@media(pointer:coarse)]:h-11', className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-24 px-3 py-2 leading-relaxed', className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <span className="relative block">
      <select ref={ref} className={cn(control, 'h-10 appearance-none pe-9 ps-3 [@media(pointer:coarse)]:h-11', className)} {...p}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden />
    </span>
  );
});

export const SearchInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function SearchInput({ className, ...p }, ref) {
  return (
    <span className={cn('relative block', className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden />
      <input ref={ref} type="search" className={cn(control, 'h-10 ps-9 pe-3 [@media(pointer:coarse)]:h-11')} {...p} />
    </span>
  );
});

/** Label above input, helper 12 px, error 12 px danger with icon (03 §5.2). */
export function Field({ label, help, error, children, required, counter }: { label: string; help?: string; error?: string; required?: boolean; counter?: string; children: (id: string, describedBy?: string) => React.ReactNode }) {
  const id = useId();
  const hid = `${id}-h`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-base font-medium text-fg">
          {label}
          {required && <span className="ms-0.5 text-danger" aria-hidden>*</span>}
        </label>
        {counter && <span className="tabular text-xs text-fg-tertiary">{counter}</span>}
      </div>
      {children(id, help || error ? hid : undefined)}
      {error ? (
        <p id={hid} className="flex items-center gap-1 text-xs text-danger">
          <CircleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      ) : help ? (
        <p id={hid} className="text-xs text-fg-secondary">{help}</p>
      ) : null}
    </div>
  );
}
