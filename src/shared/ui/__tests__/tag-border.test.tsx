import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { initI18n } from '@/shared/i18n';
import { DataTable, type Column } from '../data-table';
import { ReasonDialog } from '../reason-dialog';
import { TagChip, tagBoxClass } from '../tag-chip';
import { reasonLook, tagLookOf, TAG_REASON_CODES, type TagLike } from '../tag-look';

beforeAll(() => {
  initI18n({}, 'en');
});
afterEach(cleanup);

interface Row { id: string; name: string; tag?: TagLike }
const rows: Row[] = [
  { id: 'a', name: 'Absconded Ali', tag: { state: 'tagged', severity: 'bad', reasonCode: 'absconded' } },
  { id: 'b', name: 'Legal Lima', tag: { state: 'tagged', severity: 'legal', reasonCode: 'refused_to_pay' } },
  { id: 'c', name: 'Watch Wasim', tag: { state: 'tagged', severity: 'watch', reasonCode: 'other' } },
  { id: 'd', name: 'Plain Polash', tag: { state: 'none' } },
];
const columns: Column<Row>[] = [
  { id: 'name', header: 'Name', priority: 1, mobile: 'title', cell: (r) => <span>{r.name}<TagChip tag={r.tag} /></span> },
];

/** FR-W-072: bad-tag row border and reason chip. */
describe('DataTable bad-tag border', () => {
  it('borders bad and legal rows (table and card list) in the colour of the reason, never watch or untagged', () => {
    render(<DataTable tableId="t" caption="Customers" columns={columns} rows={rows} rowKey={(r) => r.id} rowBorderClass={(r) => tagLookOf(r.tag)?.className} />);
    const tr = (id: string) => document.querySelector(`tr[data-row-key="${id}"]`)!;
    expect(tr('a').className).toMatch(/\bfos-tag\b.*\bfos-tag--absconded\b/);
    expect(tr('a').getAttribute('data-tag-border')).toBe('true');
    expect(tr('b').className).toMatch(/\bfos-tag--legal\b/);
    expect(tr('c').className).not.toMatch(/fos-tag/);
    expect(tr('d').className).not.toMatch(/fos-tag/);
    // < 640 px card list: the card itself has the box border
    const cards = document.querySelectorAll('ul[aria-label="Customers"] [data-tag-border="true"]');
    expect(cards).toHaveLength(2);
    cards.forEach((c) => expect(c.className).toMatch(/\bfos-tag-box\b/));
  });

  it('shows a reason chip with an icon and a label next to the name (status = colour + icon + label)', () => {
    render(<DataTable tableId="t" caption="Customers" columns={columns} rows={rows} rowKey={(r) => r.id} rowBorderClass={(r) => tagLookOf(r.tag)?.className} />);
    const table = screen.getByRole('table');
    const chips = within(table).getAllByTestId('tag-chip');
    expect(chips.map((c) => c.getAttribute('data-tag'))).toEqual(['absconded', 'legal']);
    expect(chips[0]).toHaveTextContent('Absconded');
    expect(chips[1]).toHaveTextContent('Legal action');
    expect(chips[0]!.querySelector('svg')).not.toBeNull();
  });
});

describe('TagChip and tagBoxClass', () => {
  it('render nothing for customers without a bad tag', () => {
    const { container } = render(<TagChip tag={{ state: 'pending', severity: 'bad', reasonCode: 'absconded' }} />);
    expect(container).toBeEmptyDOMElement();
    expect(tagBoxClass({ state: 'tagged', severity: 'watch' })).toBe('');
    expect(tagBoxClass({ state: 'tagged', severity: 'bad', reasonCode: 'nope' })).toBe('fos-tag fos-tag-box');
  });
});

describe('ReasonDialog with code colours (tag dialog)', () => {
  it('shows each reason with its colour: border plus swatch, and keeps the choice', async () => {
    const codes = TAG_REASON_CODES.map((c) => [c, c] as [string, string]);
    render(
      <ReasonDialog open onOpenChange={() => {}} title="Tag" codes={codes} confirmLabel="Tag" codeLook={(c) => ({ className: reasonLook(c).className })} afterCodes={(c) => <span data-testid="picked">{c}</span>} onSubmit={async () => {}} />,
    );
    const group = await screen.findByRole('radiogroup');
    const options = group.querySelectorAll('label[data-code]');
    expect(options).toHaveLength(TAG_REASON_CODES.length);
    options.forEach((o) => {
      const code = o.getAttribute('data-code')!;
      expect(o.className).toContain(reasonLook(code).className);
      expect(o.className).toMatch(/\bfos-tag-box\b/);
      expect(o.querySelector('[data-testid="reason-swatch"]')?.className).toMatch(/\bfos-tag-swatch\b/);
    });
    expect(screen.getByTestId('picked')).toHaveTextContent('plan_ended_unpaid');
    fireEvent.click(within(group).getByRole('radio', { name: 'absconded' }));
    expect(within(group).getByRole('radio', { name: 'absconded' })).toBeChecked();
    expect(screen.getByTestId('picked')).toHaveTextContent('absconded');
  });

  it('keeps the plain select when no colours are given', async () => {
    render(<ReasonDialog open onOpenChange={() => {}} title="Untag" codes={[['cleared', 'Cleared']]} confirmLabel="Remove" onSubmit={async () => {}} />);
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
