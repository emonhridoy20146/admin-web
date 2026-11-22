/**
 * The only place numbers, money and dates are formatted (03-design-guide §8).
 * Money is integer poisha (1 taka = 100 poisha). Never call toLocaleString ad hoc in components.
 */
import { DateTime } from 'luxon';
import { DHAKA } from './time';

export type Locale = 'bn' | 'en';
export interface FormatPrefs {
  locale: Locale;
  /** true = Bangla digits ০-৯ */
  bnDigits: boolean;
}

let prefs: FormatPrefs = { locale: 'en', bnDigits: false };
export function setFormatPrefs(next: Partial<FormatPrefs>) {
  prefs = { ...prefs, ...next };
}
export function getFormatPrefs(): FormatPrefs {
  return prefs;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBnDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]!);
}

function digits(s: string, p: FormatPrefs) {
  return p.bnDigits ? toBnDigits(s) : s;
}

/** South Asian grouping: 1234567 → 12,34,567 */
export function groupLakh(intStr: string): string {
  const neg = intStr.startsWith('-');
  const s = neg ? intStr.slice(1) : intStr;
  if (s.length <= 3) return (neg ? '-' : '') + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (neg ? '-' : '') + rest + ',' + last3;
}

export function formatNumber(n: number, opts: Partial<FormatPrefs> & { decimals?: number } = {}): string {
  const p = { ...prefs, ...opts };
  const decimals = opts.decimals ?? 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [i, f] = fixed.split('.');
  const out = (n < 0 ? '-' : '') + groupLakh(i!) + (f ? '.' + f : '');
  return digits(out, p);
}

