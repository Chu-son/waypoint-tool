import { ancestorGroupIds, type LayerTree } from './layerTree';

export interface HiddenCause {
  /** The layer or group whose own flag is off (the item itself, or the nearest group above it). */
  id: string;
  name: string;
  /** True when it is the item itself, false when a group above it hides it. */
  isSelf: boolean;
}

interface LayerHiddenState extends LayerTree {
  mapLayers: readonly { id: string; name: string; visible: boolean }[];
  customLayers: readonly { id: string; name: string; visible: boolean }[];
}

/** Why a layer or group is not shown (its own flag, else the nearest hidden group above it), or null when shown. */
export function hiddenCauseOf(state: LayerHiddenState, id: string): HiddenCause | null {
  const self = state.layerGroups[id] ?? [...state.mapLayers, ...state.customLayers].find((l) => l.id === id);
  if (!self) return null;
  if (!self.visible) return { id, name: self.name, isSelf: true };
  for (const groupId of ancestorGroupIds(state, id)) {
    const group = state.layerGroups[groupId];
    if (group && !group.visible) return { id: groupId, name: group.name, isSelf: false };
  }
  return null;
}
