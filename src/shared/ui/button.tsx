'use client';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-e1',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-hover shadow-e1',
  ghost: 'text-fg-secondary hover:bg-surface-hover hover:text-fg',
  subtle: 'bg-primary-subtle text-primary-subtle-fg hover:bg-primary-subtle-hover',
  destructive: 'bg-danger text-white hover:opacity-90 shadow-e1',
  link: 'text-primary hover:underline underline-offset-4 px-0 h-auto',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-sm',
  md: 'h-10 px-4 text-base gap-2 rounded-sm',
  lg: 'h-11 px-5 text-base gap-2 rounded-md',
  icon: 'h-10 w-10 rounded-sm',
  'icon-sm': 'h-8 w-8 rounded-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background,color,box-shadow,opacity] duration-[var(--dur-fast)] select-none',
        'disabled:opacity-50 [@media(pointer:coarse)]:min-h-11',
        size.startsWith('icon') && '[@media(pointer:coarse)]:min-w-11',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
