import { describe, expect, it } from 'vitest';
import { addedCount, checkDrafts, normalizeMobile, phoneRows } from '../model/phones';

describe('customer phones (FR-CUS-016)', () => {
  it('uses phoneDetails when the server sends them, else treats phones as ERP numbers', () => {
    const rows = phoneRows({ phone: '01711000001', phones: ['01711000001', '01811000004'], phoneDetails: [
      { number: '01711000001', source: 'erp', primary: true },
      { number: '01811000004', source: 'field', primary: false, label: 'wife' },
    ] });
    expect(rows.map((r) => r.source)).toEqual(['erp', 'field']);
    expect(addedCount(rows)).toBe(1);
    expect(phoneRows({ phone: '01711000001', phones: ['01711000001', '01911000002'] })).toEqual([
      { number: '01711000001', source: 'erp', primary: true },
      { number: '01911000002', source: 'erp', primary: false },
    ]);
    expect(phoneRows({ phone: '01711000001' })).toHaveLength(1);
    expect(phoneRows({ phone: '' })).toEqual([]);
  });

  it('normalizes the usual spellings and refuses text', () => {
    expect(normalizeMobile('+880 1711-000001')).toBe('01711000001');
    expect(normalizeMobile('০১৭১১০০০০০১')).toBe('01711000001');
    expect(normalizeMobile('1711000001')).toBe('01711000001');
    expect(normalizeMobile('01211000001')).toBeNull();
    expect(normalizeMobile('017110 wife')).toBeNull();
  });

  it('checks the form rows: empty ignored, invalid, already there, typed twice', () => {
    const existing = phoneRows({ phone: '01711000001' });
    const r = checkDrafts(
      [
        { number: '', label: '' },
        { number: '0171', label: '' },
        { number: '01711000001', label: '' },
        { number: '01811000004', label: ' wife ' },
        { number: '+8801811000004', label: '' },
        { number: '01311000005', label: '' },
      ],
      existing,
    );
    expect(r.errors).toEqual([null, 'invalid', 'duplicate', null, 'repeated', null]);
    expect(r.phones).toEqual([{ number: '01811000004', label: 'wife' }, { number: '01311000005' }]);
  });
});
