import { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { AppState } from '../appStore';
import type { LayerVisibilitySet } from '../../types/layer';
import { currentLayerVisibility, resolveSetVisibility, uniqueSetName } from '../../utils/layerVisibilitySets';
import { changesAny, shallowEqual, updateById } from '../../utils/shallowChanges';

const DEFAULT_SET_NAME = 'Layer Set';

export type LayerVisibilitySlice = {
  /** Named on/off snapshots of the layer stack, used to switch the canvas and to choose what an export contains. */
  layerVisibilitySets: LayerVisibilitySet[];
  /** The set the current visibility was last taken from; null when none. */
  activeLayerVisibilitySetId: string | null;

  /** Saves the current visibility of every layer as a new set (renamed if the name is taken) and makes it active. */
  saveLayerVisibilitySet: (name: string) => string;
  /** Replaces a set with the current visibility of every layer, deciding any layers it had left undecided. */
  overwriteLayerVisibilitySet: (id: string) => void;
  renameLayerVisibilitySet: (id: string, name: string) => void;
  deleteLayerVisibilitySet: (id: string) => void;
  /** Shows and hides layers and groups as the set says. Items the set has no entry for keep their visibility. */
  applyLayerVisibilitySet: (id: string) => void;
};

export const createLayerVisibilitySlice: StateCreator<AppState, [], [], LayerVisibilitySlice> = (set, get) => ({
  layerVisibilitySets: [],
  activeLayerVisibilitySetId: null,

  saveLayerVisibilitySet: (name) => {
    const state = get();
    const created: LayerVisibilitySet = {
      id: uuidv4(),
      name: uniqueSetName(
        name.trim() || DEFAULT_SET_NAME,
        state.layerVisibilitySets.map((s) => s.name),
      ),
      visibility: currentLayerVisibility(state),
    };
    get().pushHistorySnapshot();
    set((s) => ({
      layerVisibilitySets: [...s.layerVisibilitySets, created],
      activeLayerVisibilitySetId: created.id,
      isDirty: true,
    }));
    return created.id;
  },

  overwriteLayerVisibilitySet: (id) => {
    const state = get();
    const target = state.layerVisibilitySets.find((s) => s.id === id);
    if (!target) return;
    const visibility = currentLayerVisibility(state);
    if (state.activeLayerVisibilitySetId === id && shallowEqual(target.visibility, visibility)) return;
    state.pushHistorySnapshot();
    set((s) => ({
      layerVisibilitySets: s.layerVisibilitySets.map((v) => (v.id === id ? { ...v, visibility } : v)),
      activeLayerVisibilitySetId: id,
      isDirty: true,
    }));
  },

  renameLayerVisibilitySet: (id, name) => {
    const state = get();
    const target = state.layerVisibilitySets.find((s) => s.id === id);
    if (!target) return;
    const others = state.layerVisibilitySets.filter((s) => s.id !== id).map((s) => s.name);
    const unique = uniqueSetName(name.trim() || DEFAULT_SET_NAME, others);
    const layerVisibilitySets = updateById(state.layerVisibilitySets, id, { name: unique });
    if (!layerVisibilitySets) return;
    state.pushHistorySnapshot();
    set({ layerVisibilitySets, isDirty: true });
  },

  deleteLayerVisibilitySet: (id) => {
    if (!get().layerVisibilitySets.some((s) => s.id === id)) return;
    get().pushHistorySnapshot();
    set((state) => ({
      layerVisibilitySets: state.layerVisibilitySets.filter((s) => s.id !== id),
      activeLayerVisibilitySetId: state.activeLayerVisibilitySetId === id ? null : state.activeLayerVisibilitySetId,
      isDirty: true,
    }));
  },

  applyLayerVisibilitySet: (id) => {
    const state = get();
    const target = state.layerVisibilitySets.find((s) => s.id === id);
    if (!target) return;

    const next = resolveSetVisibility(target, state);
    const current = currentLayerVisibility(state);
    // Re-applying the set that is already in effect changes nothing, so it is not an undo step.
    if (!changesAny(current, next) && state.activeLayerVisibilitySetId === id) return;
    state.pushHistorySnapshot();

    set((s) => ({
      mapLayers: s.mapLayers.map((l) => ({ ...l, visible: next[l.id] })),
      customLayers: s.customLayers.map((l) => ({ ...l, visible: next[l.id] })),
      layerGroups: Object.fromEntries(
        Object.entries(s.layerGroups).map(([groupId, g]) => [groupId, { ...g, visible: next[groupId] }]),
      ),
      activeLayerVisibilitySetId: id,
      isDirty: true,
    }));
  },
});
