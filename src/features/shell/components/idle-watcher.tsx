'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { formatNumber } from '@/shared/lib/format';
import { logout } from '@/features/auth';

const IDLE_MS = 30 * 60_000; // OD-W05
const WARN_MS = 28 * 60_000;

/** Idle timeout 30 min with a warning at 28 (FR-W-002). */
export function IdleWatcher() {
  const { t } = useTranslation();
  const router = useRouter();
  const last = useRef(Date.now());
  const [warn, setWarn] = useState(false);
  const [left, setLeft] = useState(120);

  useEffect(() => {
    const bump = () => {
      if (!warn) last.current = Date.now();
    };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= IDLE_MS) {
        clearInterval(timer);
        void logout().then(() => router.replace('/login/?reason=expired'));
      } else if (idle >= WARN_MS) {
        setWarn(true);
        setLeft(Math.ceil((IDLE_MS - idle) / 1000));
      }
    }, 1000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [warn, router]);

  return (
    <Dialog
      open={warn}
      onOpenChange={(o) => {
        if (!o) {
          last.current = Date.now();
          setWarn(false);
        }
      }}
      title={t('session.idleTitle')}
      description={t('session.idleBody', { s: formatNumber(left) })}
      footer={
        <Button
          variant="primary"
          onClick={() => {
            last.current = Date.now();
            setWarn(false);
          }}
        >
          {t('session.stay')}
        </Button>
      }
    />
  );
}
