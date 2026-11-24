import { describe, expect, it } from 'vitest';
import { navEntries, type Gate } from '@/shared/feature/registry';
import { features } from '../features';
import { sections } from '../navigation';

const all: Gate = { can: () => true, flag: () => true };

/** FR-W-069 / ADR-W28: the real IA. Owner asked for roughly 8–12 sidebar items. */
describe('panel navigation', () => {
  it('has 8–12 sidebar items for a super admin with every module on', () => {
    const n = navEntries(all).length;
    expect(n).toBeGreaterThanOrEqual(8);
    expect(n).toBeLessThanOrEqual(12);
  });

  it('places every nav page in a section except the overview', () => {
    const inSection = new Set(sections.flatMap((s) => s.tabs));
    const loose = features.flatMap((f) => f.routes).filter((r) => r.navGroup && !r.hidden && !inSection.has(r.path)).map((r) => r.path);
    expect(loose).toEqual(['/']);
  });
});
