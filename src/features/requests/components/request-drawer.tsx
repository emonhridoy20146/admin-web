'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowRight, ArrowRightLeft, CheckCircle2, Image as ImageIcon, Lock, MessageSquare, Plus, RotateCcw, Send, UserRoundCheck } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, pickText } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { Drawer } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { DescList } from '@/shared/ui/page';
import { ErrorBanner } from '@/shared/ui/feedback';
import { Textarea } from '@/shared/ui/form';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useRequestAction, type Request, type RequestTimelineEntry } from '../api/requests';
import { actionsFor, type Me } from '../model/requests';
import { PriorityBadge, RequestStatusBadge, WhereNow } from './request-badges';
import { AssignDialog, ForwardDialog } from './request-dialogs';

type Act = 'forward' | 'assign' | 'resolve' | 'reopen' | 'close' | null;

const KIND_ICON: Record<string, typeof Plus> = {
  created: Plus, comment: MessageSquare, forwarded: ArrowRightLeft, assigned: UserRoundCheck, status_changed: ArrowRight,
  resolved: CheckCircle2, reopened: RotateCcw, closed: Lock,
};

/** FR-W-070: one request with everything that happened to it, comments, and the actions the user may take. */
export function RequestDrawer({ r, me, onClose }: { r: Request | null; me: Me; onClose: () => void }) {
  const { t } = useTranslation('requests');
  const locale = useUi((s) => s.locale);
  const branches = useBranches();
  const [act, setAct] = useState<Act>(null);
  const action = useRequestAction();
  const can = r ? actionsFor(r, me) : null;
  const branch = r ? pickText(branches.data?.find((b) => b.id === r.branchId)?.name, locale) || r.branchId : '';

  const footer =
    r && can && (can.forward || can.assign || can.resolve || can.reopen || can.close) ? (
      <div className="flex w-full flex-wrap gap-2">
        {can.resolve && (
          <Button variant="primary" onClick={() => setAct('resolve')}>
            <CheckCircle2 className="size-4" aria-hidden />
            {t('act.resolve')}
          </Button>
        )}
        {can.reopen && (
          <Button variant="primary" onClick={() => setAct('reopen')}>
            <RotateCcw className="size-4" aria-hidden />
            {t('act.reopen')}
          </Button>
        )}
        {can.forward && (
          <Button onClick={() => setAct('forward')}>
            <ArrowRightLeft className="size-4" aria-hidden />
            {t('act.forward')}
          </Button>
        )}
        {can.assign && (
          <Button onClick={() => setAct('assign')}>
            <UserRoundCheck className="size-4" aria-hidden />
            {t('act.assign')}
          </Button>
        )}
        {can.close && (
          <Button variant="ghost" className="ms-auto text-danger hover:text-danger" onClick={() => setAct('close')}>
            <Lock className="size-4" aria-hidden />
            {t('act.close')}
          </Button>
        )}
      </div>
    ) : undefined;

  return (
    <>
      <Drawer
        open={!!r}
        onOpenChange={(o) => !o && onClose()}
        width={560}
        title={r ? <span lang={locale}>{r.title}</span> : ''}
        subtitle={r ? t('drawer.from', { type: t(`type.${r.type}`, { defaultValue: r.type }), name: r.createdBy.name, at: formatDateTime(r.createdAt) }) : undefined}
        headerExtra={
          r ? (
            <div className="flex flex-wrap gap-1.5">
              <RequestStatusBadge status={r.status} />
              <PriorityBadge priority={r.priority} />
            </div>
          ) : undefined
        }
        footer={footer}
      >
        {r && (
          <div className="space-y-6" data-testid="request-drawer">
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-fg">{t('drawer.body')}</h3>
              <p className="whitespace-pre-line break-words rounded-md border border-line bg-surface p-3 text-base text-fg" lang={locale}>{r.body}</p>
              {(r.photoMediaIds?.length ?? 0) > 0 && (
                <p className="inline-flex items-center gap-1.5 text-sm text-fg-secondary">
                  <ImageIcon className="size-4" aria-hidden />
                  {t('drawer.photos', { count: r.photoMediaIds!.length })}
                </p>
              )}
            </section>

            {r.resolutionNote && (
              <section className="space-y-1.5 rounded-md border border-success/30 bg-success-bg p-3">
                <h3 className="text-sm font-semibold text-success">{t('drawer.resolution')}</h3>
                <p className="whitespace-pre-line break-words text-sm text-fg" lang={locale}>{r.resolutionNote}</p>
                {r.resolvedBy && r.resolvedAt && <p className="text-xs text-fg-secondary">{r.resolvedBy.name} · {formatDateTime(r.resolvedAt)}</p>}
              </section>
            )}

            <DescList
              items={[
                { label: t('drawer.where'), value: <WhereNow r={r} /> },
                { label: t('drawer.level'), value: t(`queue.${r.level}`) },
                { label: t('drawer.branch'), value: <span lang={locale}>{branch}</span> },
                ...(r.dueAt ? [{ label: t('drawer.due'), value: <span className="tabular">{formatDateTime(r.dueAt)}</span> }] : []),
                ...(r.customerId ? [{ label: t('drawer.customer'), value: <Link href={`/customers/${r.customerId}/`} className="text-primary hover:underline">{t('drawer.openCustomer')}</Link> }] : []),
              ]}
            />

            <section aria-labelledby="req-timeline">
              <h3 id="req-timeline" className="mb-3 text-sm font-semibold text-fg">{t('drawer.timeline')}</h3>
              <ol className="space-y-4 border-s border-line ps-5" data-testid="request-timeline">
                {r.timeline.map((e) => <TimelineItem key={e.id} e={e} />)}
              </ol>
            </section>

            {can?.comment ? <CommentBox r={r} busy={action.isPending} /> : <p className="text-sm text-fg-tertiary">{t('drawer.closedNoComment')}</p>}
          </div>
        )}
      </Drawer>
      {r && (
        <>
          <ForwardDialog r={r} open={act === 'forward'} onOpenChange={(o) => !o && setAct(null)} allowSuperAdminQueue />
          <AssignDialog r={r} open={act === 'assign'} onOpenChange={(o) => !o && setAct(null)} />
          <ReasonDialog
            open={act === 'resolve'}
            onOpenChange={(o) => !o && setAct(null)}
            title={t('resolve.title')}
            description={t('resolve.desc')}
            minLength={3}
            confirmLabel={t('resolve.confirm')}
            onSubmit={async (v) => (await action.mutateAsync({ id: r.id, kind: 'resolve', note: v.reason }), toast.success(t('resolve.done')))}
          />
          <ReasonDialog
            open={act === 'reopen'}
            onOpenChange={(o) => !o && setAct(null)}
            title={t('reopen.title')}
            description={t('reopen.desc')}
            minLength={3}
            confirmLabel={t('reopen.confirm')}
            onSubmit={async (v) => (await action.mutateAsync({ id: r.id, kind: 'reopen', note: v.reason }), toast.success(t('reopen.done')))}
          />
          <ReasonDialog
            open={act === 'close'}
            onOpenChange={(o) => !o && setAct(null)}
            title={t('close.title')}
            description={t('close.desc')}
            minLength={0}
            destructive
            confirmLabel={t('close.confirm')}
            onSubmit={async (v) => (await action.mutateAsync({ id: r.id, kind: 'close', note: v.reason || undefined }), toast.success(t('close.done')))}
          />
        </>
      )}
    </>
  );
}

