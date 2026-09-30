import { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { AppState } from '../appStore';
import type { LayerVisibilitySet } from '../../types/layer';
import { currentLayerVisibility, resolveSetVisibility, uniqueSetName } from '../../utils/layerVisibilitySets';

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
  /** Shows and hides layers as the set says. Layers the set has no entry for keep their visibility. */
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
    set((s) => ({
      layerVisibilitySets: [...s.layerVisibilitySets, created],
      activeLayerVisibilitySetId: created.id,
      isDirty: true,
    }));
    return created.id;
  },

  overwriteLayerVisibilitySet: (id) =>
    set((state) => ({
      layerVisibilitySets: state.layerVisibilitySets.map((s) =>
        s.id === id ? { ...s, visibility: currentLayerVisibility(state) } : s,
      ),
      activeLayerVisibilitySetId: id,
      isDirty: true,
    })),

  renameLayerVisibilitySet: (id, name) =>
    set((state) => {
      const others = state.layerVisibilitySets.filter((s) => s.id !== id).map((s) => s.name);
      const unique = uniqueSetName(name.trim() || DEFAULT_SET_NAME, others);
      return {
        layerVisibilitySets: state.layerVisibilitySets.map((s) => (s.id === id ? { ...s, name: unique } : s)),
        isDirty: true,
      };
    }),

  deleteLayerVisibilitySet: (id) =>
    set((state) => ({
      layerVisibilitySets: state.layerVisibilitySets.filter((s) => s.id !== id),
      activeLayerVisibilitySetId: state.activeLayerVisibilitySetId === id ? null : state.activeLayerVisibilitySetId,
      isDirty: true,
    })),

  applyLayerVisibilitySet: (id) => {
    const target = get().layerVisibilitySets.find((s) => s.id === id);
    if (!target) return;

    const next = resolveSetVisibility(target, get());
    const current = currentLayerVisibility(get());
    const changes = Object.keys(next).some((layerId) => next[layerId] !== current[layerId]);
    // Only a real change is an undo step; re-applying the set that is already in effect is not.
    if (changes) get().pushHistorySnapshot({ includeMapVisibility: true });

    set((state) => ({
      mapLayers: state.mapLayers.map((l) => ({ ...l, visible: next[l.id] })),
      customLayers: state.customLayers.map((l) => ({ ...l, visible: next[l.id] })),
      activeLayerVisibilitySetId: id,
      isDirty: true,
    }));
  },
});
