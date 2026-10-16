import { useMemo } from 'react';
import { BoxSelect, Folder, Unlink } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { Button } from '../common/Button';
import { descendantLayerIds, idsHiddenByGroups } from '../../../utils/layerTree';
import { confirmRemoveLayerItems, ungroupLayerItems } from '../../../services/layerCommands';
import { LayerGroupPoseSection } from './LayerGroupPoseSection';
import { LayerInspectorHeader } from './LayerInspectorHeader';

/** Inspector of one layer group: name, visibility, what it holds. */
export function LayerGroupInspector({ id }: { id: string }) {
  const rootLayerIds = useAppStore((state) => state.rootLayerIds);
  const layerGroups = useAppStore((state) => state.layerGroups);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const renameLayerGroup = useAppStore((state) => state.renameLayerGroup);
  const setLayerGroupVisible = useAppStore((state) => state.setLayerGroupVisible);
  const setSelection = useAppStore((state) => state.setSelection);

  const tree = useMemo(() => ({ rootLayerIds, layerGroups }), [rootLayerIds, layerGroups]);
  const group = layerGroups[id];
  const contents = useMemo(() => (group ? descendantLayerIds(tree, id) : []), [tree, id, group]);
  const hiddenByAncestor = useMemo(() => idsHiddenByGroups(tree).has(id), [tree, id]);
  if (!group) return null;

  const mapCount = contents.filter((c) => mapLayers.some((l) => l.id === c)).length;
  const subgroupCount = group.children_ids.filter((c) => layerGroups[c]).length;

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 space-y-4">
      <LayerInspectorHeader
        icon={<Folder size={16} className="text-accent-anchor" />}
        kind="Layer Group"
        name={group.name}
        onRename={(name) => renameLayerGroup(id, name)}
        visible={group.visible}
        hiddenByAncestor={hiddenByAncestor}
        onToggleVisible={() => setLayerGroupVisible(id, !group.visible)}
        onRemove={() => void confirmRemoveLayerItems([id])}
      />

      <div className="space-y-2">
        <p className="text-[11px] text-text-muted">
          {`レイヤー ${contents.length} 枚（マップ ${mapCount}・カスタム ${contents.length - mapCount}）`}
          {subgroupCount > 0 && ` / サブグループ ${subgroupCount}`}
        </p>
        <p className="text-[10px] text-text-muted/80">
          グループを非表示にすると、中のレイヤーは描画・プレビュー・エクスポートから外れます。各レイヤーの表示設定は保たれます。
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={contents.length === 0}
            onClick={() => setSelection({ type: 'layers', ids: contents, selectedObjectId: null })}
          >
            <BoxSelect size={12} />
            中のレイヤーを選択
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() => ungroupLayerItems([id])}
          >
            <Unlink size={12} />
            グループ解除
          </Button>
        </div>
      </div>

      <LayerGroupPoseSection groupId={id} />
    </div>
  );
}
