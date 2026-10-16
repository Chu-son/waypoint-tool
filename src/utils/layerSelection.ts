/**
 * Pure helpers for a selection in the layer tree (`ActiveSelection` of type `layers`).
 */
import type { LayerGroup, ProjectMapLayer } from '../types/layer';

type LayerKinds = { mapLayers: Pick<ProjectMapLayer, 'id'>[]; layerGroups: Record<string, LayerGroup> };

/**
 * The custom layer the selection works on (inspector, vector editing): the id selected alone, unless it is
 * a map instance or a group. An id with no layer yet stands for a layer being created (the plugin layer
 * inspector opens on `'new'`).
 */
export function selectedCustomLayerId(ids: readonly string[], stack: LayerKinds): string | null {
  if (ids.length !== 1) return null;
  const [id] = ids;
  if (stack.layerGroups[id] || stack.mapLayers.some((l) => l.id === id)) return null;
  return id;
}

/** What kind of item of the layer tree `id` is. */
export function layerItemKind(id: string, stack: LayerKinds): 'map' | 'group' | 'custom' {
  if (stack.layerGroups[id]) return 'group';
  if (stack.mapLayers.some((l) => l.id === id)) return 'map';
  return 'custom';
}
