'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock, ShieldCheck, Sparkles, Wallet, ListChecks, ScrollText, Languages } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Field, Input } from '@/shared/ui/form';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useSession } from '@/shared/auth/session';
import { refreshSession } from '@/shared/auth/refresh';
import { isMockApi } from '@/shared/api/config';
import { useUi } from '@/shared/lib/ui-store';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { BrandMark } from '../components/brand';
import { login } from '../api/auth';

const DEMO = [
  { user: 'admin', role: 'super_admin' },
  { user: 'manager', role: 'branch_manager' },
  { user: 'viewer', role: 'viewer' },
  { user: 'newmanager', role: 'branch_manager', note: 'first' },
] as const;

export function LoginPage() {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const status = useSession((s) => s.status);
  const locale = useUi((s) => s.locale);
  const setUi = useUi((s) => s.set);
  const reason = sp.get('reason');

  // Already signed in (cookie still valid)? Go straight in.
  useEffect(() => {
    if (status === 'booting')
      void refreshSession().then((ok) => {
        if (ok) router.replace(next);
      });
    else if (status === 'authenticated') router.replace(next);
  }, [status, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    setError(null);
    try {
      const r = await login(username, password);
      if (r.user?.locale && r.user.locale !== useUi.getState().locale) setUi({ locale: r.user.locale });
      router.replace(r.user?.mustChangePassword ? `/change-password/?next=${encodeURIComponent(next)}` : next);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <Hero />
      <main className="relative flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <BrandMark />
            <span className="text-md font-semibold">{tc('appName')}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setUi({ locale: locale === 'bn' ? 'en' : 'bn' })} aria-label={tc('user.language')}>
            <Languages className="size-4" aria-hidden />
            {locale === 'bn' ? 'English' : 'বাংলা'}
          </Button>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1.5 text-base text-fg-secondary">{t('subtitle')}</p>

          {reason && <p className="mt-5 rounded-md border border-warning/30 bg-warning-bg px-3 py-2.5 text-sm text-warning">{tc(reason === 'reused' ? 'session.reused' : 'session.expired')}</p>}

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <Field label={t('username')} required>
              {(id) => <Input id={id} autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} inputMode="text" spellCheck={false} />}
            </Field>
            <Field label={t('password')} required>
              {(id) => (
                <span className="relative block">
                  <Input id={id} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pe-11" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-sm text-fg-tertiary hover:text-fg" aria-label={show ? t('hide') : t('show')}>
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              )}
            </Field>
            {error ? <ErrorBanner error={error} /> : null}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!username || !password}>
              <Lock className="size-4" aria-hidden />
              {t('submit')}
            </Button>
            <p className="text-center text-sm text-fg-tertiary">{t('forgot')}</p>
          </form>

          {isMockApi() && (
            <div className="mt-8 rounded-md border border-dashed border-line-strong bg-surface-subtle p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Sparkles className="size-4 text-primary" aria-hidden />
                {t('demoTitle')}
              </div>
              <p className="mt-1 text-sm text-fg-tertiary">{t('demoBody')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMO.map((d) => (
                  <button
                    key={d.user}
                    type="button"
                    onClick={() => {
                      setUsername(d.user);
                      setPassword('Demo@2026');
                    }}
                    className="rounded-sm border border-line bg-surface px-3 py-2 text-start shadow-e1 transition-colors hover:border-primary/40 hover:bg-primary-subtle [@media(pointer:coarse)]:min-h-11"
                  >
                    <span className="block font-mono text-xs text-fg">{d.user}</span>
                    <span className="block text-xs text-fg-tertiary">{tc(`role.${d.role}`)}{'note' in d ? ` · ${t('firstLogin')}` : ''}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 font-mono text-xs text-fg-tertiary">{t('demoPassword', { pw: 'Demo@2026' })}</p>
            </div>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-fg-tertiary">
          <ShieldCheck className="size-3.5" aria-hidden />
          {t('secure')}
        </p>
      </main>
    </div>
  );
}

function Hero() {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation();
  return (
    <aside className="relative hidden overflow-hidden bg-brand-950 text-white lg:flex lg:flex-col" aria-hidden={false}>
      {/* grid texture + glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(var(--neutral-0) 1px, transparent 1px), linear-gradient(90deg, var(--neutral-0) 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(ellipse 80% 70% at 30% 40%, #000 30%, transparent 75%)' }}
      />
      <div className="pointer-events-none absolute -top-40 -left-40 size-[620px] rounded-full opacity-60 blur-3xl" style={{ background: 'radial-gradient(circle, var(--brand-700), transparent 65%)' }} />
      <div className="pointer-events-none absolute -right-32 -bottom-48 size-[520px] rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, var(--brand-500), transparent 65%)' }} />

      <div className="relative flex items-center gap-2.5 px-12 pt-10">
        <BrandMark className="[&_rect]:fill-white [&_path]:stroke-[var(--brand-700)] [&_circle]:fill-[var(--brand-400)]" />
        <div>
          <div className="text-md font-semibold">{tc('appName')}</div>
          <div className="text-xs text-brand-200">{tc('appTagline')}</div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-12 xl:px-16">
        <h2 lang="bn" className="max-w-xl text-[34px] leading-[1.3] font-semibold tracking-tight xl:text-4xl xl:leading-[1.3]">{t('heroTitle')}</h2>
        <p className="mt-4 max-w-lg text-md text-brand-200">{t('heroBody')}</p>
        <ul className="mt-8 space-y-3">
          {[
            [Wallet, t('point1')],
            [ListChecks, t('point2')],
            [ScrollText, t('point3')],
          ].map(([Icon, label], i) => {
            const I = Icon as typeof Wallet;
            return (
              <li key={i} className="flex items-center gap-3 text-base text-white/90">
                <span className="grid size-8 place-items-center rounded-md bg-white/10 ring-1 ring-white/15">
                  <I className="size-4" aria-hidden />
                </span>
                {label as string}
              </li>
            );
          })}
        </ul>

        {/* preview card */}
        <div className="mt-12 w-full max-w-md rounded-lg bg-white/[0.06] p-4 ring-1 ring-white/12 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-brand-200">
            <span>{tc('nav.top')} · {tc('time.today')}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: 'var(--st-paid-bg)' }} />
              {tc('erp.live')}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              [formatMoney(48250000), 82],
              [formatNumber(312), 64],
              [`${formatNumber(27)}/${formatNumber(30)}`, 90],
            ].map(([v, w], i) => (
              <div key={i} className="rounded-md bg-white/[0.06] p-3">
                <div className="h-1.5 w-10 rounded-full bg-white/20" />
                <div className="tabular mt-2 text-md font-semibold">{v as string}</div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[var(--brand-400)]" style={{ width: `${w}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="relative px-12 pb-8 text-xs text-brand-200/80">© {new Date().getFullYear()} Howlader Electronics</div>
    </aside>
  );
}
