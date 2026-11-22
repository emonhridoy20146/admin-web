import { MapPinned } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useMoveRequestBadge } from './api/places';
import { PlacesLayer } from './components/places-layer';
import { LAYER_ID } from './model/places';

/** FR-PLC-001..006: map places (text markers with an icon) staff and the office add; staff move requests approved here (field-api ADR-051). */
export const placesManifest: FeatureManifest = {
  name: 'places',
  flag: 'module.places',
  routes: [
    { path: '/places', title: 'places:title', permission: 'place.view', navGroup: 'field', icon: MapPinned, order: 56, useBadge: useMoveRequestBadge },
    { path: '/places/move-requests', title: 'places:moves.title', permission: 'place.manage', hidden: true },
  ],
  permissions: ['place.view', 'place.create', 'place.manage'],
  events: { emits: [EV.placeChanged] },
  commands: [
    { id: 'places.open', title: 'places:title', icon: MapPinned, href: '/places/', permission: 'place.view', keywords: ['place', 'landmark', 'shop', 'map', 'জায়গা', 'দোকান'] },
    { id: 'places.moves', title: 'places:moves.title', icon: MapPinned, href: '/places/move-requests/', permission: 'place.manage', keywords: ['move', 'request', 'সরানো'] },
  ],
  widgets: { mapLayers: [{ id: LAYER_ID, title: 'places:layer', order: 10, permission: 'place.view', component: PlacesLayer }] },
  messages: { bn, en },
};
