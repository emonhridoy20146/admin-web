'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, OctagonX, RotateCw, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { isApiError } from '../api/problem';
import { Button } from './button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4', className)} aria-hidden />;
}

/** Empty state: icon + one sentence + action. No emoji, no illustration (03 §5.1). */
export function EmptyState({ icon: Icon, title, body, action, className }: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="mb-3 grid size-11 place-items-center rounded-full border border-line bg-surface-subtle text-fg-tertiary">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-base font-medium text-fg">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-fg-tertiary">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function useErrorMessage() {
  const { t } = useTranslation();
  return (e: unknown) => (isApiError(e) ? t(e.messageKey, { defaultValue: e.message }) : t('errors.GENERIC'));
}

/** Inline error banner with retry and requestId copy (FR-W-011). Errors are never toasts. */
export function ErrorBanner({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation();
  const msg = useErrorMessage()(error);
  const [copied, setCopied] = useState(false);
  const rid = isApiError(error) ? error.requestId : undefined;
  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-3 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger', className)}>
      <OctagonX className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 font-medium">{msg}</span>
      {rid && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 font-mono text-xs opacity-80 hover:bg-white/40 hover:opacity-100"
          onClick={() => {
            void navigator.clipboard?.writeText(isApiError(error) ? error.toClipboard() : rid);
            setCopied(true);
          }}
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {t('errors.copyDetails')} · {rid}
        </button>
      )}
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <RotateCw className="size-3.5" aria-hidden />
          {t('actions.retry')}
        </Button>
      )}
    </div>
  );
}
