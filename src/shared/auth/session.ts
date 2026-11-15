/**
 * Session store (FR-W-002, ADR-W05). The access token lives in memory only — never in any storage.
 * The refresh token is an HttpOnly cookie (`fos_rt`) set by field-api; JS cannot read it.
 */
import { create } from 'zustand';
import type { components } from '../api/schema';

export type User = components['schemas']['User'];
export type LoginResponse = components['schemas']['LoginResponse'];

export type SessionStatus = 'booting' | 'authenticated' | 'anonymous';

interface SessionState {
  status: SessionStatus;
  accessToken: string | null;
  expiresAt: number | null;
  user: User | null;
  permissions: Set<string>;
  flags: Record<string, boolean>;
  setFromLogin: (r: LoginResponse) => void;
  setMe: (me: { user?: User; permissions?: string[]; flags?: Record<string, boolean> }) => void;
  clear: () => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'booting',
  accessToken: null,
  expiresAt: null,
  user: null,
  permissions: new Set(),
  flags: {},
  setFromLogin: (r) =>
    set({
      status: 'authenticated',
      accessToken: r.accessToken ?? null,
      expiresAt: r.accessTokenExpiresAt ? Date.parse(r.accessTokenExpiresAt) : null,
      user: r.user ?? null,
      permissions: new Set(r.permissions ?? []),
      flags: r.flags ?? {},
    }),
  setMe: (me) =>
    set((s) => ({
      user: me.user ?? s.user,
      permissions: me.permissions ? new Set(me.permissions) : s.permissions,
      flags: me.flags ?? s.flags,
    })),
  clear: () => set({ status: 'anonymous', accessToken: null, expiresAt: null, user: null, permissions: new Set(), flags: {} }),
}));

export function can(key: string | undefined): boolean {
  if (!key) return true;
  return useSession.getState().permissions.has(key);
}

export function useCan(key: string | undefined): boolean {
  return useSession((s) => (key ? s.permissions.has(key) : true));
}

export function useFlag(flag: string | undefined): boolean {
  // Feature flags default OFF (fixed decision): a missing key means disabled.
  return useSession((s) => (flag ? s.flags[flag] === true : true));
}
