/**
 * What undo/redo records, in one place. Every undoable value of the store is listed in `HISTORY_FIELDS`;
 * capturing a snapshot, telling whether anything changed and restoring are all derived from that list,
 * so making more state undoable is a matter of adding one entry.
 *
 * Snapshots hold references to the store's values instead of copies: the store never mutates a value in
 * place, so a value captured earlier stays as it was (tests deep-freeze captured values to enforce this).
 *
 * Not listed on purpose: the settings screen (footprint, path style, conditional styles, export templates
 * and profiles, occupancy defaults, ...) and view state (zoom, panels, tools). Those are not undone.
 */
import type { AppState } from '../appStore';
import type { ActiveSelection } from '../../types/selection';
import type { InsertionTarget } from '../../types/store';
import { validateAndCorrectInsertionTarget } from '../../utils/treeUtils';
import { allTreeIds, normalizeLayerTree } from '../../utils/layerTree';
import { selectedCustomLayerId } from '../../utils/layerSelection';

/**
 * How a recorded value is put back.
 * - `replace`: the recorded value as it was.
 * - `mergeById`: items are matched by id. Items the snapshot knows get its version back; items added
 *   since stay, and items removed since stay removed. Used for maps, whose adding and removing is not undone.
 */
type RestoreMode = 'replace' | 'mergeById';

export const HISTORY_FIELDS = {
  nodes: 'replace',
  rootNodeIds: 'replace',
  annotationObjects: 'replace',
  annotationOrder: 'replace',
  annotationGroups: 'replace',
  rootAnnotationIds: 'replace',
  customLayers: 'replace',
  rootLayerIds: 'replace',
  layerGroups: 'replace',
  mapLayers: 'mergeById',
  mapSources: 'mergeById',
  exportRegions: 'replace',
  layerVisibilitySets: 'replace',
  activeLayerVisibilitySetId: 'replace',
  geoMap: 'replace',
} as const satisfies Partial<Record<keyof AppState, RestoreMode>>;

export type HistoryKey = keyof typeof HISTORY_FIELDS;
const HISTORY_KEYS = Object.keys(HISTORY_FIELDS) as HistoryKey[];

/**
 * The undoable values at one moment, plus what goes back with them without counting as a change: the
 * selection (and the anchor and insertion point that depend on it). Selecting alone is not recorded.
 */
export type HistorySnapshot = Pick<AppState, HistoryKey> & {
  selection: ActiveSelection;
  anchorNodeId: string | null;
  insertionTarget: InsertionTarget | null;
};

export const captureSnapshot = (state: AppState): HistorySnapshot => {
  const values = Object.fromEntries(HISTORY_KEYS.map((key) => [key, state[key]])) as Pick<AppState, HistoryKey>;
  return {
    ...values,
    selection: state.selection,
    anchorNodeId: state.anchorNodeId,
    insertionTarget: state.insertionTarget,
  };
};

/** True when no undoable value differs from `snapshot` (compared by reference). */
export const matchesSnapshot = (snapshot: HistorySnapshot, state: AppState): boolean =>
  HISTORY_KEYS.every((key) => snapshot[key] === state[key]);

/** The undoable values that differ from `snapshot`; for diagnostics. */
export const changedKeys = (snapshot: Pick<AppState, HistoryKey>, state: Pick<AppState, HistoryKey>): HistoryKey[] =>
  HISTORY_KEYS.filter((key) => snapshot[key] !== state[key]);

const mergeById = <T extends { id: string }>(current: T[], recorded: T[]): T[] => {
  const byId = new Map(recorded.map((item) => [item.id, item]));
  return current.map((item) => byId.get(item.id) ?? item);
};

/**
 * The selection restored with a snapshot. Layers selected then but gone now (maps removed since: removing
 * a map is not undone) drop out of it.
 */
const restoredSelection = (
  restored: Pick<AppState, 'mapLayers' | 'layerGroups' | 'rootLayerIds' | 'customLayers'>,
  selection: ActiveSelection,
): Pick<
  AppState,
  'selection' | 'selectedNodeIds' | 'selectedAnnotationIds' | 'activeCustomLayerId' | 'selectedEditObjectId'
> => {
  const base = {
    selectedNodeIds: selection.type === 'nodes' ? selection.ids : [],
    selectedAnnotationIds: selection.type === 'annotations' ? selection.ids : [],
    activeCustomLayerId: null,
    selectedEditObjectId: null,
  };
  if (selection.type !== 'layers') return { ...base, selection };
  const existing = new Set(allTreeIds(restored));
  const ids = selection.ids.filter((id) => existing.has(id));
  if (ids.length === 0) return { ...base, selection: { type: 'none' } };
  const customLayerId = selectedCustomLayerId(ids, restored);
  const selectedObjectId = customLayerId ? selection.selectedObjectId : null;
  return {
    ...base,
    selection: { type: 'layers', ids, selectedObjectId },
    activeCustomLayerId: customLayerId,
    selectedEditObjectId: selectedObjectId,
  };
};

/** The state changes that put `snapshot` back over `state` (the unsaved flag is the caller's to set). */
export const restoreSnapshot = (state: AppState, snapshot: HistorySnapshot): Partial<AppState> => {
  const values: Partial<AppState> = {};
  for (const key of HISTORY_KEYS) {
    const mode: RestoreMode = HISTORY_FIELDS[key];
    (values as Record<string, unknown>)[key] =
      mode === 'mergeById'
        ? mergeById(state[key] as { id: string }[], snapshot[key] as { id: string }[])
        : snapshot[key];
  }
  const restored = values as Pick<AppState, HistoryKey>;
  // The tree holds exactly the layers that exist after restoring (maps added or removed since included).
  const tree = normalizeLayerTree({ rootLayerIds: restored.rootLayerIds, layerGroups: restored.layerGroups }, [
    ...restored.mapLayers.map((l) => l.id),
    ...restored.customLayers.map((l) => l.id),
  ]);
  const withTree = { ...restored, ...tree };
  return {
    ...withTree,
    ...restoredSelection(withTree, snapshot.selection),
    anchorNodeId: snapshot.anchorNodeId,
    insertionTarget: validateAndCorrectInsertionTarget(
      snapshot.insertionTarget ?? null,
      snapshot.rootNodeIds,
      snapshot.nodes,
    ),
  };
};
