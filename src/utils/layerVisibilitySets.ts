/**
 * Pure helpers for layer visibility sets: named on/off snapshots of the layer stack.
 *
 * A set decides only for the layers it knew when it was saved. Layers added later are "undecided",
 * and entries for layers that no longer exist are ignored, so a set never needs cleaning up by hand.
 */
import type { LayerVisibilitySet } from '../types/layer';
import type { LayerStack } from './layerStack';
import { ancestorGroupIds, buildLayerParentIndex } from './layerTree';

export type StackLayers = Pick<LayerStack, 'mapLayers' | 'customLayers' | 'rootLayerIds' | 'layerGroups'>;

/**
 * Own visible flag of every layer and group in the stack, by id. A group's flag is kept apart from its
 * children's, so a set restores both; what is actually drawn is `effectiveLayerVisibility`.
 */
export function currentLayerVisibility({
  mapLayers,
  customLayers,
  layerGroups,
}: Pick<StackLayers, 'mapLayers' | 'customLayers' | 'layerGroups'>): Record<string, boolean> {
  const visibility: Record<string, boolean> = {};
  for (const group of Object.values(layerGroups)) visibility[group.id] = group.visible;
  for (const layer of mapLayers) visibility[layer.id] = layer.visible;
  for (const layer of customLayers) visibility[layer.id] = layer.visible;
  return visibility;
}

/**
 * Whether each layer is drawn: its own flag in `own` AND the flags of every group above it. Groups are
 * not in the result, since only layers are composited.
 */
export function effectiveLayerVisibility(own: Record<string, boolean>, stack: StackLayers): Record<string, boolean> {
  const parentIndex = buildLayerParentIndex(stack);
  const effective: Record<string, boolean> = {};
  for (const layer of [...stack.mapLayers, ...stack.customLayers]) {
    effective[layer.id] =
      own[layer.id] === true && ancestorGroupIds(stack, layer.id, parentIndex).every((g) => own[g] !== false);
  }
  return effective;
}

/**
 * Ids of layers the set has no entry for. A layer under a group the set hides is not undecided: it is
 * not drawn either way. With `exportableOnly`, reference layers are left out because they never take
 * part in an export.
 */
export function undecidedLayerIds(
  set: LayerVisibilitySet,
  stack: StackLayers,
  options: { exportableOnly?: boolean } = {},
): string[] {
  const customs = options.exportableOnly ? stack.customLayers.filter((l) => !l.is_reference) : stack.customLayers;
  const parentIndex = buildLayerParentIndex(stack);
  return [...stack.mapLayers, ...customs]
    .map((l) => l.id)
    .filter((id) => !(id in set.visibility))
    .filter((id) => !ancestorGroupIds(stack, id, parentIndex).some((g) => set.visibility[g] === false));
}

/** True when a layer the set decides on is shown differently from what the set says. */
export function differsFromSet(set: LayerVisibilitySet, stack: StackLayers): boolean {
  const current = currentLayerVisibility(stack);
  return Object.entries(current).some(([id, visible]) => id in set.visibility && set.visibility[id] !== visible);
}

/** Visibility of every layer under the set: its decisions, with undecided layers as they are now. */
export function resolveSetVisibility(set: LayerVisibilitySet, stack: StackLayers): Record<string, boolean> {
  const current = currentLayerVisibility(stack);
  return Object.fromEntries(Object.entries(current).map(([id, visible]) => [id, set.visibility[id] ?? visible]));
}

/** `base` made unique among `existingNames` by appending " (2)", " (3)", ... */
export function uniqueSetName(base: string, existingNames: string[]): string {
  const taken = new Set(existingNames);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}
