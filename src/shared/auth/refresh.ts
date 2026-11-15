import { useSession, type LoginResponse } from './session';
import { apiBaseUrl } from '../api/config';

let inflight: Promise<boolean> | null = null;
type Listener = (reason: 'reused' | 'expired') => void;
const logoutListeners = new Set<Listener>();
export function onForcedLogout(l: Listener) {
  logoutListeners.add(l);
  return () => logoutListeners.delete(l);
}

/** Single-flight silent refresh via the HttpOnly cookie (FR-W-002). Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fos-admin', 'X-Client': 'web' },
        body: '{}',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        useSession.getState().clear();
        logoutListeners.forEach((l) => l(body.code === 'REFRESH_REUSED' ? 'reused' : 'expired'));
        return false;
      }
      useSession.getState().setFromLogin((await res.json()) as LoginResponse);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (inflight = null), 0);
    }
  })();
  return inflight;
}

/** Schedules a proactive refresh 60 s before access-token expiry. */
export function scheduleProactiveRefresh(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const plan = () => {
    clearTimeout(timer);
    const exp = useSession.getState().expiresAt;
    if (!exp) return;
    const wait = Math.max(5_000, exp - Date.now() - 60_000);
    timer = setTimeout(() => void refreshSession(), wait);
  };
  plan();
  const unsub = useSession.subscribe((s, prev) => {
    if (s.expiresAt !== prev.expiresAt) plan();
  });
  return () => {
    clearTimeout(timer);
    unsub();
  };
}

/** test-only */
export function __resetRefreshForTests() {
  inflight = null;
}
