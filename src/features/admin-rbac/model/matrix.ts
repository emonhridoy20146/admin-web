import type { Effective, OverrideChange, OverrideEntry, PermissionDef, Role } from '../api/rbac';

export type Effect = 'inherit' | 'allow' | 'deny';
export const ROLES = ['super_admin', 'branch_manager', 'field_staff', 'viewer'] as const satisfies readonly Role[];

export interface ModuleGroup {
  module: string;
  perms: PermissionDef[];
}

/** Catalog order is preserved; modules in first-seen order. */
export function groupByModule(catalog: PermissionDef[]): ModuleGroup[] {
  const map = new Map<string, PermissionDef[]>();
  for (const p of catalog) {
    const m = p.module ?? 'other';
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(p);
  }
  return [...map].map(([module, perms]) => ({ module, perms }));
}

/**
 * Current override effects at one level, from an effective-permissions response.
 * `level` = 'user' reads user overrides; 'branch' reads branch overrides (only visible where no user override masks them).
 */
export function currentOverrides(effective: Effective[] | undefined, level: 'user' | 'branch'): Record<string, Effect> {
  const out: Record<string, Effect> = {};
  for (const e of effective ?? []) if (e.key && e.source === level) out[e.key] = e.allowed ? 'allow' : 'deny';
  return out;
}

/** Current override effects of one role from the branch overrides list (contract 1.3.0). */
export function overridesForRole(items: OverrideEntry[] | undefined, role: string): Record<string, Effect> {
  const out: Record<string, Effect> = {};
  for (const e of items ?? []) if (e.key && e.effect && e.role === role) out[e.key] = e.effect;
  return out;
}

/** The value a key would have with `effect` applied over `base` (the inherited value). */
export function resolve(effect: Effect, base: boolean): boolean {
  return effect === 'inherit' ? base : effect === 'allow';
}

/** Diff staged edits against current overrides → minimal change list for the PUT body. */
export function toChanges(current: Record<string, Effect>, staged: Record<string, Effect>): OverrideChange[] {
  return Object.entries(staged)
    .filter(([k, e]) => (current[k] ?? 'inherit') !== e)
    .map(([key, effect]) => ({ key, effect }));
}

/** Bulk: set every non-reserved key of a module to one effect. */
export function stageModule(staged: Record<string, Effect>, group: ModuleGroup, effect: Effect): Record<string, Effect> {
  const next = { ...staged };
  for (const p of group.perms) if (!p.reserved && p.key) next[p.key] = effect;
  return next;
}
