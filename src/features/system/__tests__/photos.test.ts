import { describe, expect, it, vi } from 'vitest';
import { confirmTextFor, progressShare, runPurge } from '../model/photos';

describe('photo purge (FR-W-054)', () => {
  it('asks for DELETE and the month', () => {
    expect(confirmTextFor('2026-11')).toBe('DELETE 2026-11');
  });

  it('repeats until nothing remains and reports progress', async () => {
    const answers = [
      { deleted: 200, bytes: 2000, remaining: 250 },
      { deleted: 200, bytes: 2000, remaining: 50 },
      { deleted: 50, bytes: 500, remaining: 0 },
    ];
    const call = vi.fn(async () => answers.shift()!);
    const seen: number[] = [];
    const done = await runPurge(call, (p) => seen.push(p.deleted));
    expect(call).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([200, 400, 450]);
    expect(done).toEqual({ deleted: 450, bytes: 4500, remaining: 0 });
  });

  it('stops when the server deletes nothing but says some remain', async () => {
    const call = vi.fn(async () => ({ deleted: 0, bytes: 0, remaining: 5 }));
    await expect(runPurge(call, () => undefined)).rejects.toThrow('PURGE_STALLED');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('progress share never goes past 1', () => {
    expect(progressShare({ deleted: 200, bytes: 0, remaining: 250 }, 450)).toBeCloseTo(200 / 450);
    expect(progressShare({ deleted: 500, bytes: 0, remaining: 0 }, 450)).toBe(1);
    expect(progressShare({ deleted: 0, bytes: 0, remaining: 0 }, 0)).toBe(1);
  });
});
