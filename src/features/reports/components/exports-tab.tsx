'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ArrowRight, CircleAlert, CircleCheck, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { useUi, useBranchId } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { useGate } from '@/shared/feature/useGate';
import { formatDate, formatMonth, formatNumber } from '@/shared/lib/format';
import { addDays, todayDhaka } from '@/shared/lib/time';
import { Card, CardHeader } from '@/shared/ui/card';
import { EmptyState, ErrorBanner } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Field, Input, Select } from '@/shared/ui/form';
import { useCreateExport, useExportJob } from '../api/reports';
import { EXPORT_FORMATS, EXPORT_TYPES, exportBody, MAX_DAYS, TYPE_PERMISSION, needsPeriod, needsRange, takesIssue, validateExport, type ExportForm } from '../model/reports';
import { ISSUES } from '../model/data-quality';

interface Job {
  id: string;
  name: string;
  detail: string;
}

export function ExportsTab() {
  const { t } = useTranslation('reports');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branchId = useBranchId();
  const can = useCan('report.export');
  const gate = useGate();
  const types = EXPORT_TYPES.filter((x) => !TYPE_PERMISSION[x] || gate.can(TYPE_PERMISSION[x]!));
  const today = todayDhaka();
  const create = useCreateExport();
  // other pages link here with ?type= (and ?issue= for data quality) to start from that data
  const url = useUrlState();
  const [f, setF] = useState<ExportForm>(() => ({
    type: oneOf(url.get('type'), types, 'collections'),
    format: 'xlsx',
    from: addDays(today, -29),
    to: today,
    period: 'monthly',
    date: today,
    issue: oneOf(url.get('issue'), ['', ...ISSUES] as const, ''),
  }));
  const [tried, setTried] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const set = <K extends keyof ExportForm>(k: K, v: ExportForm[K]) => setF((s) => ({ ...s, [k]: v }));
  const err = validateExport(f, today);
  const max = MAX_DAYS[f.type];

  if (!can) return <Card><EmptyState icon={FileSpreadsheet} title={t('exports.noPermission')} /></Card>;

  const submit = () => {
    setTried(true);
    if (err) return;
    const name = `${t(`exports.types.${f.type}`)} · ${t(`exports.formats.${f.format}`)}`;
    const detail = needsRange(f.type)
      ? t('exports.rangeLabel', { from: formatDate(f.from, { withYear: true }), to: formatDate(f.to, { withYear: true }) })
      : needsPeriod(f.type)
        ? f.period === 'monthly' ? formatMonth(f.date.slice(0, 7)) : formatDate(f.date, { withYear: true })
        : takesIssue(f.type) && f.issue ? t(`dq.issue.${f.issue}.label`) : '';
    create.mutate(exportBody(f, branchId, locale), { onSuccess: (r) => r.id && (setJobs((j) => [{ id: r.id!, name, detail }, ...j]), setTried(false)) });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card>
        <form className="space-y-4 p-4" noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
          <p className="text-sm text-fg-secondary">{t('exports.intro')}</p>
          <Field label={t('exports.type')}>
            {(id) => (
              <Select id={id} value={f.type} onChange={(e) => set('type', e.target.value as ExportForm['type'])}>
                {types.map((x) => <option key={x} value={x}>{t(`exports.types.${x}`)}</option>)}
              </Select>
            )}
          </Field>
          {needsRange(f.type) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('exports.from')} help={max ? t('exports.maxDays', { n: formatNumber(max) }) : undefined}>
                {(id, d) => <Input id={id} aria-describedby={d} type="date" max={today} value={f.from} onChange={(e) => e.target.value && set('from', e.target.value)} />}
              </Field>
              <Field label={t('exports.to')}>
                {(id) => <Input id={id} type="date" max={today} value={f.to} onChange={(e) => e.target.value && set('to', e.target.value)} />}
              </Field>
            </div>
          )}
          {needsPeriod(f.type) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('exports.period')}>
                {(id) => (
                  <Select id={id} value={f.period} onChange={(e) => set('period', e.target.value as ExportForm['period'])}>
                    <option value="monthly">{t('exports.periods.monthly')}</option>
                    <option value="daily">{t('exports.periods.daily')}</option>
                  </Select>
                )}
              </Field>
              <Field label={t('exports.date')}>
                {(id) => <Input id={id} type="date" max={today} value={f.date} onChange={(e) => e.target.value && set('date', e.target.value)} />}
              </Field>
            </div>
          )}
          {takesIssue(f.type) && (
            <Field label={t('exports.issue')}>
              {(id) => (
                <Select id={id} value={f.issue ?? ''} onChange={(e) => set('issue', e.target.value as ExportForm['issue'])}>
                  <option value="">{t('exports.allIssues')}</option>
                  {ISSUES.map((x) => <option key={x} value={x}>{t(`dq.issue.${x}.label`)}</option>)}
                </Select>
              )}
            </Field>
          )}
          <Field label={t('exports.format')} help={f.format === 'pdf' ? t('exports.pdfHelp') : undefined}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={f.format} onChange={(e) => set('format', e.target.value as ExportForm['format'])}>
                {EXPORT_FORMATS.map((x) => <option key={x} value={x}>{t(`exports.formats.${x}`)}</option>)}
              </Select>
            )}
          </Field>
          <p className="text-xs text-fg-tertiary">{t('exports.scope')}</p>
          {tried && err ? <p role="alert" className="text-sm text-danger">{t(`exports.errors.${err}`, { n: formatNumber(max ?? 0) })}</p> : null}
          {create.error ? <ErrorBanner error={create.error} /> : null}
          <Button type="submit" variant="primary" loading={create.isPending}>
            {!create.isPending && <FileSpreadsheet className="size-4" aria-hidden />}
            {t('exports.create')}
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
      <Card>
        <CardHeader title={t('exports.jobs')} subtitle={t('exports.linkNote')} />
        {!jobs.length ? (
          <p className="px-4 py-12 text-center text-sm text-fg-tertiary">{t('exports.jobsEmpty')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {jobs.map((j) => <JobRow key={j.id} job={j} />)}
          </ul>
        )}
      </Card>
      <PdfCard />
      </div>
    </div>
  );
}

