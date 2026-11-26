import { Ban, CalendarX, Flag, Footprints, Gavel, HeartCrack, ShieldAlert, type LucideIcon } from 'lucide-react';

/**
 * Bad-tag look (FR-W-072, 03-design-guide §2.3b, shared tokens v1.3 `status.tag.<key>`, identical in staff-app).
 * A customer whose tag is `tagged` with any severity but `watch` (a missing or unknown severity counts as bad) gets a
 * frame (row, card, header) and a reason chip in the colours of its kind. `watch`, `pending` and `none` get nothing.
 * Precedence: absconded → legal (the severity) → the reason → `other` (also the fallback for unknown or missing codes).
 * Staff-app also treats a latest visit outcome `runaway` as absconded; admin list items carry no visit outcome, so the
 * panel does not (ADR-W30).
 */
export const TAG_REASON_CODES = ['plan_ended_unpaid', 'repeated_broken_promise', 'refused_to_pay', 'absconded', 'fraud_suspected', 'other'] as const;
export type TagReasonCode = (typeof TAG_REASON_CODES)[number];

/** Token keys: the contract's reasonCode values plus `legal` (the severity). */
export type TagLookKey = TagReasonCode | 'legal';

export interface TagLook {
  key: TagLookKey;
  /** design token name (03 §2.3b) */
  token: `status.tag.${TagLookKey}`;
  /** CSS variable prefix: `<cssVar>-fg` (frame, icon, chip text) and `<cssVar>-bg` (chip tint) */
  cssVar: `--st-tag-${string}`;
  /** classes that set the colours (`fos-tag` + modifier); add `fos-tag-box`, `fos-tag-chip` or `fos-tag-swatch` */
  className: string;
  icon: LucideIcon;
  /** common i18n key of the chip label */
  label: `tagLook.${TagLookKey}`;
  /** absconded: thicker frame and a filled chip */
  strong: boolean;
}

const ICON: Record<TagLookKey, LucideIcon> = {
  absconded: Footprints,
  legal: Gavel,
  refused_to_pay: Ban,
  other: Flag,
  fraud_suspected: ShieldAlert,
  repeated_broken_promise: HeartCrack,
  plan_ended_unpaid: CalendarX,
};

export function lookFor(key: TagLookKey): TagLook {
  const k = key.replace(/_/g, '-');
  return {
    key,
    token: `status.tag.${key}`,
    cssVar: `--st-tag-${k}`,
    className: `fos-tag fos-tag--${k}`,
    icon: ICON[key],
    label: `tagLook.${key}`,
    strong: key === 'absconded',
  };
}

/** The look of one reason code (the tag dialog's swatches); unknown or missing codes → `other`. */
export function reasonLook(reasonCode: string | null | undefined): TagLook {
  const known = reasonCode != null && (TAG_REASON_CODES as readonly string[]).includes(reasonCode);
  return lookFor(known ? (reasonCode as TagReasonCode) : 'other');
}

export interface TagLike {
  state?: string | null;
  severity?: string | null;
  reasonCode?: string | null;
}

/** A bad tag: state `tagged` and severity not `watch` (a missing or unknown severity counts as bad). */
export function isBadTag(tag: TagLike | null | undefined): boolean {
  return tag?.state === 'tagged' && tag.severity !== 'watch';
}

/** The look of a customer's tag, or null when it gets no frame. */
export function tagLookOf(tag: TagLike | null | undefined): TagLook | null {
  if (!isBadTag(tag)) return null;
  if (tag!.reasonCode === 'absconded') return lookFor('absconded');
  if (tag!.severity === 'legal') return lookFor('legal');
  return reasonLook(tag!.reasonCode);
}

/**
 * Map pins: `MapPin.tag` (contract 1.52.0, a `TagSummary`) decides like any other list. An older server sends only
 * `tagged: boolean`; then a tagged pin gets the generic look (`other`).
 */
export function pinTagLook(pin: { tag?: TagLike | null; tagged?: boolean | null } | null | undefined): TagLook | null {
  if (pin?.tag) return tagLookOf(pin.tag);
  return pin?.tagged ? lookFor('other') : null;
}
