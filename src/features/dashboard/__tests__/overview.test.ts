import { describe, expect, it } from 'vitest';
import { fillDays, monthCompare, pageHref, promiseRate, shares } from '../model/overview';

describe('dashboard model (FR-W-064)', () => {
  it('fills missing days with zero', () => {
    const d = fillDays([{ period: '2026-11-02', totalPoisha: 500, cashPoisha: 300, mobilePoisha: 200 }], '2026-11-01', '2026-11-03');
    expect(d.map((x) => x.total)).toEqual([0, 500, 0]);
    expect(d[1]).toMatchObject({ cash: 300, mobile: 200 });
  });

  it('compares month to date with the same days of last month', () => {
    const days = fillDays(
      [
        { period: '2026-10-01', totalPoisha: 100 },
        { period: '2026-10-03', totalPoisha: 100 },
        { period: '2026-10-20', totalPoisha: 1000 },
        { period: '2026-11-01', totalPoisha: 150 },
        { period: '2026-11-03', totalPoisha: 150 },
      ],
      '2026-10-01',
      '2026-11-03',
    );
    const m = monthCompare(days, '2026-11-03');
    expect(m.monthToDate).toBe(300);
    expect(m.lastMonthSameDays).toBe(200);
    expect(m.lastMonthTotal).toBe(1200);
    expect(m.delta).toBeCloseTo(0.5);
    expect(m.cumulative[2]).toEqual({ day: 3, thisMonth: 300, lastMonth: 200 });
    expect(m.cumulative[3]!.thisMonth).toBeNull();
    expect(m.cumulative[30]).toEqual({ day: 31, thisMonth: null, lastMonth: 1200 });
  });

  it('cuts the same-days window at a shorter last month', () => {
    const days = fillDays([{ period: '2026-02-28', totalPoisha: 70 }], '2026-02-01', '2026-03-31');
    expect(monthCompare(days, '2026-03-31').lastMonthSameDays).toBe(70);
  });

  it('has no delta without last month', () => {
    expect(monthCompare(fillDays([], '2026-10-01', '2026-11-03'), '2026-11-03').delta).toBeNull();
  });

  it('works out promise keeping and shares', () => {
    expect(promiseRate([{ promisesDue: 4, promisesKept: 3 }, { promisesDue: 6, promisesKept: 2 }])).toEqual({ due: 10, kept: 5, rate: 0.5 });
    expect(promiseRate([]).rate).toBeNull();
    expect(shares({ a: 1, b: 3, c: 0 })).toEqual([{ key: 'a', n: 1, share: 0.25 }, { key: 'b', n: 3, share: 0.75 }, { key: 'c', n: 0, share: 0 }]);
  });
});

describe('pageHref (1.45.0 dashboard links)', () => {
  it('maps list links to admin pages and their filter keys', () => {
    expect(pageHref({ path: '/collections', query: { from: '2026-11-01', to: '2026-11-23', method: 'cash' } }, '/')).toBe('/collections/?from=2026-11-01&to=2026-11-23&method=cash');
    expect(pageHref({ path: '/promises', query: { brokenWithoutFollowUp: 'true', createdBy: 'u1' } }, '/')).toBe('/promises/?nofollow=1&staff=u1');
    expect(pageHref({ path: '/customers', query: { payState: 'missed_one' } }, '/')).toBe('/customers/?pay=missed_one');
    expect(pageHref({ path: '/location-proposals', query: { status: 'pending' } }, '/')).toBe('/pin-approvals/');
  });
  it('drops unknown keys and falls back for unknown lists', () => {
    expect(pageHref({ path: '/visits', query: { from: '2026-11-01', limit: '25' } }, '/')).toBe('/visits/?from=2026-11-01');
    expect(pageHref({ path: '/somewhere' }, '/x/')).toBe('/x/');
    expect(pageHref(null, '/y/')).toBe('/y/');
  });
});

describe('pageHref for requestStats (1.48.0, FR-W-070)', () => {
  const st = 'open,in_progress,forwarded,reopened';
  it('opens the queue tab the number counts, without the default statuses', () => {
    expect(pageHref({ path: '/requests', query: { queue: 'area_manager', status: st } }, '/')).toBe('/requests/?queue=area_manager');
    expect(pageHref({ path: '/requests', query: { queue: 'super_admin', status: st } }, '/')).toBe('/requests/?queue=super_admin');
  });
  it('opens All with "with a person" for queue=assignee, and keeps priority', () => {
    expect(pageHref({ path: '/requests', query: { queue: 'assignee', status: st } }, '/')).toBe('/requests/?queue=all&where=assignee');
    expect(pageHref({ path: '/requests', query: { priority: 'important', status: st } }, '/')).toBe('/requests/?queue=all&priority=important');
  });
});
