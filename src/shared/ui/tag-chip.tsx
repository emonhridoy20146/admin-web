'use client';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { tagLookOf, type TagLike, type TagLook } from './tag-look';

/** Reason chip next to a bad-tagged customer's name (FR-W-072): colour + icon + label, never colour alone. */
export function TagChip({ tag, look: given, className }: { tag?: TagLike | null; look?: TagLook | null; className?: string }) {
  const { t } = useTranslation();
  const look = given ?? tagLookOf(tag);
  if (!look) return null;
  const Icon = look.icon;
  return (
    <span
      className={cn('fos-tag-chip inline-flex h-[22px] shrink-0 items-center gap-1 rounded-xs px-1.5 text-xs font-medium whitespace-nowrap', look.className, className)}
      data-testid="tag-chip"
      data-tag={look.key}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden strokeWidth={2.25} />
      {t(look.label)}
    </span>
  );
}

/** The `fos-tag fos-tag--<kind> fos-tag-box` classes for a card/list item of a customer with this tag ('' when it has none). */
export function tagBoxClass(tag: TagLike | null | undefined): string {
  const look = tagLookOf(tag);
  return look ? `${look.className} fos-tag-box` : '';
}
