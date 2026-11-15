import { describe, expect, it } from 'vitest';
import {
  changedKeys,
  emptyForm,
  fromUser,
  normalizePhone,
  toCreate,
  toPoisha,
  toUpdate,
  validate,
} from '../model/user-form';

const valid = {
  ...emptyForm('b1'),
  nameBn: 'রহিম',
  nameEn: 'Rahim',
  phone: '01712345678',
  employeeCode: 'FS-01',
};

describe('user form model', () => {
  it('normalises Bangla digits and country code in phone numbers', () => {
    expect(normalizePhone('০১৭১২-৩৪৫৬৭৮')).toBe('01712345678');
    expect(normalizePhone('+8801712345678')).toBe('01712345678');
    expect(normalizePhone('8801712 345678')).toBe('01712345678');
  });

  it('converts whole taka to poisha and rejects decimals', () => {
    expect(toPoisha('50,000')).toBe(5_000_000);
    expect(toPoisha('৫০০')).toBe(50_000);
    expect(toPoisha('')).toBeNull();
    expect(toPoisha('12.5')).toBeNaN();
  });

  it('validates required fields, phone, branches by role', () => {
    expect(validate(valid)).toEqual({});
    expect(validate({ ...valid, phone: '0123' }).phone).toBe('errors.phone');
    expect(validate({ ...valid, branchIds: [] }).branchIds).toBe('errors.branch');
    expect(validate({ ...valid, role: 'super_admin', branchIds: [] }).branchIds).toBeUndefined();
    expect(validate({ ...valid, branchIds: ['b1', 'b2'] }).branchIds).toBe('errors.oneBranch');
    expect(validate({ ...valid, role: 'branch_manager', branchIds: ['b1', 'b2'] }).branchIds).toBeUndefined();
    expect(validate({ ...valid, nameEn: ' ' }).nameEn).toBe('errors.required');
    expect(validate({ ...valid, username: 'A B' }).username).toBe('errors.username');
  });

  it('builds a create body without empty optionals', () => {
    expect(toCreate({ ...valid, cashLimitTaka: '40000' })).toEqual({
      name: { bn: 'রহিম', en: 'Rahim' },
      phone: '01712345678',
      role: 'field_staff',
      branchIds: ['b1'],
      employeeCode: 'FS-01',
      cashLimitPoisha: 4_000_000,
    });
  });

  it('sends only changed fields on update', () => {
    const before = {
      id: 'u1',
      name: { bn: 'রহিম', en: 'Rahim' },
      phone: '01712345678',
      role: 'field_staff' as const,
      branchIds: ['b1'],
      employeeCode: 'FS-01',
      cashLimitPoisha: 5_000_000,
      version: 3,
    };
    const v = { ...fromUser(before), cashLimitTaka: '60000' };
    const u = toUpdate(before, v, 'raise limit');
    expect(u).toEqual({ reason: 'raise limit', cashLimitPoisha: 6_000_000 });
    expect(changedKeys(u)).toEqual(['cashLimitPoisha']);
    expect(changedKeys(toUpdate(before, fromUser(before), 'x'))).toEqual([]);
  });
});
