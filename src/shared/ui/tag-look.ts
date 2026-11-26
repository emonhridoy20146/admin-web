import { Ban, CalendarX2, Flag, Footprints, Gavel, ShieldAlert, Unlink, type LucideIcon } from 'lucide-react';

/**
 * Bad-tag look (FR-W-072, 03-design-guide §2.3b, tokens v1.3 `status.tag.<key>`).
 * A customer whose tag is `tagged` with severity `bad` or `legal` gets a border (row, card, header) and a reason chip
 * in the colour of its reason. `watch`, `pending` and `none` get nothing.
 * Precedence: absconded (the strongest) → legal severity → the reason → the generic bad colour for unknown codes.
 */
export const TAG_REASON_CODES = ['plan_ended_unpaid', 'repeated_broken_promise', 'refused_to_pay', 'absconded', 'fraud_suspected', 'other'] as const;
export type TagReasonCode = (typeof TAG_REASON_CODES)[number];

export type TagLookKey = 'bad' | 'planEndedUnpaid' | 'repeatedBrokenPromise' | 'refusedToPay' | 'absconded' | 'fraudSuspected' | 'legal' | 'other';

export interface TagLook {
  key: TagLookKey;
  /** design token name (03 §2.3b) */
  token: `status.tag.${TagLookKey}`;
  /** CSS variable holding the colour */
  cssVar: `--st-tag-${string}`;
  /** classes that set the colour (`fos-tag` + modifier); add `fos-tag-box`, `fos-tag-chip` or `fos-tag-swatch` */
  className: string;
  icon: LucideIcon;
  /** common i18n key of the chip label */
  label: string;
  /** absconded: thicker border and a filled chip */
  strong: boolean;
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

const ICON: Record<TagLookKey, LucideIcon> = {
  bad: Flag,
  planEndedUnpaid: CalendarX2,
  repeatedBrokenPromise: Unlink,
  refusedToPay: Ban,
  absconded: Footprints,
  fraudSuspected: ShieldAlert,
  legal: Gavel,
  other: Flag,
};

const REASON_KEY: Record<TagReasonCode, TagLookKey> = {
  plan_ended_unpaid: 'planEndedUnpaid',
  repeated_broken_promise: 'repeatedBrokenPromise',
  refused_to_pay: 'refusedToPay',
  absconded: 'absconded',
  fraud_suspected: 'fraudSuspected',
  other: 'other',
};

export function lookFor(key: TagLookKey): TagLook {
  const k = kebab(key);
  return {
    key,
    token: `status.tag.${key}`,
    cssVar: `--st-tag-${k}`,
    className: key === 'bad' ? 'fos-tag' : `fos-tag fos-tag--${k}`,
    icon: ICON[key],
    label: `tagLook.${key}`,
    strong: key === 'absconded',
  };
}

/** The colour of one reason code (the tag dialog's swatches); unknown codes → the generic bad colour. */
export function reasonLook(reasonCode: string | null | undefined): TagLook {
  const key = reasonCode && Object.hasOwn(REASON_KEY, reasonCode) ? REASON_KEY[reasonCode as TagReasonCode] : 'bad';
  return lookFor(key);
}

export interface TagLike {
  state?: string | null;
  severity?: string | null;
  reasonCode?: string | null;
}

/** Whether the tag gets a border at all: tagged with severity bad or legal (a missing severity counts as bad). */
export function isBadTag(tag: TagLike | null | undefined): boolean {
  return tag?.state === 'tagged' && (tag.severity == null || tag.severity === 'bad' || tag.severity === 'legal');
}

/** The look of a customer's tag, or null when it gets no border. */
export function tagLookOf(tag: TagLike | null | undefined): TagLook | null {
  if (!isBadTag(tag)) return null;
  if (tag!.reasonCode === 'absconded') return lookFor('absconded');
  if (tag!.severity === 'legal') return lookFor('legal');
  return reasonLook(tag!.reasonCode);
}

/** Map pins carry only `tagged: boolean` (contract MapPin): the generic bad look until the pin carries the reason. */
export function pinTagLook(tagged: boolean | null | undefined): TagLook | null {
  return tagged ? lookFor('bad') : null;
}
