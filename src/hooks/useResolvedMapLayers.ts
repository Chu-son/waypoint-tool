import { useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { orderedMapLayers } from '../utils/layerStack';
import type { ResolvedMapLayer } from '../types/layer';

/**
 * Map instances joined with their source's image and metadata, ordered from the top of the stack to the
 * bottom, as composited (a map inside a hidden group comes back hidden).
 */
export function useResolvedMapLayers(): ResolvedMapLayer[] {
  const mapSources = useAppStore((state) => state.mapSources);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const rootLayerIds = useAppStore((state) => state.rootLayerIds);
  const layerGroups = useAppStore((state) => state.layerGroups);
  return useMemo(
    () => orderedMapLayers({ mapSources, mapLayers, rootLayerIds, layerGroups }),
    [mapSources, mapLayers, rootLayerIds, layerGroups],
  );
}
