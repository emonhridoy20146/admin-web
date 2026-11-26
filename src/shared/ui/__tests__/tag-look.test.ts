import { describe, expect, it } from 'vitest';
import { isBadTag, lookFor, pinTagLook, reasonLook, tagLookOf, TAG_REASON_CODES } from '../tag-look';

/** FR-W-072: reason → token mapper (03 §2.3b, tokens v1.3 `status.tag.<key>`). */
describe('reasonLook', () => {
  it.each([
    ['plan_ended_unpaid', 'planEndedUnpaid', '--st-tag-plan-ended-unpaid'],
    ['repeated_broken_promise', 'repeatedBrokenPromise', '--st-tag-repeated-broken-promise'],
    ['refused_to_pay', 'refusedToPay', '--st-tag-refused-to-pay'],
    ['absconded', 'absconded', '--st-tag-absconded'],
    ['fraud_suspected', 'fraudSuspected', '--st-tag-fraud-suspected'],
    ['other', 'other', '--st-tag-other'],
  ])('%s → status.tag.%s', (code, key, cssVar) => {
    const look = reasonLook(code);
    expect(look.key).toBe(key);
    expect(look.token).toBe(`status.tag.${key}`);
    expect(look.cssVar).toBe(cssVar);
    expect(look.className).toBe(`fos-tag fos-tag--${cssVar.replace('--st-tag-', '')}`);
    expect(look.label).toBe(`tagLook.${key}`);
  });

  it('falls back to the generic bad colour for unknown, empty or prototype-ish codes', () => {
    for (const code of ['moved_away', '', null, undefined, 'toString', '__proto__', 'cleared', 'mistake']) {
      const look = reasonLook(code);
      expect(look.key).toBe('bad');
      expect(look.token).toBe('status.tag.bad');
      expect(look.cssVar).toBe('--st-tag-bad');
      expect(look.className).toBe('fos-tag');
    }
  });

  it('gives every reason its own colour, and only absconded is strong', () => {
    const vars = TAG_REASON_CODES.map((c) => reasonLook(c).cssVar);
    expect(new Set(vars).size).toBe(TAG_REASON_CODES.length);
    expect(vars).not.toContain(lookFor('legal').cssVar);
    expect(TAG_REASON_CODES.filter((c) => reasonLook(c).strong)).toEqual(['absconded']);
  });
});

describe('tagLookOf', () => {
  it('borders only tagged customers with severity bad or legal', () => {
    expect(tagLookOf(null)).toBeNull();
    expect(tagLookOf({ state: 'none' })).toBeNull();
    expect(tagLookOf({ state: 'pending', severity: 'bad', reasonCode: 'absconded' })).toBeNull();
    expect(tagLookOf({ state: 'tagged', severity: 'watch', reasonCode: 'absconded' })).toBeNull();
    expect(tagLookOf({ state: 'tagged', severity: 'bad', reasonCode: 'refused_to_pay' })?.key).toBe('refusedToPay');
    expect(isBadTag({ state: 'tagged' })).toBe(true); // missing severity counts as bad
  });

  it('legal severity has its own colour, whatever the reason', () => {
    expect(tagLookOf({ state: 'tagged', severity: 'legal', reasonCode: 'refused_to_pay' })?.token).toBe('status.tag.legal');
    expect(tagLookOf({ state: 'tagged', severity: 'legal', reasonCode: 'unknown_code' })?.token).toBe('status.tag.legal');
  });

  it('absconded is the strongest: it wins over legal', () => {
    const look = tagLookOf({ state: 'tagged', severity: 'legal', reasonCode: 'absconded' });
    expect(look?.key).toBe('absconded');
    expect(look?.strong).toBe(true);
  });

  it('unknown codes on a bad tag get the generic bad colour', () => {
    expect(tagLookOf({ state: 'tagged', severity: 'bad', reasonCode: 'something_new' })?.token).toBe('status.tag.bad');
  });

  it('map pins (tagged boolean only) get the generic look', () => {
    expect(pinTagLook(true)?.key).toBe('bad');
    expect(pinTagLook(false)).toBeNull();
    expect(pinTagLook(undefined)).toBeNull();
  });
});