function TimelineItem({ e }: { e: RequestTimelineEntry }) {
  const { t } = useTranslation('requests');
  const locale = useUi((s) => s.locale);
  const Icon = KIND_ICON[e.kind] ?? ArrowRight;
  const target = (x?: RequestTimelineEntry['to']) => (!x ? '' : x.user ? x.user.name : t(`where.${x.queue}`, { defaultValue: x.queue }));
  const known = ['created', 'comment', 'forwarded', 'assigned', 'status_changed', 'resolved', 'reopened', 'closed'].includes(e.kind);
  const line = known
    ? t(`tl.${e.kind}`, { who: e.actor.name, from: target(e.from), to: target(e.to), status: e.status ? t(`status.${e.status.to}`, { defaultValue: e.status.to }) : '' })
    : t('tl.unknown', { who: e.actor.name, kind: e.kind });
  return (
    <li className="relative">
      <span className={cn('absolute -start-[31px] top-0 grid size-5 place-items-center rounded-full border border-line bg-surface-raised', e.kind === 'resolved' ? 'text-success' : e.kind === 'comment' ? 'text-fg-secondary' : 'text-primary')} aria-hidden>
        <Icon className="size-3" />
      </span>
      <p className="text-sm text-fg">{line}</p>
      <p className="tabular text-xs text-fg-tertiary">{formatDateTime(e.at)}</p>
      {e.note && (
        <p className={cn('mt-1.5 whitespace-pre-line break-words text-sm', e.kind === 'comment' ? 'rounded-md bg-surface-subtle px-3 py-2 text-fg' : 'text-fg-secondary')} lang={locale}>
          {e.note}
        </p>
      )}
    </li>
  );
}

function CommentBox({ r, busy }: { r: Request; busy: boolean }) {
  const { t } = useTranslation('requests');
  const action = useRequestAction();
  const [text, setText] = useState('');
  const [error, setError] = useState<unknown>(null);
  // one clientId per comment being written: a retry after a network error never posts it twice
  const clientId = useRef(crypto.randomUUID());
  const send = async () => {
    if (!text.trim()) return;
    setError(null);
    try {
      await action.mutateAsync({ id: r.id, kind: 'comment', text: text.trim(), clientId: clientId.current });
      setText('');
      clientId.current = crypto.randomUUID();
      toast.success(t('drawer.commented'));
    } catch (x) {
      setError(x);
    }
  };
  return (
    <form className="space-y-2" onSubmit={(e) => (e.preventDefault(), void send())}>
      <label htmlFor={`comment-${r.id}`} className="text-sm font-semibold text-fg">{t('drawer.commentLabel')}</label>
      {error ? <ErrorBanner error={error} /> : null}
      <Textarea id={`comment-${r.id}`} rows={3} maxLength={2000} placeholder={t('drawer.commentPlaceholder')} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!text.trim() || busy} loading={action.isPending}>
          <Send className="size-4" aria-hidden />
          {t('drawer.send')}
        </Button>
      </div>
    </form>
  );
}
