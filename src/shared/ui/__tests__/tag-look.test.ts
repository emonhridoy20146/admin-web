import { describe, expect, it } from 'vitest';
import { isBadTag, lookFor, pinTagLook, reasonLook, tagLookOf, TAG_REASON_CODES } from '../tag-look';

/** FR-W-072: reason → token mapper (03 §2.3b, shared tokens v1.3 `status.tag.<reasonCode | legal>`). */
describe('reasonLook', () => {
  it.each([
    ['plan_ended_unpaid', '--st-tag-plan-ended-unpaid'],
    ['repeated_broken_promise', '--st-tag-repeated-broken-promise'],
    ['refused_to_pay', '--st-tag-refused-to-pay'],
    ['absconded', '--st-tag-absconded'],
    ['fraud_suspected', '--st-tag-fraud-suspected'],
    ['other', '--st-tag-other'],
  ])('%s → status.tag.%s', (code, cssVar) => {
    const look = reasonLook(code);
    expect(look.key).toBe(code);
    expect(look.token).toBe(`status.tag.${code}`);
    expect(look.cssVar).toBe(cssVar);
    expect(look.className).toBe(`fos-tag fos-tag--${cssVar.replace('--st-tag-', '')}`);
    expect(look.label).toBe(`tagLook.${code}`);
  });

  it('falls back to `other` (the generic bad colour) for unknown, empty or prototype-ish codes', () => {
    for (const code of ['moved_away', '', null, undefined, 'toString', '__proto__', 'cleared', 'mistake', 'legal']) {
      const look = reasonLook(code);
      expect(look.key).toBe('other');
      expect(look.token).toBe('status.tag.other');
      expect(look.cssVar).toBe('--st-tag-other');
    }
  });

  it('gives every reason and legal its own token, and only absconded is strong', () => {
    const tokens = [...TAG_REASON_CODES.map((c) => reasonLook(c).token), lookFor('legal').token];
    expect(new Set(tokens).size).toBe(TAG_REASON_CODES.length + 1);
    expect(tokens).not.toContain('status.tag.bad');
    expect(TAG_REASON_CODES.filter((c) => reasonLook(c).strong)).toEqual(['absconded']);
  });
});

describe('tagLookOf', () => {
  it('frames tagged customers unless the severity is watch', () => {
    expect(tagLookOf(null)).toBeNull();
    expect(tagLookOf({ state: 'none' })).toBeNull();
    expect(tagLookOf({ state: 'pending', severity: 'bad', reasonCode: 'absconded' })).toBeNull();
    expect(tagLookOf({ state: 'tagged', severity: 'watch', reasonCode: 'absconded' })).toBeNull();
    expect(tagLookOf({ state: 'tagged', severity: 'bad', reasonCode: 'refused_to_pay' })?.key).toBe('refused_to_pay');
    // a missing or unknown severity counts as bad
    expect(isBadTag({ state: 'tagged' })).toBe(true);
    expect(isBadTag({ state: 'tagged', severity: 'severe' })).toBe(true);
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

  it('unknown or missing codes on a bad tag get `other`', () => {
    expect(tagLookOf({ state: 'tagged', severity: 'bad', reasonCode: 'something_new' })?.token).toBe('status.tag.other');
    expect(tagLookOf({ state: 'tagged', severity: 'bad' })?.token).toBe('status.tag.other');
  });

  it('map pins use MapPin.tag (1.52.0) and fall back to `tagged` from an older server', () => {
    expect(pinTagLook({ tagged: true, tag: { state: 'tagged', severity: 'bad', reasonCode: 'fraud_suspected' } })?.key).toBe('fraud_suspected');
    expect(pinTagLook({ tagged: true, tag: { state: 'tagged', severity: 'watch', reasonCode: 'absconded' } })).toBeNull();
    expect(pinTagLook({ tagged: false, tag: { state: 'none' } })).toBeNull();
    expect(pinTagLook({ tagged: true })?.key).toBe('other');
    expect(pinTagLook({ tagged: false })).toBeNull();
    expect(pinTagLook(undefined)).toBeNull();
  });
});
