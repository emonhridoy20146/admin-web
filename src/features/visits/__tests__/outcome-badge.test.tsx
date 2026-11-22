import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { initI18n, i18n } from '@/shared/i18n';
import bn from '../i18n/bn.json';
import en from '../i18n/en.json';
import { VisitOutcomeBadge } from '../components/outcome-badge';
import { OUTCOMES } from '../model/visit';

beforeAll(() => {
  initI18n({ visits: { bn, en } }, 'en');
});
afterEach(cleanup);

describe('VisitOutcomeBadge (FR-VIS-006)', () => {
  it('labels runaway in English and Bangla', async () => {
    await i18n.changeLanguage('en');
    render(<VisitOutcomeBadge outcome="runaway" />);
    expect(screen.getByText('Runaway')).toBeInTheDocument();
    cleanup();
    await i18n.changeLanguage('bn');
    render(<VisitOutcomeBadge outcome="runaway" />);
    expect(screen.getByText('পলাতক')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  it('shows an unknown outcome as its raw code instead of failing', () => {
    render(<VisitOutcomeBadge outcome="moon_landing" />);
    expect(screen.getByText('moon_landing')).toBeInTheDocument();
  });

  it('has a label for every filterable outcome in both languages', () => {
    expect(OUTCOMES).toContain('runaway');
    for (const o of OUTCOMES) {
      for (const m of [bn.outcome, en.outcome] as Record<string, string>[]) {
        expect(m[o], o).toBeTruthy();
      }
    }
  });
});
