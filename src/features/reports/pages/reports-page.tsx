'use client';
import { useTranslation } from 'react-i18next';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { Segmented } from '@/shared/ui/primitives';
import { ExportsTab } from '../components/exports-tab';
import { ReconTab } from '../components/recon-tab';
import { TrendsTab } from '../components/trends-tab';
import { TABS } from '../model/reports';

export function ReportsPage() {
  const { t } = useTranslation('reports');
  const url = useUrlState();
  const tab = oneOf(url.get('tab'), TABS, 'trends');
  return (
    <>
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>
      <Segmented className="mb-5" label={t('tabs.label')} value={tab} onChange={(v) => url.set({ tab: v === 'trends' ? null : v, date: null, range: null })} options={TABS.map((x) => ({ value: x, label: t(`tabs.${x}`) }))} />
      {tab === 'trends' ? <TrendsTab /> : tab === 'reconciliation' ? <ReconTab /> : <ExportsTab />}
    </>
  );
}
