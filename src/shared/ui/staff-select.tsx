'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, unwrap } from '../api/client';
import { useBranchId, useUi } from '../lib/ui-store';
import { pickText } from '../lib/format';
import { cn } from '../lib/cn';
import { Select } from './form';

/** Field staff of the selected branch (active), for "who" filters on lists. */
export function useFieldStaffOptions() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['shared', 'field-staff', branchId],
    queryFn: async () => (await unwrap(api.GET('/users', { params: { query: { branchId, role: 'field_staff', active: true, limit: 100 } } }))).items ?? [],
    staleTime: 5 * 60_000,
  });
}

/**
 * FR-W-063: "All staff" or one person. A person in the link who is not in the list (inactive, another branch) is kept
 * as an option so the filter still shows what it filters by.
 */
export function StaffSelect({ value, onChange, className, label, knownName }: { value: string; onChange: (id: string | null) => void; className?: string; label?: string; knownName?: string }) {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const staff = useFieldStaffOptions();
  const items = staff.data ?? [];
  const missing = value && !items.some((u) => u.id === value);
  return (
    <Select aria-label={label ?? t('staffFilter.label')} value={value} onChange={(e) => onChange(e.target.value || null)} className={cn('h-9 sm:w-52', className)} data-testid="staff-select">
      <option value="">{t('staffFilter.all')}</option>
      {missing && <option value={value}>{knownName ?? t('staffFilter.one')}</option>}
      {items.map((u) => (
        <option key={u.id} value={u.id}>{pickText(u.name, locale)}</option>
      ))}
    </Select>
  );
}
