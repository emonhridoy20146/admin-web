import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { initI18n } from '@/shared/i18n';
import { Drawer } from '../overlay';
import { DescList } from '../page';

beforeAll(() => {
  initI18n({}, 'en');
});
afterEach(cleanup);

/**
 * Guard for owner request 2026-11-24 (FR-W-067): drawer text touched the left edge because the shared body had no padding
 * and each feature had to remember its own `p-5`. The body now owns the padding; these tests fail if it is taken away.
 * The e2e journey `drawer-padding.spec.ts` checks the real rendered offset of several drawers at 390 px and 1440 px.
 */
describe('Drawer body padding', () => {
  it('pads the body on both sides with the same token as the header and footer', () => {
    render(
      <Drawer open onOpenChange={() => {}} title="Title" footer={<button type="button">Act</button>}>
        <p>Body text</p>
      </Drawer>,
    );
    const content = screen.getByText('Body text').closest('[data-drawer-content]');
    expect(content).not.toBeNull();
    expect(content!.className).toMatch(/\bpx-5\b/);
    expect(content!.className).toMatch(/\bpy-5\b/);
    const header = document.querySelector('[data-drawer-header]')!;
    const footer = document.querySelector('[data-drawer-footer]')!;
    expect(header.className).toMatch(/\bpx-5\b/);
    expect(footer.className).toMatch(/\bpx-5\b/);
  });

  it('lets edge-to-edge content opt out with `flush`', () => {
    render(
      <Drawer open onOpenChange={() => {}} title="Title" flush>
        <p>Map</p>
      </Drawer>,
    );
    const content = screen.getByText('Map').closest('[data-drawer-content]')!;
    expect(content.className).not.toMatch(/\bpx-5\b/);
  });
});

describe('DescList', () => {
  it('wraps a `full` value over both columns instead of cutting it off', () => {
    render(<DescList items={[{ label: 'Type', value: 'Casual' }, { label: 'Reason', value: 'A long reason', full: true }]} />);
    expect(screen.getByText('Casual').className).toMatch(/\btruncate\b/);
    const reason = screen.getByText('A long reason');
    expect(reason.className).not.toMatch(/\btruncate\b/);
    expect(reason.parentElement!.className).toMatch(/sm:col-span-2/);
  });
});
