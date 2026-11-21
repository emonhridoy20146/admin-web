/**
 * UI preferences (06-data-model §2). Persisted in localStorage `fos.ui` / `fos.branch` — preferences only,
 * never tokens or customer data. Storage access is wrapped: private windows may throw.
 */
import { create } from 'zustand';
import { setFormatPrefs, type Locale } from './format';

export type ThemePref = 'system' | 'light' | 'dark';
interface UiState {
  locale: Locale;
  bnDigits: boolean;
  theme: ThemePref;
  sidebarCollapsed: boolean;
  density: 'comfortable' | 'compact';
  /** '' = all branches (super admin) */
  branchId: string;
  hydrated: boolean;
  set: (p: Partial<Omit<UiState, 'set' | 'hydrate' | 'hydrated'>>) => void;
  hydrate: () => void;
}

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStore(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const defaults = { locale: 'en' as Locale, bnDigits: false, theme: 'system' as ThemePref, sidebarCollapsed: false, density: 'comfortable' as const };

export const useUi = create<UiState>((set, get) => ({
  ...defaults,
  branchId: '',
  hydrated: false,
  set: (p) => {
    set(p);
    const s = get();
    writeStore('fos.ui', { locale: s.locale, bnDigits: s.bnDigits, theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, density: s.density });
    if ('branchId' in p) writeStore('fos.branch', { id: s.branchId });
    setFormatPrefs({ locale: s.locale, bnDigits: s.bnDigits });
  },
  hydrate: () => {
    const ui = readStore('fos.ui', defaults);
    const br = readStore('fos.branch', { id: '' });
    set({ ...ui, branchId: br.id, hydrated: true });
    setFormatPrefs({ locale: ui.locale, bnDigits: ui.bnDigits });
  },
}));

export function applyTheme(theme: ThemePref) {
  const dark = theme === 'dark' || (theme === 'system' && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** Selected branch for API calls ('' = all → undefined). */
export function useBranchId(): string | undefined {
  return useUi((s) => s.branchId) || undefined;
}