/** File size: "850 KB", "12.4 MB", "1.2 GB" (1 KB = 1024 bytes; units stay Latin, digits follow the setting). */
export function formatBytes(bytes: number, opts: Partial<FormatPrefs> = {}): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Math.max(0, bytes);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${formatNumber(v, { ...opts, decimals: i === 0 || v >= 100 ? 0 : 1 })} ${units[i]}`;
}

export function formatPercent(ratio: number, opts: Partial<FormatPrefs> & { decimals?: number } = {}): string {
  return formatNumber(ratio * 100, { decimals: opts.decimals ?? 0, ...opts }) + '%';
}

/** ৳4,82,500 — poisha shown only when not a whole taka. */
export function formatMoney(poisha: number, opts: Partial<FormatPrefs> & { sign?: boolean } = {}): string {
  const p = { ...prefs, ...opts };
  const neg = poisha < 0;
  const abs = Math.abs(Math.round(poisha));
  const taka = Math.floor(abs / 100);
  const rem = abs % 100;
  let s = groupLakh(String(taka));
  if (rem) s += '.' + String(rem).padStart(2, '0');
  const sign = neg ? '-' : opts.sign && poisha > 0 ? '+' : '';
  return sign + '৳' + digits(s, p);
}

/** Compact money for KPIs/axes: ৳১.২ লাখ, ৳৩.৪ কোটি / ৳1.2 lakh */
export function formatMoneyCompact(poisha: number, opts: Partial<FormatPrefs> = {}): string {
  const p = { ...prefs, ...opts };
  const taka = poisha / 100;
  const abs = Math.abs(taka);
  const words =
    p.locale === 'bn' ? { lakh: 'লাখ', crore: 'কোটি', k: 'হা.' } : { lakh: 'lakh', crore: 'cr', k: 'k' };
  let num: string;
  let unit = '';
  if (abs >= 1e7) {
    num = trim1(taka / 1e7);
    unit = words.crore;
  } else if (abs >= 1e5) {
    num = trim1(taka / 1e5);
    unit = words.lakh;
  } else if (abs >= 1e3) {
    num = trim1(taka / 1e3);
    unit = words.k;
  } else {
    num = String(Math.round(taka));
  }
  return '৳' + digits(num, p) + (unit ? (p.locale === 'bn' ? ' ' : ' ') + unit : '');
}
function trim1(n: number) {
  return (Math.round(n * 10) / 10).toString();
}

function dt(iso: string | Date, p: FormatPrefs) {
  const d = typeof iso === 'string' ? DateTime.fromISO(iso, { zone: DHAKA }) : DateTime.fromJSDate(iso);
  return d.setZone(DHAKA).reconfigure({ locale: p.locale === 'bn' ? 'bn-BD' : 'en-US', numberingSystem: p.bnDigits ? 'beng' : 'latn' });
}

/** 15 Nov 2026 / ১৫ নভেম্বর ২০২৬. Accepts ISO date-time (UTC) or business date YYYY-MM-DD (Dhaka). */
export function formatDate(iso: string | Date, opts: Partial<FormatPrefs> & { withYear?: boolean } = {}): string {
  const p = { ...prefs, ...opts };
  return dt(iso, p).toFormat(opts.withYear === false ? 'd MMM' : 'd MMM yyyy');
}

export function formatTime(iso: string | Date, opts: Partial<FormatPrefs> = {}): string {
  const p = { ...prefs, ...opts };
  return dt(iso, p).toFormat(p.locale === 'bn' ? 'h:mm a' : 'h:mm a');
}

export function formatDateTime(iso: string | Date, opts: Partial<FormatPrefs> = {}): string {
  const p = { ...prefs, ...opts };
  return dt(iso, p).toFormat('d MMM yyyy, h:mm a');
}

/** "নভেম্বর ২০২৬" / "November 2026" from a YYYY-MM month. */
export function formatMonth(month: string, opts: Partial<FormatPrefs> = {}): string {
  const p = { ...prefs, ...opts };
  return dt(`${month}-01`, p).toFormat('LLLL yyyy');
}

export function formatWeekday(iso: string, opts: Partial<FormatPrefs> = {}): string {
  const p = { ...prefs, ...opts };
  return dt(iso, p).toFormat('ccc');
}

/** "৩ দিন আগে" / "3 days ago" */
export function formatRelative(iso: string | Date, opts: Partial<FormatPrefs> & { now?: Date } = {}): string {
  const p = { ...prefs, ...opts };
  const base = opts.now ? DateTime.fromJSDate(opts.now) : DateTime.now();
  const r = dt(iso, p).toRelative({ base: base.reconfigure({ locale: p.locale === 'bn' ? 'bn-BD' : 'en-US' }), style: 'long' }) ?? '';
  return p.bnDigits ? toBnDigits(r) : r.replace(/[০-৯]/g, (c) => String(BN_DIGITS.indexOf(c)));
}

/** Minutes → "১ ঘ ২০ মি" / "1h 20m"; ≥ 24 h → "২ দিন ৫ ঘ" / "2d 5h" */
export function formatDuration(min: number, opts: Partial<FormatPrefs> = {}): string {
  const p = { ...prefs, ...opts };
  const bn = p.locale === 'bn';
  const sp = bn ? ' ' : '';
  const [du, hu, mu] = bn ? ['দিন', 'ঘ', 'মি'] : ['d', 'h', 'm'];
  const total = Math.max(0, Math.round(min));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const s = d ? `${d}${sp}${du}${h ? ` ${h}${sp}${hu}` : ''}` : h ? `${h}${sp}${hu} ${m}${sp}${mu}` : `${m}${sp}${mu}`;
  return digits(s, p);
}

/**
 * A count of days as a span people can read (FR-W-039): the two largest units of years, months and days.
 * 20 → "২০ দিন" / "20 days"; 45 → "১ মাস ১৫ দিন"; 584 → "১ বছর ৭ মাস". A month is 30 days and a year 365 here
 * (the count has no start date); use it for "how long", never to work out a date.
 */
export function formatDaySpan(days: number, opts: Partial<FormatPrefs> = {}): string {
  const p = { ...prefs, ...opts };
  const bn = p.locale === 'bn';
  const total = Math.max(0, Math.round(days));
  const y = Math.floor(total / 365);
  const m = Math.floor((total % 365) / 30);
  const d = (total % 365) % 30;
  const unit = (n: number, one: string, many: string, bnWord: string) => `${n} ${bn ? bnWord : n === 1 ? one : many}`;
  const parts = [y ? unit(y, 'year', 'years', 'বছর') : '', m ? unit(m, 'month', 'months', 'মাস') : '', d ? unit(d, 'day', 'days', 'দিন') : ''].filter(Boolean);
  return digits(parts.length ? parts.slice(0, 2).join(' ') : unit(0, 'day', 'days', 'দিন'), p);
}

/** Localised I18nText pick with fallback. */
export function pickText(t: { bn?: string; en?: string } | undefined | null, locale: Locale = prefs.locale): string {
  if (!t) return '';
  return (locale === 'bn' ? t.bn || t.en : t.en || t.bn) ?? '';
}
