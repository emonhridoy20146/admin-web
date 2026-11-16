import { describe, expect, it } from 'vitest';
import { erpLevel, sortSync, syncCounts, syncLevel } from '../model/system';

const now = new Date('2026-11-16T06:00:00Z');
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();

describe('system health', () => {
  it('grades the ERP link', () => {
    expect(erpLevel({ lagSec: 120, circuit: 'closed', mode: 'live', outboxFailed: 0 })).toBe('ok');
    expect(erpLevel({ lagSec: 1200, circuit: 'closed', mode: 'live', outboxFailed: 0 })).toBe('warn');
    expect(erpLevel({ lagSec: 100, circuit: 'closed', mode: 'live', outboxFailed: 2 })).toBe('warn');
    expect(erpLevel({ lagSec: 100, circuit: 'open', mode: 'live', outboxFailed: 0 })).toBe('bad');
    expect(erpLevel({ lagSec: 4000, circuit: 'closed', mode: 'live', outboxFailed: 0 })).toBe('bad');
    expect(erpLevel(undefined)).toBe('warn');
  });

  it('grades a phone by error, unsent work and silence', () => {
    expect(syncLevel({ lastPullAt: ago(3), lastPushAt: ago(5), pendingReported: 0 }, now)).toBe('ok');
    expect(syncLevel({ lastPullAt: ago(3), lastPushAt: ago(5), pendingReported: 2 }, now)).toBe('warn');
    expect(syncLevel({ lastPullAt: ago(90), lastPushAt: ago(5), pendingReported: 0 }, now)).toBe('warn');
    expect(syncLevel({ lastPullAt: ago(3), lastPushAt: ago(120), pendingReported: 2 }, now)).toBe('bad');
    expect(syncLevel({ lastPullAt: ago(3), lastPushAt: ago(5), pendingReported: 0, lastError: 'x' }, now)).toBe('bad');
  });

  it('sorts problems first and totals unsent work', () => {
    const rows = [
      { userName: 'A', lastPullAt: ago(3), lastPushAt: ago(5), pendingReported: 0 },
      { userName: 'B', lastPullAt: ago(3), lastPushAt: ago(200), pendingReported: 4 },
      { userName: 'C', lastPullAt: ago(3), lastPushAt: ago(5), pendingReported: 1 },
    ];
    expect(sortSync(rows, now).map((r) => r.userName)).toEqual(['B', 'C', 'A']);
    expect(syncCounts(rows, now)).toEqual({ ok: 1, warn: 1, bad: 1, pending: 5 });
  });
});
