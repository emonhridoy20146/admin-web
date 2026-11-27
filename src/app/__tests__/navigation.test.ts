import { describe, expect, it } from 'vitest';
import { navEntries, type Gate } from '@/shared/feature/registry';
import { features } from '../features';
import { sections } from '../navigation';

const all: Gate = { can: () => true, flag: () => true };

/** FR-W-069 / FR-W-075 (ADR-W32): the real IA — 8 sidebar sections, the multi-page ones fold open into submenus. */
describe('panel navigation', () => {
  it('has the 8 sidebar sections in order for a super admin with every module on', () => {
    const ids = navEntries(all).map((e) => (e.kind === 'section' ? e.nav.section.id : e.route.path));
    expect(ids).toEqual(['/', 'inbox', 'customers', 'collections', 'field', 'staff', 'reports', 'admin']);
  });

  it('gives every section but Reports more than one page, so they show as submenus; Reports stays a plain item', () => {
    const multi = navEntries(all).flatMap((e) => (e.kind === 'section' && e.nav.tabs.length > 1 ? [e.nav.section.id] : []));
    expect(multi).toEqual(['inbox', 'customers', 'collections', 'field', 'staff', 'admin']);
  });

  it('places every nav page in a section except the overview', () => {
    const inSection = new Set(sections.flatMap((s) => s.tabs));
    const loose = features.flatMap((f) => f.routes).filter((r) => r.navGroup && !r.hidden && !inSection.has(r.path)).map((r) => r.path);
    expect(loose).toEqual(['/']);
  });
});
