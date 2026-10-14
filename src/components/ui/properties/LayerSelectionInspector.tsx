import { useAppStore } from '../../../stores/appStore';
import { layerItemKind } from '../../../utils/layerSelection';
import { CustomLayerInspector } from './CustomLayerInspector';
import { LayerGroupInspector } from './LayerGroupInspector';
import { LayerMultiInspector } from './LayerMultiInspector';
import { MapLayerInspector } from './MapLayerInspector';

/** Inspector for a selection in the layer tree: picks the panel for what is selected. */
export function LayerSelectionInspector({ ids }: { ids: string[] }) {
  const kind = useAppStore((state) => (ids.length === 1 ? layerItemKind(ids[0], state) : 'multi'));
  if (kind === 'multi') return <LayerMultiInspector ids={ids} />;
  if (kind === 'group') return <LayerGroupInspector id={ids[0]} />;
  if (kind === 'map') return <MapLayerInspector id={ids[0]} />;
  return <CustomLayerInspector />;
}
