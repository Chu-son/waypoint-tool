import { useAppStore } from '../../../stores/appStore';
import { selectedCustomLayerId } from '../../../utils/layerSelection';
import { CustomLayerInspector } from './CustomLayerInspector';
import { PropertiesPanel } from './PropertiesPanel';

/** Inspector for a selection in the layer tree: picks the panel for what is selected. */
export function LayerSelectionInspector({ ids }: { ids: string[] }) {
  const customLayerId = useAppStore((state) => selectedCustomLayerId(ids, state));
  if (customLayerId) return <CustomLayerInspector />;
  return <PropertiesPanel />;
}
