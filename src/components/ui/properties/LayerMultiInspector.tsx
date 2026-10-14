import { Eye, EyeOff, FolderPlus, Layers, Trash2 } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { Button } from '../common/Button';
import { confirmRemoveLayerItems, groupLayerItems } from '../../../services/layerCommands';

/** Inspector for several items of the layer tree: what applies to all of them at once. */
export function LayerMultiInspector({ ids }: { ids: string[] }) {
  const layerGroups = useAppStore((state) => state.layerGroups);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const customLayers = useAppStore((state) => state.customLayers);
  const setLayerItemsVisible = useAppStore((state) => state.setLayerItemsVisible);

  const visibleOf = (id: string) =>
    layerGroups[id]?.visible ??
    mapLayers.find((l) => l.id === id)?.visible ??
    customLayers.find((l) => l.id === id)?.visible ??
    true;
  const allVisible = ids.every(visibleOf);
  const groups = ids.filter((id) => layerGroups[id]).length;
  const maps = ids.filter((id) => mapLayers.some((l) => l.id === id)).length;

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 space-y-4">
      <div className="pb-3 border-b border-border-base/50">
        <h2 className="text-sm font-bold text-text-base flex items-center gap-2">
          <Layers size={16} className="text-primary-base" />
          {`${ids.length} 項目を選択中`}
        </h2>
        <p className="text-[11px] text-text-muted mt-1">
          {`マップ ${maps}・カスタム ${ids.length - maps - groups}・グループ ${groups}`}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        <Button variant="secondary" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => groupLayerItems(ids)}>
          <FolderPlus size={12} />
          グループ化 (Ctrl+G)
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-[11px] gap-1.5"
          onClick={() => setLayerItemsVisible(ids, !allVisible)}
        >
          {allVisible ? <EyeOff size={12} /> : <Eye size={12} />}
          {allVisible ? 'すべて非表示' : 'すべて表示'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-[11px] gap-1.5 hover:text-danger-base"
          onClick={() => void confirmRemoveLayerItems(ids)}
        >
          <Trash2 size={12} />
          削除 (Delete)
        </Button>
      </div>
    </div>
  );
}
