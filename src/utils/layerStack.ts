/**
 * Pure helpers for the unified layer stack.
 *
 * Map instances (`mapLayers`) and custom layers (`customLayers`) are stored in separate collections
 * because their data differs, but they share ONE stacking order: the layer tree (`rootLayerIds` and the
 * groups' `children_ids`, see `layerTree.ts`), flattened from the top of the stack to the bottom.
 *
 * The helpers that feed drawing, preview and export (`stackEntries`, `orderedMapLayers`) return layers
 * as they are composited: a layer inside a hidden group comes back with `visible: false`. Panels that
 * edit a layer's own flag read the layer from the store instead.
 */
import type { CustomLayer, MapSource, ProjectMapLayer, ResolvedMapLayer } from '../types/layer';
import { idsHiddenByGroups, layerOrderOf, type LayerTree } from './layerTree';

/** The slice of application state that defines the stack. Store state satisfies this structurally. */
export interface LayerStack extends LayerTree {
  mapSources: MapSource[];
  mapLayers: ProjectMapLayer[];
  customLayers: CustomLayer[];
}

export type StackEntry = { kind: 'map'; layer: ProjectMapLayer } | { kind: 'custom'; layer: CustomLayer };

/** Joins every map instance with the pixel data and metadata of its source. */
export function resolveMapLayers(mapSources: MapSource[], mapLayers: ProjectMapLayer[]): ResolvedMapLayer[] {
  const sourceById = new Map(mapSources.map((s) => [s.id, s]));
  const resolved: ResolvedMapLayer[] = [];
  for (const layer of mapLayers) {
    const source = sourceById.get(layer.sourceId);
    if (!source) continue;
    resolved.push({
      ...layer,
      info: layer.origin_override ? { ...source.info, origin: layer.origin_override } : source.info,
      image_base64: source.image_base64,
      width: source.width,
      height: source.height,
    });
  }
  return resolved;
}

/** `layer` as composited: hidden when a group above it is hidden. Unaffected layers keep their identity. */
function asComposited<T extends { id: string; visible: boolean }>(layer: T, hiddenByGroups: Set<string>): T {
  return layer.visible && hiddenByGroups.has(layer.id) ? { ...layer, visible: false } : layer;
}

/** Resolved map instances ordered from the top of the stack to the bottom, as composited. */
export function orderedMapLayers(
  stack: Pick<LayerStack, 'mapSources' | 'mapLayers' | keyof LayerTree>,
): ResolvedMapLayer[] {
  const resolvedById = new Map(resolveMapLayers(stack.mapSources, stack.mapLayers).map((l) => [l.id, l]));
  const hidden = idsHiddenByGroups(stack);
  const ordered: ResolvedMapLayer[] = [];
  for (const id of layerOrderOf(stack)) {
    const layer = resolvedById.get(id);
    if (layer) ordered.push(asComposited(layer, hidden));
  }
  return ordered;
}

/** Resolution (m/px) that manual layers are rasterized at: the top visible map's, else the ROS default. */
export function baseMapResolution(stack: Pick<LayerStack, 'mapSources' | 'mapLayers' | keyof LayerTree>): number {
  return orderedMapLayers(stack).find((l) => l.visible)?.info?.resolution || 0.05;
}

/**
 * All layers from the top of the stack to the bottom, as composited. Ids in the tree that no longer
 * exist are skipped.
 */
export function stackEntries(stack: Omit<LayerStack, 'mapSources'>): StackEntry[] {
  const mapById = new Map(stack.mapLayers.map((l) => [l.id, l]));
  const customById = new Map(stack.customLayers.map((l) => [l.id, l]));
  const hidden = idsHiddenByGroups(stack);
  const entries: StackEntry[] = [];
  for (const id of layerOrderOf(stack)) {
    const map = mapById.get(id);
    if (map) {
      entries.push({ kind: 'map', layer: asComposited(map, hidden) });
      continue;
    }
    const custom = customById.get(id);
    if (custom) entries.push({ kind: 'custom', layer: asComposited(custom, hidden) });
  }
  return entries;
}

/**
 * Makes `order` list exactly the layers that exist: unknown ids and duplicates are dropped, and layers
 * missing from `order` are added at the top of the stack (where newly added layers appear).
 */
export function reconcileLayerOrder(order: string[], existingIds: string[]): string[] {
  const existing = new Set(existingIds);
  const kept: string[] = [];
  const keptSet = new Set<string>();
  for (const id of order) {
    if (existing.has(id) && !keptSet.has(id)) {
      kept.push(id);
      keptSet.add(id);
    }
  }
  const missing = existingIds.filter((id) => !keptSet.has(id));
  return [...missing, ...kept];
}

/** Compositing z-index per layer id: 0 is the bottom of the stack. */
export function stackZIndexes(layerOrder: string[]): Map<string, number> {
  const z = new Map<string, number>();
  layerOrder.forEach((id, index) => z.set(id, layerOrder.length - 1 - index));
  return z;
}

/**
 * `tree` with `extraLayers` (temporary layers that are not part of the stack, e.g. intermediate pipeline
 * results) placed directly below the lowest custom layer, in the same group, or on top when there is none.
 */
export function insertBelowCustomLayers(
  tree: LayerTree,
  customLayers: CustomLayer[],
  extraLayers: CustomLayer[],
): LayerTree {
  const customIds = new Set(customLayers.map((l) => l.id));
  const lowestCustom = [...layerOrderOf(tree)].reverse().find((id) => customIds.has(id));
  const extraIds = extraLayers.map((l) => l.id);
  const after = (list: string[]) => {
    const at = lowestCustom ? list.indexOf(lowestCustom) : -1;
    return at < 0 ? null : [...list.slice(0, at + 1), ...extraIds, ...list.slice(at + 1)];
  };
  const root = after(tree.rootLayerIds);
  if (root) return { ...tree, rootLayerIds: root };
  for (const group of Object.values(tree.layerGroups)) {
    const children = after(group.children_ids);
    if (children)
      return { ...tree, layerGroups: { ...tree.layerGroups, [group.id]: { ...group, children_ids: children } } };
  }
  return { ...tree, rootLayerIds: [...extraIds, ...tree.rootLayerIds] };
}
