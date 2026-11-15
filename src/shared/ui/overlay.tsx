'use client';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Button } from './button';

export function Dialog({ open, onOpenChange, title, description, children, footer, className, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; className?: string; wide?: boolean }) {
  const { t } = useTranslation();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade" />
        <D.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-xl border border-line bg-surface-raised shadow-e3 animate-pop focus:outline-none',
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg',
            wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
            className,
          )}
        >
          <div className="flex items-start gap-3 px-5 pt-5 pb-3">
            <div className="min-w-0 flex-1">
              <D.Title className="text-lg font-semibold text-fg">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-base text-fg-secondary">{description}</D.Description> : <D.Description className="sr-only">{typeof title === 'string' ? title : ''}</D.Description>}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('actions.close')}>
                <X className="size-4" />
              </Button>
            </D.Close>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Row detail drawer (03 §5.6): 480 px side panel on desktop, full screen on mobile; Esc closes, focus returns. */
export function Drawer({ open, onOpenChange, title, subtitle, headerExtra, children, footer, width = 480 }: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; subtitle?: React.ReactNode; headerExtra?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  const { t } = useTranslation();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade lg:bg-overlay/40" />
        <D.Content
          style={{ ['--drawer-w' as string]: `${width}px` }}
          className="fixed inset-0 z-40 flex flex-col bg-surface-raised shadow-e3 animate-drawer focus:outline-none lg:inset-y-0 lg:start-auto lg:end-0 lg:w-[var(--drawer-w)] lg:max-w-[100vw] lg:border-s lg:border-line"
        >
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <D.Title className="truncate text-md font-semibold text-fg">{title}</D.Title>
              {subtitle ? <D.Description className="mt-0.5 text-sm text-fg-tertiary">{subtitle}</D.Description> : <D.Description className="sr-only">{typeof title === 'string' ? title : ''}</D.Description>}
              {headerExtra && <div className="mt-2">{headerExtra}</div>}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('actions.close')}>
                <X className="size-4" />
              </Button>
            </D.Close>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
