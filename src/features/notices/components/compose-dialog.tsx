'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useSession } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatNumber, pickText } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Input, Textarea } from '@/shared/ui/form';
import { Checkbox, Switch } from '@/shared/ui/primitives';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useSendNotice, type Notice } from '../api/notices';
import { AUDIENCE_ROLES, BODY_MAX, emptyNotice, TITLE_MAX, toCreate, validateNotice, type NoticeForm } from '../model/notices';

const choiceClass =
  'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border border-line px-3 py-2 hover:bg-surface-hover has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary-subtle';

/** FR-NOT-005: write a notice in Bangla (English optional), pick who gets it, and whether they must confirm reading. */
export function ComposeDialog({ open, onOpenChange, onSent }: { open: boolean; onOpenChange: (o: boolean) => void; onSent?: (n: Notice) => void }) {
  const { t } = useTranslation('notices');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const branchId = useUi((s) => s.branchId);
  const role = useSession((s) => s.user?.role);
  const branches = useBranches();
  const send = useSendNotice();
  const [v, setV] = useState<NoticeForm>(emptyNotice());
  const [errors, setErrors] = useState<Partial<Record<keyof NoticeForm, string>>>({});
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setV(emptyNotice(branchId || undefined));
      setErrors({});
      setError(null);
      setConfirm(false);
    }
  }, [open, branchId]);

  const set = <K extends keyof NoticeForm>(k: K, val: NoticeForm[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: keyof NoticeForm) => (errors[k] ? t(errors[k]!, { n: formatNumber(k.startsWith('title') ? TITLE_MAX : BODY_MAX) }) : undefined);
  const branchNames = v.branchIds.map((b) => pickText(branches.data?.find((x) => x.id === b)?.name, locale) || b);
  const audience = t('audience', {
    roles: v.roles.map((r) => tc(`role.${r}`)).join(', '),
    branches: v.branchIds.length ? branchNames.join(', ') : role === 'super_admin' ? t('allBranches') : t('myBranches'),
  });

  const review = () => {
    const e = validateNotice(v);
    setErrors(e);
    if (!Object.keys(e).length) setConfirm(true);
  };

  const submit = async () => {
    setError(null);
    try {
      const n = await send.mutateAsync(toCreate(v));
      toast.success(t('sent', { n: formatNumber(n.recipientCount ?? 0) }));
      onOpenChange(false);
      onSent?.(n);
    } catch (x) {
      setError(x);
      setConfirm(false);
    }
  };

  return (
    <>
      <Dialog
        open={open && !confirm}
        onOpenChange={(o) => !send.isPending && onOpenChange(o)}
        wide
        title={t('compose.title')}
        description={t('compose.desc')}
        footer={
          <>
            <Button onClick={() => onOpenChange(false)}>{tc('actions.cancel')}</Button>
            <Button variant="primary" onClick={review}>
              <Send className="size-4" aria-hidden />
              {t('compose.next')}
            </Button>
          </>
        }
      >
        <form className="grid gap-4 py-1 sm:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); review(); }}>
          <Field label={t('compose.titleBn')} required error={err('titleBn')}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.titleBn} lang="bn" value={v.titleBn} onChange={(e) => set('titleBn', e.target.value)} autoFocus />}
          </Field>
          <Field label={t('compose.titleEn')} error={err('titleEn')} help={t('compose.enHelp')}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.titleEn} lang="en" value={v.titleEn} onChange={(e) => set('titleEn', e.target.value)} />}
          </Field>
          <Field label={t('compose.bodyBn')} required error={err('bodyBn')} counter={`${formatNumber(v.bodyBn.length)}/${formatNumber(BODY_MAX)}`}>
            {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.bodyBn} lang="bn" rows={5} value={v.bodyBn} onChange={(e) => set('bodyBn', e.target.value)} />}
          </Field>
          <Field label={t('compose.bodyEn')} error={err('bodyEn')} counter={`${formatNumber(v.bodyEn.length)}/${formatNumber(BODY_MAX)}`}>
            {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.bodyEn} lang="en" rows={5} value={v.bodyEn} onChange={(e) => set('bodyEn', e.target.value)} />}
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-base font-medium text-fg">{t('compose.branches')}</legend>
            <p className="mb-2 text-xs text-fg-secondary">{role === 'super_admin' ? t('compose.branchesHelpAll') : t('compose.branchesHelpMine')}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(branches.data ?? []).map((b) => (
                <label key={b.id} className={choiceClass}>
                  <Checkbox checked={v.branchIds.includes(b.id!)} onCheckedChange={(c) => set('branchIds', c ? [...v.branchIds, b.id!] : v.branchIds.filter((x) => x !== b.id))} />
                  <span className="truncate text-sm font-medium" lang={locale}>{pickText(b.name, locale)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-2" aria-describedby={errors.roles ? 'notice-roles-err' : undefined}>
            <legend className="mb-1.5 text-base font-medium text-fg">{t('compose.roles')}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {AUDIENCE_ROLES.map((r) => (
                <label key={r} className={choiceClass}>
                  <Checkbox checked={v.roles.includes(r)} onCheckedChange={(c) => set('roles', c ? [...v.roles, r] : v.roles.filter((x) => x !== r))} />
                  <span className="text-sm font-medium">{tc(`role.${r}`)}</span>
                </label>
              ))}
            </div>
            {errors.roles && <p id="notice-roles-err" className="mt-1.5 text-xs text-danger">{t(errors.roles)}</p>}
          </fieldset>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-sm border border-line px-3 py-2.5 sm:col-span-2">
            <Switch checked={v.requireAck} onCheckedChange={(c) => set('requireAck', c)} aria-describedby="notice-ack-help" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium text-fg">{t('compose.requireAck')}</span>
              <span id="notice-ack-help" className="block text-xs text-fg-secondary">{t('compose.requireAckHelp')}</span>
            </span>
          </label>
          {error ? <div className="sm:col-span-2"><ErrorBanner error={error} /></div> : null}
          <button type="submit" hidden />
        </form>
      </Dialog>

      <Dialog
        open={open && confirm}
        onOpenChange={(o) => {
          if (send.isPending) return;
          if (!o) setConfirm(false);
        }}
        title={t('confirm.title')}
        description={audience}
        footer={
          <>
            <Button onClick={() => setConfirm(false)} disabled={send.isPending}>{t('confirm.back')}</Button>
            <Button variant="primary" onClick={submit} loading={send.isPending}>
              <Send className="size-4" aria-hidden />
              {t('confirm.send')}
            </Button>
          </>
        }
      >
        <div className="space-y-2 rounded-md border border-line bg-surface p-3">
          <p className="font-semibold text-fg" lang="bn">{v.titleBn.trim()}</p>
          <p className="whitespace-pre-line text-sm text-fg-secondary" lang="bn">{v.bodyBn.trim()}</p>
        </div>
        <p className="mt-3 text-sm text-fg-secondary">{v.requireAck ? t('confirm.mustRead') : t('confirm.info')}</p>
      </Dialog>
    </>
  );
}
