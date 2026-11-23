import { describe, expect, it } from 'vitest';
import { prospectsManifest } from '../manifest';
import { actionsFor, displayPhone, reentryOf } from '../model/prospect';

describe('prospects (FR-PRO-001)', () => {
  it('is behind its flag and permissions from the catalog', () => {
    expect(prospectsManifest.flag).toBe('module.prospects');
    expect(prospectsManifest.permissions).toEqual(['prospect.view', 'prospect.manage', 'prospect.create']);
  });
  it('offers the actions each status allows', () => {
    expect(actionsFor('new')).toEqual(['contacted', 'convert', 'dropped']);
    expect(actionsFor('contacted')).toEqual(['convert', 'dropped']);
    expect(actionsFor('converted')).toEqual(['reopen', 'reentry']);
    expect(actionsFor('dropped')).toEqual(['reopen', 'reentry']);
  });
  it('shows phones the local way', () => {
    expect(displayPhone('+8801712345678')).toBe('01712-345678');
    expect(displayPhone('01812345678')).toBe('01812-345678');
    expect(displayPhone('12345')).toBe('12345');
  });
  it('makes a re-entry that points back to the old prospect', () => {
    const p = { id: 'p1', name: 'Rahim', phones: [{ number: '+8801712345678', label: null }], address: 'Galachipa', note: null, branchId: 'b1' } as never;
    expect(reentryOf(p, 'c1')).toEqual({ clientId: 'c1', name: 'Rahim', phones: [{ number: '+8801712345678' }], address: 'Galachipa', note: undefined, branchId: 'b1', fromProspectId: 'p1' });
  });
});
