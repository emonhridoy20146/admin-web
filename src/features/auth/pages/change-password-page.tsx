'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Field, Input } from '@/shared/ui/form';
import { ErrorBanner } from '@/shared/ui/feedback';
import { Card } from '@/shared/ui/card';
import { useSession } from '@/shared/auth/session';
import { refreshSession } from '@/shared/auth/refresh';
import { BrandMark } from '../components/brand';
import { changePassword } from '../api/auth';

export function ChangePasswordPage() {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation();
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';
  const status = useSession((s) => s.status);
  const forced = useSession((s) => s.user?.mustChangePassword);
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (status === 'booting') void refreshSession().then((ok) => !ok && router.replace('/login/'));
    if (status === 'anonymous') router.replace('/login/');
  }, [status, router]);

  const weak = pw.length < 8 || !/\d/.test(pw);
  const mismatch = pw2.length > 0 && pw !== pw2;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (weak || pw !== pw2 || !cur) return;
    setBusy(true);
    setError(null);
    try {
      await changePassword(cur, pw);
      toast.success(t('changed'));
      router.replace(next);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandMark />
          <span className="text-md font-semibold">{tc('appName')}</span>
        </div>
        <Card className="p-6 shadow-e2">
          <span className="grid size-10 place-items-center rounded-md bg-primary-subtle text-primary-subtle-fg">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold">{t('changeTitle')}</h1>
          <p className="mt-1 text-base text-fg-secondary">{forced ? t('changeForced') : t('changeSubtitle')}</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label={t('current')} required>
              {(id) => <Input id={id} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />}
            </Field>
            <Field label={t('new')} required help={t('rules')} error={touched && weak ? t('rules') : undefined}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={touched && weak} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
            </Field>
            <Field label={t('confirm')} required error={mismatch ? t('mismatch') : undefined}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={mismatch} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />}
            </Field>
            {error ? <ErrorBanner error={error} /> : null}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>{t('changeSubmit')}</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
