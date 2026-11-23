import { describe, expect, it } from 'vitest';
import type { components } from '@/shared/api/schema';
import { runErpSync } from '../api/queries';
import { syncProblems } from '../components/erp-sync-button';

type R = components['schemas']['ErpSyncResult'];
const round = (x: Partial<R>): R => ({ customers: 0, branches: 3, partial: false, finishedAt: '2026-11-23T06:00:00Z', ...x });
const t = (key: string, o?: Record<string, unknown>) => `${key}:${String(o?.n ?? '')}`;

describe('Sync from ERP (contract 1.44.0)', () => {
  it('keeps calling until partial is false, well past the old 30-round stop', async () => {
    let calls = 0;
    const progress: number[] = [];
    const r = await runErpSync(async () => {
      calls += 1;
      return round({ customers: 10, partial: calls < 45, skipped: calls === 3 ? 2 : 0, failedBranches: calls < 45 ? 1 : 0 });
    }, (n) => progress.push(n));
    expect(calls).toBe(45);
    expect(r).toMatchObject({ customers: 450, partial: false, skipped: 2, failedBranches: 0, rounds: 45 });
    expect(progress.at(-1)).toBe(450);
  });

  it('reports the last round\'s failed branches and works with a server before 1.44.0', async () => {
    const a = await runErpSync(async () => round({ customers: 5, failedBranches: 2 }));
    expect(a).toMatchObject({ skipped: 0, failedBranches: 2 });
    const old = await runErpSync(async () => round({ customers: 5 }));
    expect(old).toMatchObject({ skipped: 0, failedBranches: 0 });
  });

  it('stops at the safety limit and says it is still partial', async () => {
    const r = await runErpSync(async () => round({ partial: true }), undefined, 4);
    expect(r).toMatchObject({ partial: true, rounds: 4 });
  });

  it('shows skipped rows and failed branches only when either is above 0', () => {
    expect(syncProblems({ skipped: 0, failedBranches: 0 }, t)).toBeNull();
    expect(syncProblems({ skipped: 3, failedBranches: 0 }, t)).toBe('erp.syncSkipped:3');
    expect(syncProblems({ skipped: 0, failedBranches: 1 }, t)).toBe('erp.syncFailedBranches:1');
    expect(syncProblems({ skipped: 1, failedBranches: 2 }, t)).toBe('erp.syncSkipped:1 erp.syncFailedBranches:2');
  });
});
