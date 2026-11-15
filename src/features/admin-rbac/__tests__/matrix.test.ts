import { describe, expect, it } from 'vitest';
import type { PermissionDef } from '../api/rbac';
import { overridesForRole, currentOverrides, groupByModule, resolve, stageModule, toChanges } from '../model/matrix';

const catalog: PermissionDef[] = [
  { key: 'tag.view', module: 'tags', defaults: { branch_manager: true } },
  { key: 'tag.set', module: 'tags', defaults: { branch_manager: true } },
  { key: 'cash.view', module: 'cash', defaults: { branch_manager: true } },
  { key: 'microfinance.view', module: 'microfinance', reserved: true, defaults: {} },
];

describe('permissions matrix model', () => {
  it('groups by module in catalog order', () => {
    expect(groupByModule(catalog).map((g) => [g.module, g.perms.length])).toEqual([['tags', 2], ['cash', 1], ['microfinance', 1]]);
  });

  it('reads overrides of one level from effective permissions', () => {
    const eff = [
      { key: 'tag.set', allowed: false, source: 'user' as const },
      { key: 'cash.view', allowed: true, source: 'branch' as const },
      { key: 'tag.view', allowed: true, source: 'role' as const },
    ];
    expect(currentOverrides(eff, 'user')).toEqual({ 'tag.set': 'deny' });
    expect(currentOverrides(eff, 'branch')).toEqual({ 'cash.view': 'allow' });
  });

  it('reads one role from the branch overrides list', () => {
    const items = [
      { role: 'field_staff' as const, key: 'tag.set', effect: 'allow' as const },
      { role: 'viewer' as const, key: 'cash.view', effect: 'deny' as const },
    ];
    expect(overridesForRole(items, 'field_staff')).toEqual({ 'tag.set': 'allow' });
    expect(overridesForRole(undefined, 'viewer')).toEqual({});
  });

  it('resolves an effect over an inherited value', () => {
    expect(resolve('inherit', true)).toBe(true);
    expect(resolve('deny', true)).toBe(false);
    expect(resolve('allow', false)).toBe(true);
  });

  it('sends only real changes, including explicit inherit to clear', () => {
    expect(toChanges({ 'tag.set': 'deny' }, { 'tag.set': 'inherit', 'tag.view': 'inherit', 'cash.view': 'allow' })).toEqual([
      { key: 'tag.set', effect: 'inherit' },
      { key: 'cash.view', effect: 'allow' },
    ]);
  });

  it('bulk-stages a module but never reserved keys', () => {
    const groups = groupByModule(catalog);
    expect(stageModule({}, groups[0]!, 'deny')).toEqual({ 'tag.view': 'deny', 'tag.set': 'deny' });
    expect(stageModule({}, groups[2]!, 'allow')).toEqual({});
  });
});
