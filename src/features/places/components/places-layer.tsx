'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapLayerProps } from '@/shared/feature/types';
import { bboxParam } from '@/shared/map/geo';
import { usePlace, usePlaces } from '../api/places';
import { LAYER_ID, PLACE_ICON_ZOOM, placeMarkers } from '../model/places';
import { PlaceDrawer } from './place-drawer';

/**
 * FR-PLC-001: map places on every map (extension point `mapLayers`), with the zoom rules of `placeMarkers`: nothing
 * zoomed out (and nothing loaded), the square icon in the middle, icon and name close in.
 */
export function PlacesLayer({ bounds, zoom, onMarkers, openId, onClose }: MapLayerProps) {
  const { t } = useTranslation('places');
  const near = zoom != null && zoom >= PLACE_ICON_ZOOM;
  const q = usePlaces({ bbox: bounds ? bboxParam(bounds) : undefined, limit: 1000 }, !!bounds && near);
  const items = useMemo(() => q.data?.items ?? [], [q.data?.items]);
  const report = useRef(onMarkers);
  report.current = onMarkers;
  const markers = useMemo(() => placeMarkers(items, { zoom, selectedId: openId, prefix: `${LAYER_ID}:`, movedTitle: (p) => t('map.requestedPoint', { name: p.name }) }).markers, [items, zoom, openId, t]);
  useEffect(() => report.current(markers), [markers]);
  // the map page drops the layer when it is switched off: take the markers away with it
  useEffect(() => () => report.current([]), []);
  const inList = items.find((p) => p.id === openId) ?? null;
  const one = usePlace(openId, !inList && !q.isLoading);
  return <PlaceDrawer place={inList ?? one.data ?? null} onClose={onClose} />;
}
