'use client';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { MapMarker, MapViewState } from '../map/map-view';
import { mapLayers } from './registry';
import type { MapLayerDef } from './types';
import { useGate } from './useGate';

export interface MapLayersHost {
  /** the layers the user may see (flag + permission), for a switch per layer */
  layers: MapLayerDef[];
  /** markers of the shown layers, to add to the map's own markers */
  markers: MapMarker[];
  /** true when a marker id belongs to a layer */
  owns: (markerId: string) => boolean;
  /** opens the layer's drawer for one of its markers; false for a marker that is not a layer's */
  open: (markerId: string) => boolean;
  /** the layer components (data + drawers): render once anywhere on the page */
  element: ReactNode;
}

/**
 * Extension point `widgets.mapLayers` on any map (FR-PLC-001: places on every map). The map page passes its view;
 * the hook renders the layers, collects their markers and opens their drawers. Which marker is open is kept here
 * unless the page keeps it itself (the customer map keeps it in the link: `open` + `onOpen`).
 * `passive` maps (point pickers) only show the markers: nothing opens and clicks go to the map.
 */
export function useMapLayers(opts: { view: MapViewState | null; hidden?: string[]; open?: string | null; onOpen?: (markerId: string | null) => void; passive?: boolean }): MapLayersHost {
  const { view, hidden, passive } = opts;
  const gate = useGate();
  const all = mapLayers(gate);
  const ids = all.map((l) => l.id).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layers = useMemo(() => all, [ids]);
  const hiddenKey = (hidden ?? []).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => layers.filter((l) => !(hidden ?? []).includes(l.id)), [layers, hiddenKey]);
  const [own, setOwn] = useState<string | null>(null);
  const openKey = opts.onOpen ? (opts.open ?? null) : own;
  const setOpen = opts.onOpen ?? setOwn;
  const [byLayer, setByLayer] = useState<Record<string, MapMarker[]>>({});
  const report = useCallback((id: string, m: MapMarker[]) => setByLayer((s) => (s[id] === m ? s : { ...s, [id]: m })), []);
  const markers = useMemo(() => shown.flatMap((l) => byLayer[l.id] ?? []).map((m) => (passive ? { ...m, passive: true } : m)), [shown, byLayer, passive]);
  const owns = useCallback((id: string) => layers.some((l) => id.startsWith(`${l.id}:`)), [layers]);
  const open = useCallback((id: string) => {
    if (passive || !owns(id)) return false;
    setOpen(id);
    return true;
  }, [passive, owns, setOpen]);
  const element = (
    <>
      {shown.map((l) => (
        <l.component
          key={l.id}
          bounds={view?.bounds ?? null}
          zoom={view?.zoom ?? null}
          onMarkers={(m) => report(l.id, m)}
          openId={!passive && openKey?.startsWith(`${l.id}:`) ? openKey.slice(l.id.length + 1) : null}
          onClose={() => setOpen(null)}
        />
      ))}
    </>
  );
  return { layers, markers, owns, open, element };
}
