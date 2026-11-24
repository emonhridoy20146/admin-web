import { describe, expect, it } from 'vitest';
import { dashboardManifest } from '../manifest';

// field-api has no `module.dashboard`; the overview endpoint is the reports module's (owner report 2026-11-24).
describe('dashboard feature flag', () => {
  it('uses the server flag that owns /dashboard/overview', () => {
    expect(dashboardManifest.flag).toBe('module.reports');
  });
});
