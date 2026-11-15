'use client';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/shared/ui/primitives';
import { initI18n, i18n } from '@/shared/i18n';
import { applyTheme, useUi } from '@/shared/lib/ui-store';
import { isMockApi } from '@/shared/api/config';
import { isApiError } from '@/shared/api/problem';
import { messages } from './features';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        retry: (n, e) => !(isApiError(e) && e.status >= 400 && e.status < 500) && n < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeClient);
  const [ready, setReady] = useState(false);
  const theme = useUi((s) => s.theme);
  const locale = useUi((s) => s.locale);

  useEffect(() => {
    useUi.getState().hydrate();
    const ui = useUi.getState();
    initI18n(messages, ui.locale);
    applyTheme(ui.theme);
    const boot = isMockApi() ? import('@/test/mocks/browser').then((m) => m.startMockApi()) : Promise.resolve();
    boot.finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyTheme(theme);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const fn = () => theme === 'system' && applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [theme, ready]);

  useEffect(() => {
    if (!ready) return;
    void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [locale, ready]);

  if (!ready) return <BootSplash />;
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="bottom-right" visibleToasts={3} duration={4000} toastOptions={{ className: 'fos-toast' }} />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function BootSplash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" aria-busy="true">
      <div className="size-9 animate-pulse rounded-md bg-primary" />
    </div>
  );
}
