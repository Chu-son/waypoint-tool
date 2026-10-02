/**
 * Pure helpers for the unified layer stack.
 *
 * Map instances (`mapLayers`) and custom layers (`customLayers`) are stored in separate collections
 * because their data differs, but they share ONE stacking order: `layerOrder`, a list of layer ids
 * from the top of the stack to the bottom.
 */
import type { CustomLayer, MapSource, ProjectMapLayer, ResolvedMapLayer } from '../types/layer';

/** The slice of application state that defines the stack. Store state satisfies this structurally. */
export interface LayerStack {
  mapSources: MapSource[];
  mapLayers: ProjectMapLayer[];
  customLayers: CustomLayer[];
  layerOrder: string[];
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

/** Resolved map instances ordered from the top of the stack to the bottom. */
export function orderedMapLayers(
  stack: Pick<LayerStack, 'mapSources' | 'mapLayers' | 'layerOrder'>,
): ResolvedMapLayer[] {
  const resolvedById = new Map(resolveMapLayers(stack.mapSources, stack.mapLayers).map((l) => [l.id, l]));
  const ordered: ResolvedMapLayer[] = [];
  for (const id of stack.layerOrder) {
    const layer = resolvedById.get(id);
    if (layer) ordered.push(layer);
  }
  return ordered;
}

/** Resolution (m/px) that manual layers are rasterized at: the top visible map's, else the ROS default. */
export function baseMapResolution(stack: Pick<LayerStack, 'mapSources' | 'mapLayers' | 'layerOrder'>): number {
  return orderedMapLayers(stack).find((l) => l.visible)?.info?.resolution || 0.05;
}

/** All layers from the top of the stack to the bottom. Ids in `layerOrder` that no longer exist are skipped. */
export function stackEntries({ mapLayers, customLayers, layerOrder }: Omit<LayerStack, 'mapSources'>): StackEntry[] {
  const mapById = new Map(mapLayers.map((l) => [l.id, l]));
  const customById = new Map(customLayers.map((l) => [l.id, l]));
  const entries: StackEntry[] = [];
  for (const id of layerOrder) {
    const map = mapById.get(id);
    if (map) {
      entries.push({ kind: 'map', layer: map });
      continue;
    }
    const custom = customById.get(id);
    if (custom) entries.push({ kind: 'custom', layer: custom });
  }
  return entries;
}

/**
 * Makes `order` list exactly the layers that exist: unknown ids and duplicates are dropped, and layers
 * missing from `order` are added at the top of the stack (where newly added layers appear).
 */
export function reconcileLayerOrder(order: string[], existingIds: string[]): string[] {
  const existing = new Set(existingIds);
  const kept = order.filter((id, index) => existing.has(id) && order.indexOf(id) === index);
  const keptSet = new Set(kept);
  const missing = existingIds.filter((id) => !keptSet.has(id));
  return [...missing, ...kept];
}

/** Compositing z-index per layer id: 0 is the bottom of the stack. */
export function stackZIndexes(layerOrder: string[]): Map<string, number> {
  const z = new Map<string, number>();
  layerOrder.forEach((id, index) => z.set(id, layerOrder.length - 1 - index));
  return z;
}

/** `order` with `id` inserted directly above `aboveId`, or at the top when `aboveId` is null/unknown. */
export function insertAbove(order: string[], id: string, aboveId: string | null): string[] {
  const without = order.filter((o) => o !== id);
  const at = aboveId ? without.indexOf(aboveId) : -1;
  if (at < 0) return [id, ...without];
  return [...without.slice(0, at), id, ...without.slice(at)];
}

/**
 * `order` with `extraLayers` (temporary layers that are not part of the stack, e.g. intermediate
 * pipeline results) placed just below the lowest custom layer, or on top when there is none.
 */
export function insertBelowCustomLayers(
  order: string[],
  customLayers: CustomLayer[],
  extraLayers: CustomLayer[],
): string[] {
  const customIds = new Set(customLayers.map((l) => l.id));
  let lastCustomIndex = -1;
  order.forEach((id, index) => {
    if (customIds.has(id)) lastCustomIndex = index;
  });
  return [...order.slice(0, lastCustomIndex + 1), ...extraLayers.map((l) => l.id), ...order.slice(lastCustomIndex + 1)];
}

/** `order` with the layer at `fromIndex` moved to `toIndex` (both clamped into range). */
export function moveInOrder(order: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex < 0 || fromIndex >= order.length) return order;
  const target = Math.max(0, Math.min(order.length - 1, toIndex));
  const next = [...order];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(target, 0, moved);
  return next;
}
