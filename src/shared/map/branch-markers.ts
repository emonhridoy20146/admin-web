import type { MapMarker } from './map-view';
import type { PinLook } from './pin-icon';

/** Branch / office pin: brand colour with a house, so it never reads as a customer's payment colour (FR-W-034). */
export const BRANCH_PIN: PinLook = { fill: '--primary', edge: '--primary-hover', glyph: 'home', variant: 'branch' };
export const BRANCH_ID_PREFIX = 'branch:';

interface BranchLike {
  id?: string;
  code?: string;
  name?: { bn?: string; en?: string } | null;
  lat?: number | null;
  lng?: number | null;
  active?: boolean;
}

/**
 * Map pins for the branches that have a point (set in Settings → branch map points; the ERP has no branch
 * coordinates). The chosen branch is drawn larger. Marker ids start with `branch:` so pages can tell them from their own.
 */
export function branchMarkers(list: BranchLike[] | undefined, opts: { selectedId?: string; locale: 'bn' | 'en'; title: (name: string) => string }): MapMarker[] {
  return (list ?? [])
    .filter((b) => b.id && b.active !== false && typeof b.lat === 'number' && typeof b.lng === 'number')
    .map((b) => {
      const name = (opts.locale === 'bn' ? b.name?.bn || b.name?.en : b.name?.en || b.name?.bn) || b.code || '';
      return { id: `${BRANCH_ID_PREFIX}${b.id}`, lat: b.lat!, lng: b.lng!, token: BRANCH_PIN.fill, title: opts.title(name), pin: BRANCH_PIN, strong: b.id === opts.selectedId, z: -1 };
    });
}

export const isBranchMarker = (id: string) => id.startsWith(BRANCH_ID_PREFIX);
