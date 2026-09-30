import { useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { orderedMapLayers } from '../utils/layerStack';
import type { ResolvedMapLayer } from '../types/layer';

/** Map instances joined with their source's image and metadata, ordered from the top of the stack to the bottom. */
export function useResolvedMapLayers(): ResolvedMapLayer[] {
  const mapSources = useAppStore((state) => state.mapSources);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const layerOrder = useAppStore((state) => state.layerOrder);
  return useMemo(() => orderedMapLayers({ mapSources, mapLayers, layerOrder }), [mapSources, mapLayers, layerOrder]);
}
