import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Bookmark, Crop, Folder, FolderOpen, Map as MapIcon, Pencil, Settings2, Sparkles } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { TreeView } from '../trees/core/TreeView';
import type { TreeRowContent } from '../trees/core/TreeRow';
import { canMoveInLayerTree, idsHiddenByGroups } from '../../../utils/layerTree';
import { layerItemKind } from '../../../utils/layerSelection';
import type { DropTarget, TreeModel, TreeRowInfo } from '../../../utils/treeCore';
import { cn } from '../../../utils/cn';
import { LayerTreeContextMenu, type LayerMenuState } from './LayerTreeContextMenu';

export const LAYER_TREE_ID = 'layers';

const Badge = ({ children, title, className }: { children: React.ReactNode; title?: string; className?: string }) => (
  <span
    title={title}
    className={cn(
      'text-[9px] font-bold uppercase px-1 rounded shrink-0 hidden xs:inline-block sm:inline-block',
      className,
    )}
  >
    {children}
  </span>
);

/** The layer stack as a tree: maps, custom layers and groups, top of the stack first. */
export function LayerTree() {
  const { rootLayerIds, layerGroups, mapLayers, customLayers, selection } = useAppStore(
    useShallow((state) => ({
      rootLayerIds: state.rootLayerIds,
      layerGroups: state.layerGroups,
      mapLayers: state.mapLayers,
      customLayers: state.customLayers,
      selection: state.selection,
    })),
  );
  const isMapEditMode = useAppStore((state) => state.isMapEditMode);
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const activeMapLayerId = useAppStore((state) => state.activeMapLayerId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<LayerMenuState | null>(null);

  const tree = useMemo(() => ({ rootLayerIds, layerGroups }), [rootLayerIds, layerGroups]);
  const model: TreeModel = useMemo(
    () => ({ rootIds: rootLayerIds, childrenOf: (id) => layerGroups[id]?.children_ids }),
    [rootLayerIds, layerGroups],
  );
  const hiddenByGroups = useMemo(() => idsHiddenByGroups(tree), [tree]);
  const mapById = useMemo(() => new Map(mapLayers.map((l) => [l.id, l])), [mapLayers]);
  const customById = useMemo(() => new Map(customLayers.map((l) => [l.id, l])), [customLayers]);
  const sharedCountBySource = useMemo(() => {
    const counts = new Map<string, number>();
    mapLayers.forEach((l) => counts.set(l.sourceId, (counts.get(l.sourceId) ?? 0) + 1));
    return counts;
  }, [mapLayers]);
  const selectedIds = selection.type === 'layers' ? selection.ids : [];

  const select = useCallback((ids: string[]) => {
    const store = useAppStore.getState();
    store.setSelection(ids.length > 0 ? { type: 'layers', ids, selectedObjectId: null } : { type: 'none' });
  }, []);

  const toggleVectorEdit = (id: string) => {
    const store = useAppStore.getState();
    if (store.isMapEditMode && store.activeCustomLayerId === id) {
      store.setMapEditMode(false);
      return;
    }
    select([id]);
    store.setMapEditMode(true);
  };

  const renderRow = (row: TreeRowInfo): TreeRowContent | null => {
    const hiddenByAncestor = hiddenByGroups.has(row.id);
    const group = layerGroups[row.id];
    if (group) {
      return {
        name: group.name,
        icon: row.isExpanded ? (
          <FolderOpen size={13} className="text-accent-anchor" />
        ) : (
          <Folder size={13} className="text-accent-anchor" />
        ),
        badges: (
          <span className="text-[9px] px-1.5 rounded-full bg-surface-hover text-text-muted border border-border-base/30 shrink-0 font-mono font-bold">
            {group.children_ids.length}
          </span>
        ),
        visible: group.visible,
        hiddenByAncestor,
      };
    }

    const map = mapById.get(row.id);
    if (map) {
      const shared = sharedCountBySource.get(map.sourceId) ?? 1;
      const isTarget = isMapEditMode && activeMapLayerId === map.id;
      return {
        name: map.name,
        icon: <MapIcon size={13} className="text-accent-generator" />,
        badges: (
          <>
            {shared > 1 && (
              <Badge title="同じマップを他のレイヤーと共有しています" className="bg-primary-base/15 text-primary-base">
                ×{shared}
              </Badge>
            )}
            {map.origin_override && (
              <Badge
                title="このレイヤーだけの位置を持っています"
                className="bg-accent-generator/20 text-accent-generator"
              >
                Own
              </Badge>
            )}
            {map.clip && (
              <Badge title="使用領域を限定しています" className="bg-accent-generator/20 text-accent-generator">
                Clip
              </Badge>
            )}
          </>
        ),
        actions: isMapEditMode ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${map.name} を編集対象マップにする`}
            aria-pressed={isTarget}
            title="編集対象マップ（手描きの塗りの基準）"
            onClick={(e) => {
              e.stopPropagation();
              useAppStore.getState().setActiveMapLayerId(map.id);
            }}
            className={cn('w-5 h-5 p-0', isTarget ? 'text-accent-generator' : 'text-text-muted/50')}
          >
            <Crop size={11} />
          </Button>
        ) : undefined,
        visible: map.visible,
        hiddenByAncestor,
      };
    }

    const layer = customById.get(row.id);
    if (!layer) return null;
    const isManual = layer.type === 'manual';
    const isEditing = isMapEditMode && activeCustomLayerId === layer.id && isManual;
    return {
      name: layer.name,
      icon: isManual ? (
        <Pencil size={13} className="text-primary-base" />
      ) : (
        <Sparkles size={13} className="text-accent-automation" />
      ),
      badges: layer.is_reference ? (
        <Badge
          title="参照レイヤー（合成・エクスポートしない）"
          className="bg-accent-reference/20 text-accent-reference"
        >
          <Bookmark size={9} className="inline fill-accent-reference" /> Ref
        </Badge>
      ) : undefined,
      actions: (
        <Button
          variant="ghost"
          size="sm"
          aria-label={
            isManual
              ? isEditing
                ? `${layer.name} のベクター編集を終了`
                : `${layer.name} をベクター編集`
              : `${layer.name} のパラメータを編集`
          }
          aria-pressed={isManual ? isEditing : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (isManual) toggleVectorEdit(layer.id);
            else select([layer.id]);
          }}
          className={cn('w-5 h-5 p-0', isEditing ? 'text-primary-base bg-primary-base/15' : 'text-text-muted/60')}
        >
          {isManual ? <Pencil size={11} /> : <Settings2 size={11} />}
        </Button>
      ),
      visible: layer.visible,
      hiddenByAncestor,
    };
  };

  const toggleVisible = (id: string) => {
    const store = useAppStore.getState();
    const kind = layerItemKind(id, store);
    if (kind === 'group') store.setLayerGroupVisible(id, !store.layerGroups[id].visible);
    else if (kind === 'map') store.updateMapLayer(id, { visible: !mapById.get(id)?.visible });
    else store.updateCustomLayer(id, { visible: !customById.get(id)?.visible });
  };

  const rename = (id: string, name: string) => {
    const store = useAppStore.getState();
    const kind = layerItemKind(id, store);
    if (kind === 'group') store.renameLayerGroup(id, name);
    else if (kind === 'map') store.updateMapLayer(id, { name });
    else store.updateCustomLayer(id, { name });
  };

  return (
    <>
      <TreeView
        treeId={LAYER_TREE_ID}
        ariaLabel="Layers"
        model={model}
        selectedIds={selectedIds}
        onSelectionChange={select}
        renderRow={renderRow}
        onToggleVisible={toggleVisible}
        onRename={rename}
        editingId={editingId}
        onEditingChange={setEditingId}
        canDrop={(ids, target: DropTarget) => canMoveInLayerTree(tree, ids, target.targetId, target.position)}
        onDrop={(ids, target) => useAppStore.getState().moveLayerItems(ids, target.targetId, target.position)}
        onItemContextMenu={(e, id) => setMenu({ id, x: e.clientX, y: e.clientY })}
        onBackgroundContextMenu={(e) => setMenu({ id: null, x: e.clientX, y: e.clientY })}
        emptyState={<EmptyState message="No maps or custom layers. Click above to add." />}
      />
      {menu && (
        <LayerTreeContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onRename={setEditingId}
          onToggleVectorEdit={toggleVectorEdit}
        />
      )}
    </>
  );
}