/**
 * FR-REP-003 / OD-26: any page prints to PDF from the browser (what you see), and since contract 1.10.0 the server also
 * builds PDF files of whole data sets (the form's file type). This card lists the pages that print well.
 */
function PdfCard() {
  const { t } = useTranslation('reports');
  const gate = useGate();
  const links = [
    { href: '/reports/', label: t('tabs.trends'), show: true },
    { href: '/reports/?tab=reconciliation', label: t('tabs.reconciliation'), show: true },
    { href: '/staff/', label: t('pdf.staff'), show: gate.can('report.view') && gate.flag('module.reports') },
    { href: '/attendance/?view=month', label: t('pdf.attendance'), show: gate.can('attendance.view') && gate.flag('module.attendance') },
    { href: '/leaderboard/', label: t('lb.title'), show: gate.can('report.view') && gate.flag('module.reports') },
    { href: '/data-quality/', label: t('dq.title'), show: gate.can('report.view') && gate.flag('module.reports') },
    { href: '/targets/', label: t('pdf.targets'), show: gate.can('target.view') && gate.flag('module.targets') },
  ].filter((l) => l.show);
  return (
    <Card>
      <CardHeader title={t('pdf.title')} subtitle={t('pdf.how')} />
      <ul className="divide-y divide-line">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface-hover">
              <FileText className="size-4 text-fg-tertiary" aria-hidden />
              <span className="flex-1">{l.label}</span>
              <ArrowRight className="size-4 text-fg-tertiary rtl:rotate-180" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function JobRow({ job }: { job: Job }) {
  const { t } = useTranslation('reports');
  const q = useExportJob(job.id);
  const status = q.data?.status ?? 'queued';
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{job.name}</p>
        {job.detail ? <p className="tabular text-xs text-fg-secondary">{job.detail}</p> : null}
      </div>
      <div className="flex items-center gap-3" aria-live="polite">
        {status === 'ready' ? <Badge tone="success" icon={CircleCheck}>{t('exports.status.ready')}</Badge> : status === 'failed' || q.error ? <Badge tone="danger" icon={CircleAlert}>{t('exports.status.failed')}</Badge> : <Badge tone="info" icon={Loader2}>{t(`exports.status.${status}`)}</Badge>}
        {status === 'ready' && q.data?.downloadUrl ? (
          <a href={q.data.downloadUrl} download rel="noopener" aria-label={t('exports.downloadOf', { name: job.name })} className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover [@media(pointer:coarse)]:h-11">
            <Download className="size-4" aria-hidden />
            {t('exports.download')}
          </a>
        ) : null}
      </div>
    </li>
  );
}
