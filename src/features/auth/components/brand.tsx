import { cn } from '@/shared/lib/cn';

/** Monogram mark: an "H" whose right stem ends in a location dot. Drawn with tokens only. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M10 8.5v15M22 8.5v11M10 16h12" className="stroke-primary-fg" strokeWidth={3} strokeLinecap="round" fill="none" />
      <circle cx="22" cy="24" r="2.6" className="fill-brand-200" />
    </svg>
  );
}
