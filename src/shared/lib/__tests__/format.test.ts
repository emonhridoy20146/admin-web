import { describe, expect, it } from 'vitest';
import { formatBytes, formatDate, formatDateTime, formatDaySpan, formatDuration, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatRelative, groupLakh, pickText, toBnDigits } from '../format';
import { addDays, dhakaDayStartIso, startOfTodayDhakaIso, todayDhaka } from '../time';

const bn = { locale: 'bn' as const, bnDigits: true };
const en = { locale: 'en' as const, bnDigits: false };

describe('formatBytes', () => {
  it('uses binary units with one decimal below 100', () => {
    expect(formatBytes(0, en)).toBe('0 B');
    expect(formatBytes(850 * 1024, en)).toBe('850 KB');
    expect(formatBytes(12.44 * 1024 * 1024, en)).toBe('12.4 MB');
    expect(formatBytes(1.25 * 1024 ** 3, bn)).toBe('১.৩ GB');
  });
});

describe('number & money formatting', () => {
  it('groups in lakh/crore', () => {
    expect(groupLakh('1234567')).toBe('12,34,567');
    expect(groupLakh('123')).toBe('123');
    expect(groupLakh('-100000')).toBe('-1,00,000');
  });

  it('formats poisha as taka with optional poisha part', () => {
    expect(formatMoney(48_250_000, en)).toBe('৳4,82,500');
    expect(formatMoney(48_250_050, en)).toBe('৳4,82,500.50');
    expect(formatMoney(48_250_000, bn)).toBe('৳৪,৮২,৫০০');
    expect(formatMoney(-5000, en)).toBe('-৳50');
    expect(formatMoney(5000, { ...en, sign: true })).toBe('+৳50');
    expect(formatMoney(0, en)).toBe('৳0');
  });

  it('formats compact money in lakh and crore', () => {
    expect(formatMoneyCompact(12_000_000, en)).toBe('৳1.2 lakh');
    expect(formatMoneyCompact(3_400_000_000, bn)).toBe('৳৩.৪ কোটি');
    expect(formatMoneyCompact(50_000, en)).toBe('৳500');
  });

  it('formats numbers and percents with digit preference', () => {
    expect(formatNumber(1234567, bn)).toBe('১২,৩৪,৫৬৭');
    expect(formatNumber(2.345, { ...en, decimals: 1 })).toBe('2.3');
    expect(formatPercent(0.8, bn)).toBe('৮০%');
    expect(toBnDigits('2026-11-15')).toBe('২০২৬-১১-১৫');
  });
});

describe('date formatting (Asia/Dhaka)', () => {
  it('renders UTC instants in Dhaka time', () => {
    // 18:30 UTC = 00:30 next day in Dhaka (UTC+6)
    expect(formatDate('2026-11-14T18:30:00Z', en)).toBe('15 Nov 2026');
    expect(formatDateTime('2026-11-15T04:05:00Z', en)).toBe('15 Nov 2026, 10:05 AM');
    expect(formatDate('2026-11-15', { ...en, withYear: false })).toBe('15 Nov');
  });

  it('renders Bangla months and digits', () => {
    expect(formatDate('2026-11-15', bn)).toBe('১৫ নভে ২০২৬');
  });

  it('formats relative times and durations', () => {
    const now = new Date('2026-11-15T06:00:00Z');
    expect(formatRelative('2026-11-15T04:00:00Z', { ...en, now })).toBe('2 hours ago');
    expect(formatDuration(80, en)).toBe('1h 20m');
    expect(formatDuration(45, bn)).toBe('৪৫ মি');
    expect(formatDuration(60 * 24 * 2 + 300, en)).toBe('2d 5h');
    expect(formatDuration(60 * 24, bn)).toBe('১ দিন');
  });

  it('shows a count of days as years, months and days (two largest units)', () => {
    expect(formatDaySpan(0, en)).toBe('0 days');
    expect(formatDaySpan(1, en)).toBe('1 day');
    expect(formatDaySpan(20, bn)).toBe('২০ দিন');
    expect(formatDaySpan(30, en)).toBe('1 month');
    expect(formatDaySpan(45, bn)).toBe('১ মাস ১৫ দিন');
    expect(formatDaySpan(364, en)).toBe('12 months 4 days');
    expect(formatDaySpan(365, bn)).toBe('১ বছর');
    expect(formatDaySpan(584, bn)).toBe('১ বছর ৭ মাস');
    expect(formatDaySpan(584, en)).toBe('1 year 7 months');
    expect(formatDaySpan(370, en)).toBe('1 year 5 days');
    expect(formatDaySpan(-3, en)).toBe('0 days');
  });

  it('computes the Dhaka business day', () => {
    const late = new Date('2026-11-14T19:00:00Z'); // 01:00 on 15 Nov in Dhaka
    expect(todayDhaka(late)).toBe('2026-11-15');
    expect(addDays('2026-11-15', -6)).toBe('2026-11-09');
    expect(startOfTodayDhakaIso(late)).toBe('2026-11-14T18:00:00.000Z');
    expect(dhakaDayStartIso(6, late)).toBe('2026-11-08T18:00:00.000Z');
  });
});

describe('pickText', () => {
  it('picks locale with fallback', () => {
    expect(pickText({ bn: 'ক', en: 'A' }, 'bn')).toBe('ক');
    expect(pickText({ en: 'A' }, 'bn')).toBe('A');
    expect(pickText(null, 'en')).toBe('');
  });
});
