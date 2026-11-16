import { describe, expect, it } from 'vitest';
import { assignmentFor, coverage, emptyForm, parseCodes, sortAreas, toBody, validate } from '../model/area';

const areas = [
  { id: 'a1', code: 'BRL-RUP', customerCount: 30, assignees: ['u1'], active: true },
  { id: 'a2', code: 'BRL-KAS', customerCount: 12, assignees: [], active: true },
  { id: 'a3', code: 'BRL-OLD', customerCount: 9, assignees: [], active: false },
];

describe('area model', () => {
  it('parses ERP area codes', () => {
    expect(parseCodes('rup1, RUP2 ,, rup1\nkas3')).toEqual(['RUP1', 'RUP2', 'KAS3']);
  });
  it('validates the form', () => {
    expect(validate(emptyForm(), areas)).toEqual({ nameBn: 'errors.required', nameEn: 'errors.required', code: 'errors.code', erpCodes: 'errors.erpCodes' });
    const ok = { nameBn: 'রূপাতলী', nameEn: 'Rupatali', code: 'brl-new', erpCodes: 'RUP9', active: true };
    expect(validate(ok, areas)).toEqual({});
    expect(validate({ ...ok, code: 'brl-rup' }, areas).code).toBe('errors.codeTaken');
    expect(validate({ ...ok, code: 'brl-rup' }, areas, 'a1')).toEqual({});
  });
  it('builds the request body', () => {
    expect(toBody({ nameBn: ' রূপাতলী ', nameEn: 'Rupatali', code: 'brl-new', erpCodes: 'rup9, rup8', active: true }, 'b1')).toEqual({ branchId: 'b1', name: { bn: 'রূপাতলী', en: 'Rupatali' }, code: 'BRL-NEW', kind: 'codes', erpAreaCodes: ['RUP9', 'RUP8'], active: true });
  });
  it('finds the active assignment to end', () => {
    const list = [{ id: 'x', type: 'area' as const, areaId: 'a1', userId: 'u1', effectiveTo: '2026-10-01' }, { id: 'y', type: 'area' as const, areaId: 'a1', userId: 'u1', effectiveTo: null }];
    expect(assignmentFor(list, 'a1', 'u1')?.id).toBe('y');
    expect(assignmentFor(list, 'a2', 'u1')).toBeUndefined();
  });
  it('reports coverage of active areas only', () => {
    expect(coverage(areas)).toEqual({ areas: 2, uncovered: 1, customers: 42, uncoveredCustomers: 12 });
  });
  it('sorts uncovered areas first and inactive last', () => {
    expect(sortAreas(areas).map((a) => a.id)).toEqual(['a2', 'a1', 'a3']);
  });
});
