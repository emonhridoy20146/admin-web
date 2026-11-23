'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * FR-W-061: a map (or any panel) shown on the whole screen. Uses the Fullscreen API on the element; where it is missing
 * or refused (iPhone Safari, an iframe without permission) the element is pinned over the viewport instead
 * (`fallback` = true: the caller adds `FULLSCREEN_FALLBACK`). Esc leaves both kinds. While open, the page behind does
 * not scroll.
 */
export function useFullscreen(ref: React.RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const sync = () => setNative(!!document.fullscreenElement && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [ref]);

  useEffect(() => {
    if (!fallback) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFallback(false);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [fallback]);

  const enter = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.requestFullscreen === 'function' && document.fullscreenEnabled !== false) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        return;
      } catch {
        /* refused: fall back to covering the viewport */
      }
    }
    setFallback(true);
  }, [ref]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setFallback(false);
  }, []);

  const active = native || fallback;
  return { active, fallback, enter, exit, toggle: active ? exit : enter };
}

/** Classes for the element while it covers the viewport without the Fullscreen API (z above the header, below dialogs). */
export const FULLSCREEN_FALLBACK = 'fixed inset-0 z-[45] h-dvh w-screen bg-bg p-0';

/** The button on the map: "Full screen" with an icon; when open, an obvious "Exit full screen". */
export function FullscreenButton({ active, onClick, className }: { active: boolean; onClick: () => void; className?: string }) {
  const { t } = useTranslation();
  const Icon = active ? Minimize2 : Maximize2;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? t('map.exitFullscreenHint') : t('map.fullscreen')}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium shadow-e2 transition-colors duration-[var(--dur-fast)]',
        active ? 'border-primary bg-primary text-primary-fg hover:bg-primary-hover' : 'border-line bg-surface text-fg hover:bg-surface-hover',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span>{active ? t('map.exitFullscreen') : t('map.fullscreen')}</span>
    </button>
  );
}
