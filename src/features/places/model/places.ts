import type { MapMarker } from '@/shared/map/map-view';
import type { PinLook } from '@/shared/map/pin-icon';
import type { LatLng } from '@/shared/map/geo';
import type { Place, PlaceIcon } from '../api/places';

/** Contract 1.38.0 (field-api ADR-051): the fixed icon list, in the order the picker shows them. */
export const PLACE_ICONS: readonly PlaceIcon[] = ['shop', 'market', 'mosque', 'school', 'bank', 'hospital', 'bus_stop', 'office', 'landmark', 'other'];
export const NAME_MAX = 60;
export const NOTE_MAX = 200;
export const REASON_MIN = 5;
/** Marker ids on the customer map carry the layer id, so the map page knows whose drawer to open. */
export const LAYER_ID = 'place';

/** 24×24 stroke paths, one per icon (drawn in the map pin face and in lists; the label always says it too). */
export const ICON_PATHS: Record<PlaceIcon, string> = {
  shop: 'M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6',
  market: 'M4 10h16l-1.6 9H5.6L4 10zM8 10l4-6 4 6M12 13v3',
  mosque: 'M5 20v-7a7 7 0 0 1 14 0v7M3 20h18M12 6V2M10 20v-4a2 2 0 0 1 4 0v4',
  school: 'M2 9l10-5 10 5-10 5-10-5zM6 11v5c3 2.5 9 2.5 12 0v-5',
  bank: 'M3 10h18L12 4 3 10zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  hospital: 'M4 4h16v16H4zM12 8v8M8 12h8',
  bus_stop: 'M6 4h12a2 2 0 0 1 2 2v10H4V6a2 2 0 0 1 2-2zM4 11h16M7 20v-4M17 20v-4',
  office: 'M5 21V4h10v17M15 9h4v12M3 21h18M8 8h4M8 12h4M8 16h4',
  landmark: 'M5 21V4M5 4h12l-2.5 4L17 12H5',
  other: 'M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11zM12 10v.5',
};

export const isPlaceIcon = (v: string): v is PlaceIcon => (PLACE_ICONS as readonly string[]).includes(v);

/** Pin look: `info` for a place, `warning` while a staff member waits for a move to be approved. Never colour alone: the drawer and list say "move requested". */
export function placeLook(p: Pick<Place, 'icon' | 'pendingMove'>): PinLook {
  const pending = !!p.pendingMove;
  return { fill: pending ? '--warning-fg' : '--info-fg', edge: pending ? '--warning-fg' : '--info-fg', glyph: { path: ICON_PATHS[p.icon] } };
}

/** The place as a labelled pin, plus (for an open move request) a hollow marker on the requested point and a dashed line to it. */
export function placeMarkers(list: Place[], opts: { selectedId?: string | null; prefix?: string; movedTitle?: (p: Place) => string } = {}): { markers: MapMarker[]; lines: [LatLng, LatLng][] } {
  const pre = opts.prefix ?? '';
  const markers: MapMarker[] = [];
  const lines: [LatLng, LatLng][] = [];
  for (const p of list) {
    if (p.status !== 'active') continue;
    const selected = p.id === opts.selectedId;
    markers.push({ id: `${pre}${p.id}`, lat: p.location.lat, lng: p.location.lng, token: '--info-fg', title: p.name, label: p.name, pin: placeLook(p), strong: selected, z: 1 });
    if (p.pendingMove && selected) {
      const to = p.pendingMove.location;
      markers.push({ id: `${pre}${p.id}`, lat: to.lat, lng: to.lng, token: '--warning-fg', title: opts.movedTitle?.(p) ?? p.name, hollow: true, strong: true });
      lines.push([p.location, to]);
    }
  }
  return { markers, lines };
}

/** What the person looking at a place may do (the server checks again; a 403 is still handled). */
export function actionsFor(p: Place, me: { id: string | undefined; canCreate: boolean; canManage: boolean }) {
  const active = p.status === 'active';
  const own = !!me.id && p.createdBy.id === me.id;
  return {
    edit: active && (me.canManage || (me.canCreate && own)),
    move: active && me.canManage,
    remove: active && me.canManage,
    decide: active && me.canManage && !!p.pendingMove,
  };
}

export interface PlaceForm {
  name: string;
  icon: PlaceIcon;
  note: string;
  point: LatLng;
}

export type FormErrors = Partial<Record<'name' | 'note' | 'point', 'required' | 'tooLong' | 'outside'>>;

export function validatePlace(f: PlaceForm, inBd: (p: LatLng) => boolean): FormErrors {
  const e: FormErrors = {};
  const name = f.name.trim();
  if (!name) e.name = 'required';
  else if (name.length > NAME_MAX) e.name = 'tooLong';
  if (f.note.trim().length > NOTE_MAX) e.note = 'tooLong';
  if (!inBd(f.point)) e.point = 'outside';
  return e;
}

const round6 = (n: number) => Number(n.toFixed(6));

/** Body of POST /places. */
export function toCreate(f: PlaceForm, clientId: string, branchId?: string) {
  return { clientId, name: f.name.trim(), icon: f.icon, location: { lat: round6(f.point.lat), lng: round6(f.point.lng) }, ...(f.note.trim() ? { note: f.note.trim() } : {}), ...(branchId ? { branchId } : {}) };
}

/** Body of PATCH /places/{id}: only what changed (an empty object means nothing to save). `location` only when the caller may move. */
export function toEdit(p: Place, f: PlaceForm, canMove: boolean) {
  const out: { name?: string; icon?: PlaceIcon; note?: string | null; location?: LatLng } = {};
  if (f.name.trim() !== p.name) out.name = f.name.trim();
  if (f.icon !== p.icon) out.icon = f.icon;
  if ((f.note.trim() || null) !== (p.note ?? null)) out.note = f.note.trim() || null;
  if (canMove && (round6(f.point.lat) !== p.location.lat || round6(f.point.lng) !== p.location.lng)) out.location = { lat: round6(f.point.lat), lng: round6(f.point.lng) };
  return out;
}

export const formOf = (p: Place): PlaceForm => ({ name: p.name, icon: p.icon, note: p.note ?? '', point: p.location });
