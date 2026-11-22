'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapLayerProps } from '@/shared/feature/types';
import { bboxParam } from '@/shared/map/geo';
import { usePlace, usePlaces } from '../api/places';
import { LAYER_ID, placeMarkers } from '../model/places';
import { PlaceDrawer } from './place-drawer';

/** FR-PLC-001: map places on the customer map (extension point `mapLayers`), with their names always shown. */
export function PlacesLayer({ bounds, onMarkers, openId, onClose }: MapLayerProps) {
  const { t } = useTranslation('places');
  const q = usePlaces({ bbox: bounds ? bboxParam(bounds) : undefined, limit: 1000 }, !!bounds);
  const items = useMemo(() => q.data?.items ?? [], [q.data?.items]);
  const report = useRef(onMarkers);
  report.current = onMarkers;
  const markers = useMemo(() => placeMarkers(items, { selectedId: openId, prefix: `${LAYER_ID}:`, movedTitle: (p) => t('map.requestedPoint', { name: p.name }) }).markers, [items, openId, t]);
  useEffect(() => report.current(markers), [markers]);
  // the map page drops the layer when it is switched off: take the markers away with it
  useEffect(() => () => report.current([]), []);
  const inList = items.find((p) => p.id === openId) ?? null;
  const one = usePlace(openId, !inList && !q.isLoading);
  return <PlaceDrawer place={inList ?? one.data ?? null} onClose={onClose} />;
}
