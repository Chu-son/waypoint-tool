/**
 * Commands on the items of the layer tree that the panel's menus and the keyboard shortcuts share:
 * grouping, ungrouping and deleting with confirmation.
 */
import { DialogAPI } from '../api';
import { useAppStore } from '../stores/appStore';
import { descendantLayerIds, topLevelInStackOrder } from '../utils/layerTree';

/** Ids selected in the layer tree, or none when something else is selected. */
export function selectedLayerItemIds(): string[] {
  const { selection } = useAppStore.getState();
  return selection.type === 'layers' ? selection.ids : [];
}

/** Wraps the items in a new group and selects it; returns its id. */
export function groupLayerItems(ids: string[]): string | null {
  const store = useAppStore.getState();
  const groupId = store.groupLayerItems(ids);
  if (groupId) store.setSelection({ type: 'layers', ids: [groupId], selectedObjectId: null });
  return groupId;
}

/** Dissolves the groups among `ids`, selecting what they held. */
export function ungroupLayerItems(ids: string[]): void {
  const store = useAppStore.getState();
  const groups = ids.filter((id) => store.layerGroups[id]);
  if (groups.length === 0) return;
  const released = groups.flatMap((id) => store.layerGroups[id].children_ids);
  store.runInHistoryTransaction(() => groups.forEach((id) => useAppStore.getState().ungroupLayerGroup(id)));
  useAppStore.getState().setSelection({ type: 'layers', ids: released, selectedObjectId: null });
}

/**
 * Asks, then deletes the items with everything inside the groups among them. One undo step brings back
 * the custom layers and groups; removed maps stay removed (adding and removing maps is not undone).
 */
export async function confirmRemoveLayerItems(ids: string[]): Promise<boolean> {
  const state = useAppStore.getState();
  const items = topLevelInStackOrder(state, ids);
  if (items.length === 0) return false;
  const layerIds = items.flatMap((id) => (state.layerGroups[id] ? descendantLayerIds(state, id) : [id]));
  const mapCount = layerIds.filter((id) => state.mapLayers.some((l) => l.id === id)).length;
  const groupCount = items.filter((id) => state.layerGroups[id]).length;

  const nameOf = (id: string) =>
    state.layerGroups[id]?.name ??
    state.mapLayers.find((l) => l.id === id)?.name ??
    state.customLayers.find((l) => l.id === id)?.name ??
    id;
  const subject = items.length === 1 ? `'${nameOf(items[0])}'` : `${items.length} 個の項目`;
  const lines = [`${subject} を削除しますか？`];
  if (groupCount > 0) lines.push(`グループの中のレイヤー（${layerIds.length} 枚）も削除されます。`);
  if (mapCount > 0) lines.push(`マップ（${mapCount} 枚）の削除は元に戻せません。`);
  const confirmed = await DialogAPI.ask(lines.join('\n'), { title: 'Remove Layers', kind: 'warning' });
  if (!confirmed) return false;

  const store = useAppStore.getState();
  if (store.activeCustomLayerId && layerIds.includes(store.activeCustomLayerId) && store.isMapEditMode) {
    store.transitionToMode({ mode: 'select' });
  }
  if (store.activeMapLayerId && layerIds.includes(store.activeMapLayerId)) store.setActiveMapLayerId(null);
  store.runInHistoryTransaction(() => {
    for (const id of items) {
      const current = useAppStore.getState();
      if (current.layerGroups[id]) current.removeLayerGroup(id, { withContents: true });
      else if (current.mapLayers.some((l) => l.id === id)) current.removeMapLayer(id);
      else current.removeCustomLayer(id);
    }
  });
  return true;
}
