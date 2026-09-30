/**
 * Pure helpers for layer visibility sets: named on/off snapshots of the layer stack.
 *
 * A set decides only for the layers it knew when it was saved. Layers added later are "undecided",
 * and entries for layers that no longer exist are ignored, so a set never needs cleaning up by hand.
 */
import type { LayerVisibilitySet } from '../types/layer';
import type { LayerStack } from './layerStack';

type StackLayers = Pick<LayerStack, 'mapLayers' | 'customLayers'>;

/** Visible flag of every layer in the stack, by layer id. */
export function currentLayerVisibility({ mapLayers, customLayers }: StackLayers): Record<string, boolean> {
  const visibility: Record<string, boolean> = {};
  for (const layer of mapLayers) visibility[layer.id] = layer.visible;
  for (const layer of customLayers) visibility[layer.id] = layer.visible;
  return visibility;
}

/**
 * Ids of layers the set has no entry for. With `exportableOnly`, reference layers are left out
 * because they never take part in an export.
 */
export function undecidedLayerIds(
  set: LayerVisibilitySet,
  { mapLayers, customLayers }: StackLayers,
  options: { exportableOnly?: boolean } = {},
): string[] {
  const customs = options.exportableOnly ? customLayers.filter((l) => !l.is_reference) : customLayers;
  return [...mapLayers, ...customs].map((l) => l.id).filter((id) => !(id in set.visibility));
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
