'use client';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { ICON_PATHS } from '../model/places';
import type { PlaceIcon as Icon } from '../api/places';

/** The place's symbol (same path as inside its map pin). Decorative: the name or label next to it says what it is. */
export function PlaceGlyph({ icon, className }: { icon: Icon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={cn('size-4 shrink-0', className)}>
      <path d={ICON_PATHS[icon]} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Symbol + the icon's name, for lists and the drawer. */
export function PlaceKind({ icon, className }: { icon: Icon; className?: string }) {
  const { t } = useTranslation('places');
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-fg-secondary', className)}>
      <PlaceGlyph icon={icon} className="text-info" />
      {t(`icon.${icon}`)}
    </span>
  );
}
