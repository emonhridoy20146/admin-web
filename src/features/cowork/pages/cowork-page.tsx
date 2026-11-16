'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Info, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useGate } from '@/shared/feature/useGate';
import { formatDate, formatDuration, formatNumber, formatTime, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader, DescList } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';
import { Avatar, Segmented } from '@/shared/ui/primitives';
import { Select } from '@/shared/ui/form';
import { Drawer } from '@/shared/ui/overlay';
import { VisitOutcomeBadge } from '@/features/visits';
import { useFieldStaff, useSession, useSessions, useSessionVisits, type Member, type Session } from '../api/cowork';
import { nameOf, openMinutes, rangeFor, RANGES, sortedMembers, timeline, workedTogether } from '../model/session';

const MEMBER_TONE: Record<string, Tone> = { accepted: 'success', left: 'neutral', invited: 'warning', rejected: 'danger' };
const SHOWN = 3;

export function CoworkPage() {
  const { t } = useTranslation('cowork');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const today = todayDhaka();
  const range = oneOf(url.get('range'), RANGES, '7d');
  const userId = url.get('userId');
  const cursor = url.get('cursor');
  const [limit, setLimit] = useState(25);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const q = useSessions({ ...rangeFor(range, today), userId: userId || undefined, cursor: cursor || undefined, limit });
  const staff = useFieldStaff();
  const gate = useGate();
  const canVisits = gate.can('visit.view') && gate.flag('module.visits');
  const openId = url.get('drawer');
  const inList = q.data?.items.find((s) => s.id === openId) ?? null;
  // a link from a visit can name a session that is not on this page of the list
  const one = useSession(openId, !inList && !q.isLoading);
  const open = inList ?? one.data ?? null;
  const show = (s: Session) => url.set({ drawer: s.id }, { push: true });

  const columns: Column<Session>[] = [
    {
      id: 'members',
      header: t('col.members'),
      priority: 1,
      mobile: 'title',
      cell: (s) => <MembersCell s={s} onOpen={() => show(s)} />,
    },
    {
      id: 'when',
      header: t('col.when'),
      priority: 1,
      mobile: 'meta',
      cell: (s) => (
        <span className="inline-flex flex-col">
          <span className="tabular">{formatDate(s.businessDate)}</span>
          <span className="tabular text-xs text-fg-tertiary">{timeRange(s, t)}</span>
        </span>
      ),
    },
    { id: 'status', header: t('col.status'), priority: 1, mobile: 'badges', cell: (s) => <SessionBadge s={s} /> },
    {
      id: 'visits',
      header: t('col.visits'),
      align: 'end',
      priority: 2,
      mobile: 'amount',
      cell: (s) =>
        canVisits && (s.visitsCount ?? 0) > 0 ? (
          <Link href={`/visits/?session=${s.id}`} className="tabular font-medium text-primary hover:underline" aria-label={t('visitsOf', { n: formatNumber(s.visitsCount ?? 0) })}>
            {formatNumber(s.visitsCount ?? 0)}
          </Link>
        ) : (
          <span className={cn('tabular', !s.visitsCount && 'text-fg-tertiary')}>{formatNumber(s.visitsCount ?? 0)}</span>
        ),
    },
    { id: 'startedBy', header: t('col.startedBy'), priority: 3, cell: (s) => nameOf(s, s.createdBy) ?? <span className="text-fg-tertiary">—</span> },
    {
      id: 'duration',
      header: t('col.duration'),
      align: 'end',
      priority: 4,
      cell: (s) => {
        const m = openMinutes(s);
        return m == null ? <span className="text-fg-tertiary">—</span> : <span className="tabular">{formatDuration(m)}</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label={t('range.label')}
          value={range}
          onChange={(v) => (pager.reset(), url.set({ range: v === '7d' ? null : v, cursor: null }))}
          options={RANGES.map((r) => ({ value: r, label: t(`range.${r}`) }))}
        />
        <Select aria-label={t('staff')} value={userId} onChange={(e) => (pager.reset(), url.set({ userId: e.target.value || null, cursor: null }))} className="h-9 sm:w-60">
          <option value="">{t('allStaff')}</option>
          {(staff.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>{pickText(u.name, locale)}</option>
          ))}
        </Select>
      </div>

      <p className="mb-4 flex items-start gap-2 rounded-md border border-line bg-surface-subtle px-3 py-2 text-sm text-fg-secondary">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        {t('rule')}
      </p>

      <DataTable
        tableId="cowork"
        caption={t('title')}
        columns={columns}
        rows={q.data?.items}
        rowKey={(s) => s.id}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={show}
        activeRowKey={openId ?? undefined}
        empty={<EmptyState icon={Users} title={t('empty')} body={t('emptyBody')} />}
        pager={{ page: pager.page, hasPrev: pager.hasPrev, hasNext: !!q.data?.nextCursor, onPrev: pager.prev, onNext: () => pager.next(q.data?.nextCursor), pageSize: limit, onPageSize: (n) => (pager.reset(), setLimit(n)) }}
      />

      <Drawer
        open={!!openId}
        onOpenChange={(o) => !o && url.set({ drawer: null })}
        title={open ? t('drawerTitle', { date: formatDate(open.businessDate) }) : t('title')}
        subtitle={open ? timeRange(open, t) : undefined}
        headerExtra={open ? <SessionBadge s={open} /> : undefined}
        footer={
          open && canVisits && (open.visitsCount ?? 0) > 0 ? (
            <Link href={`/visits/?session=${open.id}`} className="ms-auto inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-primary hover:bg-surface-hover">
              {t('openVisits')}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          ) : undefined
        }
      >
        {open ? (
          <SessionDetail s={open} canVisits={canVisits} />
        ) : one.isLoading || q.isLoading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="p-5">
            <ErrorBanner error={one.error ?? new Error(t('notFound'))} />
          </div>
        )}
      </Drawer>
    </>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

function timeRange(s: Session, t: T): string {
  if (!s.createdAt) return '';
  return s.endedAt ? `${formatTime(s.createdAt)} – ${formatTime(s.endedAt)}` : t('since', { time: formatTime(s.createdAt) });
}

function SessionBadge({ s }: { s: Session }) {
  const { t } = useTranslation('cowork');
  return s.status === 'open' ? <Badge tone="success" icon={Users}>{t('status.open')}</Badge> : <Badge tone="neutral">{t('status.ended')}</Badge>;
}

function MembersCell({ s, onOpen }: { s: Session; onOpen: () => void }) {
  const { t } = useTranslation('cowork');
  const locale = useUi((st) => st.locale);
  const worked = workedTogether(s);
  const waiting = s.members.filter((m) => m.status === 'invited').length;
  const declined = s.members.filter((m) => m.status === 'rejected').length;
  const names = worked.slice(0, SHOWN).map((m) => m.name ?? '?');
  return (
    <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-2.5 text-start">
      <span className="flex shrink-0 -space-x-1.5 rtl:space-x-reverse" aria-hidden>
        {worked.slice(0, SHOWN).map((m) => (
          <Avatar key={m.userId} name={m.name ?? '?'} className="ring-2 ring-surface" />
        ))}
      </span>
      <span className="min-w-0">
        <span className="block max-w-[280px] truncate font-medium text-fg hover:text-primary" lang={locale}>
          {names.join(', ')}
          {worked.length > SHOWN ? ` ${t('more', { n: formatNumber(worked.length - SHOWN) })}` : ''}
        </span>
        <span className="block text-xs text-fg-tertiary">
          {[t('people', { n: formatNumber(worked.length) }), waiting ? t('waiting', { n: formatNumber(waiting) }) : null, declined ? t('declined', { n: formatNumber(declined) }) : null].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  );
}

const TL_TONE: Record<string, string> = { started: 'bg-primary', invited: 'bg-warning', accepted: 'bg-success', rejected: 'bg-danger', left: 'bg-fg-tertiary', ended: 'bg-fg-tertiary' };

function SessionDetail({ s, canVisits }: { s: Session; canVisits: boolean }) {
  const { t } = useTranslation('cowork');
  const locale = useUi((st) => st.locale);
  const visits = useSessionVisits(canVisits ? s.id : null);
  const members = sortedMembers(s);
  const minutes = openMinutes(s);

  return (
    <div className="space-y-6 p-5">
      <DescList
        items={[
          { label: t('col.startedBy'), value: <span lang={locale}>{nameOf(s, s.createdBy) ?? '—'}</span> },
          { label: t('col.visits'), value: <span className="tabular">{formatNumber(s.visitsCount ?? 0)}</span> },
          { label: t('started'), value: s.createdAt ? formatTime(s.createdAt) : '—' },
          { label: t('ended'), value: s.endedAt ? formatTime(s.endedAt) : t('stillOpen') },
          { label: t('col.duration'), value: minutes == null ? '—' : formatDuration(minutes) },
          { label: t('peopleLabel'), value: t('people', { n: formatNumber(workedTogether(s).length) }) },
          ...(s.note ? [{ label: t('note'), value: s.note }] : []),
        ]}
      />

      <section aria-labelledby="cw-members">
        <h3 id="cw-members" className="mb-2 text-sm font-semibold text-fg-secondary">{t('members')}</h3>
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
          {members.map((m) => (
            <MemberRow key={m.userId} m={m} starter={m.userId === s.createdBy} />
          ))}
        </ul>
      </section>

      {canVisits && (
        <section aria-labelledby="cw-visits">
          <h3 id="cw-visits" className="mb-2 text-sm font-semibold text-fg-secondary">{t('visits')}</h3>
          {visits.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : visits.error ? (
            <ErrorBanner error={visits.error} onRetry={() => visits.refetch()} />
          ) : visits.data?.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {visits.data.map((v) => (
                <li key={v.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <span className="tabular w-16 shrink-0 whitespace-nowrap text-fg-tertiary">{formatTime(v.checkInAt)}</span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/customers/${v.customer?.id ?? v.customerId}/`} className="block truncate font-medium text-fg hover:text-primary" lang={locale}>
                      {pickText(v.customer?.name, locale)}
                    </Link>
                    <span className="block text-xs text-fg-tertiary">
                      {t('recordedBy', { name: v.user?.name ?? '—' })}
                      {v.coWork?.participants?.length ? ` · ${t('with', { names: v.coWork.participants.map((p) => p.name).join(', ') })}` : ''}
                    </span>
                  </span>
                  <VisitOutcomeBadge outcome={v.outcome} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-tertiary">{t('noVisits')}</p>
          )}
        </section>
      )}

      <section aria-labelledby="cw-timeline">
        <h3 id="cw-timeline" className="mb-2 text-sm font-semibold text-fg-secondary">{t('timeline.title')}</h3>
        <ol className="space-y-2.5 border-s border-line ps-4">
          {timeline(s).map((e, i) => (
            <li key={i} className="relative text-sm">
              <span className={cn('absolute -start-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-surface-raised', TL_TONE[e.kind])} aria-hidden />
              <span className="tabular me-2 text-fg-tertiary">{formatTime(e.at)}</span>
              <span className="text-fg" lang={locale}>{t(`timeline.${e.kind}`, { who: e.who ?? '—', by: e.by ?? '—' })}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const MEMBER_ICON: Partial<Record<string, LucideIcon>> = { accepted: Users };

function MemberRow({ m, starter }: { m: Member; starter: boolean }) {
  const { t } = useTranslation('cowork');
  const locale = useUi((st) => st.locale);
  const status = m.status ?? 'invited';
  const times = [
    !starter && m.invitedAt ? t('times.invited', { time: formatTime(m.invitedAt) }) : null,
    m.respondedAt && !starter ? t(status === 'rejected' ? 'times.rejected' : 'times.joined', { time: formatTime(m.respondedAt) }) : null,
    starter && m.respondedAt ? t('times.started', { time: formatTime(m.respondedAt) }) : null,
    m.leftAt ? t('times.left', { time: formatTime(m.leftAt) }) : null,
  ].filter(Boolean);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Avatar name={m.name ?? '?'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg" lang={locale}>
          {m.name}
          {starter && <span className="ms-1.5 text-xs font-normal text-fg-tertiary">{t('starter')}</span>}
        </span>
        <span className="tabular block text-xs text-fg-tertiary">{times.join(' · ')}</span>
      </span>
      <Badge tone={MEMBER_TONE[status] ?? 'neutral'} icon={MEMBER_ICON[status]}>{t(`member.${status}`)}</Badge>
    </li>
  );
}
