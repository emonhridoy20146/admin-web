import { beforeEach, describe, expect, it } from 'vitest';
import { Inbox } from 'lucide-react';
import { navEntries, navRoutes, navSections, registerFeatures, registerSections, sectionForPath, type Gate } from '../registry';
import type { FeatureManifest } from '../types';

const msg = { bn: {}, en: {} };
const m = (name: string, routes: FeatureManifest['routes'], flag?: `module.${string}`): FeatureManifest => ({ name, flag, routes, permissions: [], messages: msg });

const gate = (perms: string[], flagsOff: string[] = []): Gate => ({ can: (k) => !k || perms.includes(k), flag: (k) => !k || !flagsOff.includes(k) });

/** FR-W-069: sidebar sections with tabs from several features. */
describe('sections', () => {
  beforeEach(() => {
    registerFeatures([
      m('dash', [{ path: '/', title: 'd:t', navGroup: 'top', order: 1 }]),
      m('cust', [
        { path: '/customers', title: 'c:t', permission: 'customer.view', navGroup: 'field', order: 10 },
        { path: '/customers/view', title: 'c:t', permission: 'customer.view', hidden: true },
        { path: '/pin-approvals', title: 'c:p', permission: 'customer.location.approve', navGroup: 'field', order: 12 },
      ]),
      m('rep', [{ path: '/data-quality', title: 'r:dq', permission: 'report.view', navGroup: 'insights', order: 50 }], 'module.reports'),
      m('col', [
        { path: '/collections', title: 'co:t', permission: 'collection.view', navGroup: 'field', order: 20 },
        { path: '/collections/conflicts', title: 'co:c', permission: 'collection.view', navGroup: 'field', order: 21 },
      ]),
      m('loose', [{ path: '/new-thing', title: 'n:t', navGroup: 'field', order: 99 }]),
    ]);
    registerSections([
      { id: 'customers', title: 's:c', icon: Inbox, group: 'field', order: 10, tabs: ['/customers', '/pin-approvals', '/data-quality'] },
      { id: 'collections', title: 's:co', icon: Inbox, group: 'field', order: 20, tabs: ['/collections', '/collections/conflicts'] },
    ]);
  });

  it('shows one sidebar item per section and keeps routes outside any section as their own items', () => {
    const e = navEntries(gate(['customer.view', 'customer.location.approve', 'report.view', 'collection.view']));
    expect(e.map((x) => (x.kind === 'section' ? x.nav.section.id : x.route.path))).toEqual(['/', 'customers', 'collections', '/new-thing']);
    // ⌘K and header bells still see every page
    expect(navRoutes(gate(['customer.view', 'collection.view'])).map((r) => r.path)).toContain('/collections/conflicts');
  });

  it('gates each tab by permission and flag, opens the first visible tab and hides an empty section', () => {
    const g = gate(['customer.location.approve', 'report.view'], ['module.reports']);
    const [cust] = navSections(g);
    expect(cust!.tabs.map((t) => t.path)).toEqual(['/pin-approvals']);
    expect(cust!.href).toBe('/pin-approvals');
    expect(navSections(g).map((s) => s.section.id)).toEqual(['customers']);
  });

  it('finds the section and the longest matching tab; pages below a tab highlight it without the strip', () => {
    const g = gate(['customer.view', 'collection.view']);
    expect(sectionForPath('/collections/conflicts/', g)).toMatchObject({ nav: { section: { id: 'collections' } }, active: { path: '/collections/conflicts' }, exact: true });
    expect(sectionForPath('/collections/', g)?.active.path).toBe('/collections');
    expect(sectionForPath('/customers/6740aa/', g)).toMatchObject({ active: { path: '/customers' }, exact: false });
    expect(sectionForPath('/', g)).toBeNull();
    expect(sectionForPath('/new-thing/', g)).toBeNull();
  });

  it('refuses a tab that is not a route, or a route in two sections', () => {
    expect(() => registerSections([{ id: 'x', title: 'x', icon: Inbox, group: 'top', order: 1, tabs: ['/nope'] }])).toThrow(/no feature has the route \/nope/);
    expect(() =>
      registerSections([
        { id: 'a', title: 'a', icon: Inbox, group: 'top', order: 1, tabs: ['/customers'] },
        { id: 'b', title: 'b', icon: Inbox, group: 'top', order: 2, tabs: ['/customers'] },
      ]),
    ).toThrow(/two sections/);
  });
});
