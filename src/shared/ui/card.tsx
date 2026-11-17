import { cn } from '../lib/cn';

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-md border border-line bg-surface shadow-e1', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className="text-md font-semibold text-fg">{title}</h2>
        {subtitle && <p className="text-sm text-fg-tertiary">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 print:hidden">{actions}</div>}
    </div>
  );
}
