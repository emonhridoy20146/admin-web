import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { initI18n } from '@/shared/i18n';
import bn from '../i18n/bn.json';
import en from '../i18n/en.json';

const created: unknown[] = [];
const branches = [
  { id: 'b1', name: { en: 'Galachipa', bn: 'গলাচিপা' }, lat: null, lng: null },
  { id: 'b2', name: { en: 'Patuakhali', bn: 'পটুয়াখালী' }, lat: null, lng: null },
];

vi.mock('@/features/shell', () => ({ useBranches: () => ({ data: branches, isPending: false }) }));
// Leaflet needs a real browser: the picker is replaced by a stand-in that reports what it was given.
vi.mock('@/shared/map/map-picker', () => ({
  MapPicker: ({ label, markers }: { label: string; markers?: unknown[] }) => <div role="application" aria-label={label} data-markers={markers?.length ?? 0} />,
}));
vi.mock('@/shared/feature/map-layers', () => ({ useMapLayers: () => ({ layers: [], markers: [], owns: () => false, open: () => false, element: null }) }));
vi.mock('../api/places', () => ({
  useCreatePlace: () => ({
    isPending: false,
    error: null,
    reset: () => undefined,
    mutateAsync: async (body: unknown) => (created.push(body), { id: 'new', name: 'Alif Model School' }),
  }),
  useEditPlace: () => ({ isPending: false, error: null, reset: () => undefined, mutateAsync: async () => ({}) }),
}));

const { PlaceDialog } = await import('../components/place-dialog');

beforeAll(() => {
  initI18n({ places: { bn, en } }, 'en');
});
afterEach(cleanup);

describe('New place dialog (FR-PLC-002, owner decision 2026-11-22: places need no branch)', () => {
  it('has no branch field even for someone with several branches, and sends no branchId', async () => {
    const onDone = vi.fn();
    render(<PlaceDialog open onOpenChange={() => undefined} canMove onDone={onDone} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByLabelText('Branch')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('My first branch')).toBeNull();
    expect(screen.getByRole('application', { name: en.dialog.mapLabel })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(new RegExp(en.form.name)), { target: { value: 'Alif Model School' } });
    fireEvent.click(screen.getByRole('radio', { name: en.icon.school }));
    fireEvent.click(screen.getByRole('button', { name: en.dialog.create }));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ name: 'Alif Model School', icon: 'school' });
    expect(created[0]).not.toHaveProperty('branchId');
    expect(onDone).toHaveBeenCalled();
  });
});
