import { describe, expect, it } from 'vitest';
import { targetsManifest } from '../manifest';
import { draftFrom, parseDraft, totals, type TargetDraft } from '../model/targets';

const today = '2026-11-17';
const ok: TargetDraft = { taka: '২৫,০০০', visits: '8', effectiveFrom: today, reason: 'Branch target for November' };

describe('daily targets (FR-COL-015)', () => {
  it('is gated by its own flag and permissions', () => {
    expect(targetsManifest.name).toBe('targets');
    expect(targetsManifest.flag).toBe('module.targets');
    expect(targetsManifest.routes?.[0]?.permission).toBe('target.view');
    expect(targetsManifest.permissions).toEqual(['target.view', 'target.manage']);
  });

  it('turns whole taka (Bangla digits too) into poisha and trims the reason', () => {
    expect(parseDraft({ ...ok, reason: '  Branch target for November ' }, today)).toEqual({ body: { amountPoisha: 2_500_000, visits: 8, effectiveFrom: today, reason: 'Branch target for November' }, errors: {} });
    expect(parseDraft({ ...ok, taka: '0', visits: '০' }, today).body).toMatchObject({ amountPoisha: 0, visits: 0 });
  });

  it('refuses bad numbers, a past start and a short reason', () => {
    expect(parseDraft({ ...ok, taka: '12.5', visits: '' }, today).errors).toEqual({ taka: 'errors.number', visits: 'errors.number' });
    expect(parseDraft({ ...ok, taka: '1000001', visits: '201' }, today).errors).toEqual({ taka: 'errors.tooBig', visits: 'errors.tooBig' });
    expect(parseDraft({ ...ok, effectiveFrom: '2026-11-16' }, today).errors).toEqual({ effectiveFrom: 'errors.past' });
    expect(parseDraft({ ...ok, effectiveFrom: '' }, today).errors).toEqual({ effectiveFrom: 'errors.date' });
    expect(parseDraft({ ...ok, reason: 'ok  ' }, today)).toEqual({ errors: { reason: 'errors.reason' } });
    expect(parseDraft({ ...ok, effectiveFrom: '2026-11-30' }, today).body?.effectiveFrom).toBe('2026-11-30');
  });

  it('prefills the form from the target in force, starting today', () => {
    expect(draftFrom({ amountPoisha: 2_500_050, visits: 7.5 }, today)).toEqual({ taka: '25001', visits: '7.5', effectiveFrom: today, reason: '' });
    expect(draftFrom(undefined, today)).toEqual({ taka: '', visits: '', effectiveFrom: today, reason: '' });
  });

  it('adds up the day for working staff only', () => {
    const items = [
      { userId: 'a', source: 'personal' as const, workingDay: true, amountPoisha: 3_000_000, visits: 10 },
      { userId: 'b', source: 'branch' as const, workingDay: true, amountPoisha: 2_500_000, visits: 8 },
      { userId: 'c', source: 'personal' as const, workingDay: false, amountPoisha: 0, visits: 0 },
    ];
    expect(totals(items)).toEqual({ amountPoisha: 5_500_000, visits: 18, working: 2, personal: 2 });
    expect(totals(undefined)).toEqual({ amountPoisha: 0, visits: 0, working: 0, personal: 0 });
  });
});
