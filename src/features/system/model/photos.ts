import type { PurgeResult } from '../api/photos';

/** What the admin types to delete the photos before `before` (field-api checks the same text). */
export const confirmTextFor = (before: string): string => `DELETE ${before}`;

/** Deposit slips and refund proofs: kept unless the admin asks for them too. */
export const MONEY_PROOF_KINDS = ['deposit_slip', 'refund_proof'];

export interface PurgeProgress {
  deleted: number;
  bytes: number;
  remaining: number;
}

/**
 * Calls POST /media/purge until nothing remains (each call deletes at most 200). Stops with an error if a call deletes
 * nothing while photos remain, so a server that cannot delete never loops the browser forever.
 */
export async function runPurge(call: () => Promise<PurgeResult>, onProgress: (p: PurgeProgress) => void, maxCalls = 500): Promise<PurgeProgress> {
  const p: PurgeProgress = { deleted: 0, bytes: 0, remaining: 0 };
  for (let i = 0; i < maxCalls; i++) {
    const r = await call();
    p.deleted += r.deleted;
    p.bytes += r.bytes;
    p.remaining = r.remaining;
    onProgress({ ...p });
    if (r.remaining <= 0) return p;
    if (r.deleted === 0) throw new Error('PURGE_STALLED');
  }
  throw new Error('PURGE_STALLED');
}

/** 0..1 share done, for the progress bar; `total` is the preview count when the delete started. */
export function progressShare(p: PurgeProgress, total: number): number {
  const all = Math.max(total, p.deleted + p.remaining);
  return all ? Math.min(1, p.deleted / all) : 1;
}
