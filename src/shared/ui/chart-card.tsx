'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Table2 } from 'lucide-react';
import { Card, CardHeader } from './card';
import { Button } from './button';

/** Every chart has a "view as table" toggle (03 §5.8, accessibility + export). */
export function ChartCard({ title, subtitle, actions, chart, table, className }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; chart: React.ReactNode; table: React.ReactNode; className?: string }) {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {actions}
            <Button variant="ghost" size="icon-sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} aria-label={asTable ? t('chart.showChart') : t('chart.showTable')} title={asTable ? t('chart.showChart') : t('chart.showTable')}>
              {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
            </Button>
          </>
        }
      />
      {asTable ? (
        <div className="p-4">{table}</div>
      ) : (
        <>
          <div className="p-4 print:hidden">{chart}</div>
          {/* on paper the data table is printed: charts sized for the screen do not re-layout reliably for the page */}
          <div className="hidden p-4 print:block">{table}</div>
        </>
      )}
    </Card>
  );
}
