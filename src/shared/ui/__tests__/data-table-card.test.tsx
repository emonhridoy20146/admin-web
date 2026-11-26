import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { initI18n } from '@/shared/i18n';
import { DataTable, type Column } from '../data-table';

beforeAll(() => {
  initI18n({}, 'en');
});
afterEach(cleanup);

interface Row { id: string; name: string }
const rows: Row[] = [{ id: 'a', name: 'Ali' }, { id: 'b', name: 'Lima' }];
const columns = (onLink?: (e: React.MouseEvent) => void): Column<Row>[] => [
  {
    id: 'name', header: 'Name', priority: 1, mobile: 'title',
    cell: (r) => <a href={`/customers/${r.id}/`} onClick={onLink}>{r.name}</a>,
  },
  { id: 'act', header: 'Act', mobile: 'meta', cell: () => <button type="button">Call</button> },
];
const list = () => screen.getByRole('list', { name: 'Customers' });

/** < 640 px card list: whole card tappable, one open button per card, no control nested in another (axe nested-interactive). */
describe('DataTable card list', () => {
  it('has no interactive element inside another, and one open button per card named by its title', () => {
    render(<DataTable tableId="t" caption="Customers" columns={columns()} rows={rows} rowKey={(r) => r.id} onRowClick={() => {}} selectable selection={new Set()} onSelectionChange={() => {}} />);
    const ul = list();
    expect(ul.querySelectorAll('[role=button]')).toHaveLength(0);
    const interactive = 'a[href],button,input,select,textarea,[tabindex],[role=checkbox],[role=button]';
    ul.querySelectorAll(interactive).forEach((el) => expect(el.parentElement!.closest(interactive)).toBeNull());
    const open = within(ul).getAllByRole('button', { name: /^Open / });
    expect(open).toHaveLength(2);
    expect(open[0]).toHaveAccessibleName('Open Ali');
    expect(open[1]).toHaveAccessibleName('Open Lima');
  });

  it('opens from the open button, a tap anywhere on the card, or a link that handles its own plain click', () => {
    const onRowClick = vi.fn();
    const { rerender } = render(<DataTable tableId="t" caption="Customers" columns={columns()} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    fireEvent.click(within(list()).getByRole('button', { name: 'Open Lima' }));
    expect(onRowClick).toHaveBeenLastCalledWith(rows[1]);
    fireEvent.click(within(list()).getAllByText('Act:')[0]!);
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0]);
    expect(onRowClick).toHaveBeenCalledTimes(2);

    // the cell's own button and a navigating link are left alone
    fireEvent.click(within(list()).getAllByRole('button', { name: 'Call' })[0]!);
    fireEvent.click(within(list()).getByRole('link', { name: 'Ali' }));
    expect(onRowClick).toHaveBeenCalledTimes(2);

    // the customers list's name link calls preventDefault on a plain click: the tap opens the card
    rerender(<DataTable tableId="t" caption="Customers" columns={columns((e) => e.preventDefault())} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    fireEvent.click(within(list()).getByRole('link', { name: 'Ali' }));
    expect(onRowClick).toHaveBeenCalledTimes(3);
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0]);
  });

  it('selecting a card does not open it; cards without onRowClick have no open button', () => {
    const onRowClick = vi.fn();
    const onSel = vi.fn();
    const { rerender } = render(<DataTable tableId="t" caption="Customers" columns={columns()} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} selectable selection={new Set()} onSelectionChange={onSel} />);
    fireEvent.click(within(list()).getAllByRole('checkbox', { name: 'Select row' })[0]!);
    expect(onSel).toHaveBeenCalledWith(new Set(['a']));
    expect(onRowClick).not.toHaveBeenCalled();
    rerender(<DataTable tableId="t" caption="Customers" columns={columns()} rows={rows} rowKey={(r) => r.id} />);
    expect(within(list()).queryByRole('button', { name: /^Open / })).toBeNull();
  });
});
