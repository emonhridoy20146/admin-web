'use client';
import * as SwitchP from '@radix-ui/react-switch';
import * as CheckboxP from '@radix-ui/react-checkbox';
import * as TabsP from '@radix-ui/react-tabs';
import * as TooltipP from '@radix-ui/react-tooltip';
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as PopoverP from '@radix-ui/react-popover';
import { Check, Minus } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatNumber } from '../lib/format';

export function Switch({ className, ...p }: SwitchP.SwitchProps) {
  return (
    <SwitchP.Root
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-line-strong transition-colors duration-[var(--dur-fast)] data-[state=checked]:bg-primary disabled:opacity-50',
        "[@media(pointer:coarse)]:after:absolute [@media(pointer:coarse)]:after:-inset-3 [@media(pointer:coarse)]:after:content-['']",
        className,
      )}
      {...p}
    >
      <SwitchP.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-e1 transition-transform duration-[var(--dur-fast)] data-[state=checked]:translate-x-[18px]" />
    </SwitchP.Root>
  );
}

export function Checkbox({ className, ...p }: CheckboxP.CheckboxProps) {
  return (
    <CheckboxP.Root
      className={cn(
        'peer grid size-4 shrink-0 place-items-center rounded-xs border border-line-strong bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary text-primary-fg',
        className,
      )}
      {...p}
    >
      <CheckboxP.Indicator>{p.checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}</CheckboxP.Indicator>
    </CheckboxP.Root>
  );
}

export const Tabs = TabsP.Root;
export function TabsList({ className, ...p }: TabsP.TabsListProps) {
  return <TabsP.List className={cn('scrollbar-thin flex gap-1 overflow-x-auto border-b border-line', className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: TabsP.TabsTriggerProps) {
  return (
    <TabsP.Trigger
      className={cn(
        '-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 text-base font-medium whitespace-nowrap text-fg-secondary transition-colors hover:text-fg data-[state=active]:border-primary data-[state=active]:text-fg [@media(pointer:coarse)]:h-11',
        className,
      )}
      {...p}
    />
  );
}
export const TabsContent = TabsP.Content;

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipP.Root delayDuration={300}>
      <TooltipP.Trigger asChild>{children}</TooltipP.Trigger>
      <TooltipP.Portal>
        <TooltipP.Content side={side} sideOffset={6} className="z-[70] max-w-xs rounded-sm bg-neutral-900 px-2 py-1 text-xs text-white shadow-e2 animate-fade dark:bg-surface-raised dark:text-fg" style={{ background: 'var(--neutral-900)' }}>
          {content}
        </TooltipP.Content>
      </TooltipP.Portal>
    </TooltipP.Root>
  );
}
export const TooltipProvider = TooltipP.Provider;

export const DropdownMenu = Menu.Root;
export const DropdownTrigger = Menu.Trigger;
export function DropdownContent({ className, align = 'end', ...p }: Menu.DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Content align={align} sideOffset={6} className={cn('z-50 min-w-52 rounded-md border border-line bg-surface-raised p-1 shadow-e2 animate-pop', className)} {...p} />
    </Menu.Portal>
  );
}
export function DropdownItem({ className, ...p }: Menu.DropdownMenuItemProps) {
  return <Menu.Item className={cn('flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-base text-fg outline-none data-[highlighted]:bg-surface-hover data-[disabled]:opacity-50 [@media(pointer:coarse)]:h-11', className)} {...p} />;
}
export function DropdownLabel({ className, ...p }: Menu.DropdownMenuLabelProps) {
  return <Menu.Label className={cn('px-2 pt-2 pb-1 text-xs font-medium text-fg-tertiary', className)} {...p} />;
}
export function DropdownSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />;
}

export const Popover = PopoverP.Root;
export const PopoverTrigger = PopoverP.Trigger;
export function PopoverContent({ className, align = 'end', ...p }: PopoverP.PopoverContentProps) {
  return (
    <PopoverP.Portal>
      <PopoverP.Content align={align} sideOffset={8} className={cn('z-50 rounded-md border border-line bg-surface-raised shadow-e2 animate-pop', className)} {...p} />
    </PopoverP.Portal>
  );
}

export function FilterChip({ selected, onClick, children, count }: { selected: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-[var(--dur-fast)] [@media(pointer:coarse)]:h-11',
        selected ? 'border-primary/30 bg-primary-subtle text-primary-subtle-fg' : 'border-line bg-surface text-fg-secondary hover:border-line-strong hover:text-fg',
      )}
    >
      {selected && <Check className="size-3.5" aria-hidden strokeWidth={2.5} />}
      {children}
      {count != null && <span className={cn('tabular rounded-full px-1.5 text-xs', selected ? 'bg-primary/10' : 'bg-surface-hover')}>{count}</span>}
    </button>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
  const tones = ['bg-primary-subtle text-primary-subtle-fg', 'bg-st-paid-bg text-st-paid', 'bg-st-promised-bg text-st-promised', 'bg-st-due-today-bg text-st-due-today', 'bg-info-bg text-info'];
  return (
    <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold', tones[hue], className)}>
      {initials}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-surface-subtle px-1 font-mono text-[11px] text-fg-tertiary">{children}</kbd>;
}

/** Segmented control (single choice, few options). Labels and counts come from the caller. */
export function Segmented<V extends string>({ value, options, onChange, label, className }: { value: V; options: { value: V; label: React.ReactNode; count?: number }[]; onChange: (v: V) => void; label: string; className?: string }) {
  return (
    <div className={cn('inline-flex w-fit max-w-full overflow-x-auto rounded-md border border-line bg-surface p-0.5 shadow-e1', className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium whitespace-nowrap [@media(pointer:coarse)]:h-10', value === o.value ? 'bg-primary-subtle text-primary-subtle-fg' : 'text-fg-secondary hover:text-fg')}
        >
          {o.label}
          {o.count != null && o.count > 0 && <span className="tabular rounded-full bg-surface-subtle px-1.5 text-xs text-fg-secondary">{formatNumber(o.count)}</span>}
        </button>
      ))}
    </div>
  );
}
