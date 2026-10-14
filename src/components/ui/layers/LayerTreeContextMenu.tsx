import {
  Bookmark,
  Code2,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FolderOutput,
  FolderPlus,
  Link2,
  Pencil,
  Settings2,
  Trash2,
  Unlink,
  Unlink2,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../common/ContextMenu';
import { useAppStore } from '../../../stores/appStore';
import { confirmRemoveLayerItems, groupLayerItems, ungroupLayerItems } from '../../../services/layerCommands';
import { parentOf } from '../../../utils/layerTree';

export interface LayerMenuState {
  /** The item the menu was opened on; null for the empty area of the tree. */
  id: string | null;
  x: number;
  y: number;
}

interface LayerTreeContextMenuProps {
  menu: LayerMenuState;
  onClose: () => void;
  onRename: (id: string) => void;
  onToggleVectorEdit: (id: string) => void;
}

/**
 * Context menu of the layer tree, in the order of the tree standard (docs/RULES.md): main action, rename,
 * duplicate, grouping, visibility, then delete.
 */
export function LayerTreeContextMenu({ menu, onClose, onRename, onToggleVectorEdit }: LayerTreeContextMenuProps) {
  const data = useAppStore(
    useShallow((s) => ({
      rootLayerIds: s.rootLayerIds,
      layerGroups: s.layerGroups,
      mapLayers: s.mapLayers,
      customLayers: s.customLayers,
      selection: s.selection,
      isMapEditMode: s.isMapEditMode,
      activeCustomLayerId: s.activeCustomLayerId,
    })),
  );
  // Actions are stable; the menu reads the state it shows from `data`.
  const store = useAppStore.getState();
  const state = { ...store, ...data };

  if (menu.id === null) {
    return (
      <ContextMenu x={menu.x} y={menu.y} onClose={onClose}>
        <ContextMenuItem
          icon={<FolderPlus size={13} className="text-accent-anchor" />}
          onSelect={() => state.addLayerGroup()}
        >
          新しいグループ
        </ContextMenuItem>
      </ContextMenu>
    );
  }

  const id = menu.id;
  const selected = state.selection.type === 'layers' ? state.selection.ids : [];
  const ids = selected.includes(id) ? selected : [id];
  const isMulti = ids.length > 1;
  const count = isMulti ? ` (${ids.length})` : '';

  const group = state.layerGroups[id];
  const map = state.mapLayers.find((l) => l.id === id);
  const custom = state.customLayers.find((l) => l.id === id);
  const parentId = parentOf(state, id) ?? null;
  const allVisible = ids.every(
    (i) =>
      state.layerGroups[i]?.visible ??
      state.mapLayers.find((l) => l.id === i)?.visible ??
      state.customLayers.find((l) => l.id === i)?.visible ??
      true,
  );
  const canDuplicate = ids.some(
    (i) => state.mapLayers.some((l) => l.id === i) || state.customLayers.some((l) => l.id === i && l.type === 'manual'),
  );
  const hasGroups = ids.some((i) => state.layerGroups[i]);
  const sharedCount = map ? state.mapLayers.filter((l) => l.sourceId === map.sourceId).length : 0;

  return (
    <ContextMenu x={menu.x} y={menu.y} onClose={onClose}>
      {/* Main action */}
      {!isMulti && map && (
        <ContextMenuItem
          icon={<Crop size={13} className="text-primary-base" />}
          onSelect={() => state.setActiveMapLayerId(map.id)}
        >
          編集対象マップに設定
        </ContextMenuItem>
      )}
      {!isMulti && custom?.type === 'manual' && (
        <ContextMenuItem
          icon={<Pencil size={13} className="text-primary-base" />}
          onSelect={() => onToggleVectorEdit(custom.id)}
        >
          {state.isMapEditMode && state.activeCustomLayerId === custom.id ? 'ベクター編集を終了' : 'ベクター編集を開始'}
        </ContextMenuItem>
      )}
      {!isMulti && custom?.type === 'plugin' && (
        <>
          <ContextMenuItem
            icon={<Settings2 size={13} className="text-text-muted" />}
            onSelect={() => state.setSelection({ type: 'layers', ids: [custom.id], selectedObjectId: null })}
          >
            パラメータ編集 / 再生成
          </ContextMenuItem>
          <ContextMenuItem
            icon={<Code2 size={13} className="text-accent-automation" />}
            onSelect={() =>
              state.openPluginDataModal(
                `カスタムレイヤー: ${custom.name}`,
                custom.plugin_data,
                `プラグイン: ${custom.plugin_id || 'Unknown'} • 内部メタデータ (Read-only)`,
              )
            }
          >
            内部プロパティを表示
          </ContextMenuItem>
        </>
      )}

      {/* Rename, duplicate */}
      {!isMulti && (
        <ContextMenuItem icon={<Pencil size={13} className="text-text-muted" />} onSelect={() => onRename(id)}>
          名前を変更 (F2)
        </ContextMenuItem>
      )}
      {canDuplicate && (
        <ContextMenuItem
          icon={<Copy size={13} className="text-text-muted" />}
          onSelect={() => state.duplicateLayerItems(ids)}
        >
          {map && !isMulti ? '複製（別の領域を使う）' : `複製${count}`}
        </ContextMenuItem>
      )}
      {!isMulti && map && (sharedCount > 1 || map.origin_override) && (
        <ContextMenuItem
          icon={
            map.origin_override ? (
              <Link2 size={13} className="text-text-muted" />
            ) : (
              <Unlink2 size={13} className="text-text-muted" />
            )
          }
          onSelect={() => state.setMapLayerPoseLinked(map.id, !!map.origin_override)}
        >
          {map.origin_override ? '位置を再共有' : '位置の共有を解除'}
        </ContextMenuItem>
      )}
      {!isMulti && custom && (
        <ContextMenuItem
          icon={
            <Bookmark
              size={13}
              className={custom.is_reference ? 'fill-accent-reference text-accent-reference' : 'text-text-muted'}
            />
          }
          onSelect={() => state.updateCustomLayer(custom.id, { is_reference: !custom.is_reference })}
        >
          {custom.is_reference ? '参照レイヤー解除' : '参照レイヤーに設定'}
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />

      {/* Grouping */}
      <ContextMenuItem
        emphasis="strong"
        icon={<FolderPlus size={13} className="text-accent-anchor" />}
        onSelect={() => groupLayerItems(ids)}
      >
        {`グループ化${count} (Ctrl+G)`}
      </ContextMenuItem>
      {hasGroups && (
        <ContextMenuItem
          icon={<Unlink size={13} className="text-accent-anchor" />}
          onSelect={() => ungroupLayerItems(ids)}
        >
          グループ解除 (Ctrl+Shift+G)
        </ContextMenuItem>
      )}
      {!isMulti && parentId && (
        <ContextMenuItem
          icon={<FolderOutput size={13} className="text-text-muted" />}
          onSelect={() => state.moveLayerItems([id], parentId, 'before')}
        >
          グループから出す
        </ContextMenuItem>
      )}

      {/* Visibility */}
      <ContextMenuItem
        icon={
          allVisible ? <EyeOff size={13} className="text-text-muted" /> : <Eye size={13} className="text-text-base" />
        }
        onSelect={() => state.setLayerItemsVisible(ids, !allVisible)}
      >
        {allVisible ? `非表示にする${count}` : `表示する${count}`}
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem tone="danger" icon={<Trash2 size={13} />} onSelect={() => void confirmRemoveLayerItems(ids)}>
        {group && !isMulti ? 'グループごと削除 (Delete)' : `削除${count} (Delete)`}
      </ContextMenuItem>
    </ContextMenu>
  );
}
