import type { TriValue } from '@/shared/ui/tri-state';
import type { FeatureFlag } from '../api/flags';

export type Overrides = Record<string, boolean>;

export function overridesOf(f: FeatureFlag): Overrides {
  return Object.fromEntries((f.branchOverrides ?? []).filter((o) => o.branchId).map((o) => [o.branchId!, !!o.enabled]));
}

export function triOf(o: Overrides, branchId: string): TriValue {
  return branchId in o ? (o[branchId] ? 'on' : 'off') : 'inherit';
}

export function applyTri(o: Overrides, branchId: string, v: TriValue): Overrides {
  const next = { ...o };
  if (v === 'inherit') delete next[branchId];
  else next[branchId] = v === 'on';
  return next;
}

export function toBody(o: Overrides): { branchId: string; enabled: boolean }[] {
  return Object.entries(o).map(([branchId, enabled]) => ({ branchId, enabled }));
}

/** Is the module on for this branch? (Flags default OFF: no flag → off.) */
export function isOnFor(defaultEnabled: boolean | undefined, o: Overrides, branchId: string): boolean {
  return branchId in o ? !!o[branchId] : !!defaultEnabled;
}

export function sameOverrides(a: Overrides, b: Overrides): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.join() === kb.join() && ka.every((k) => a[k] === b[k]);
}
