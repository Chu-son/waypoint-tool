import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export function LayerPanel() {
  const mapLayers = useAppStore(state => state.mapLayers);
  const updateMapLayer = useAppStore(state => state.updateMapLayer);
  const removeMapLayer = useAppStore(state => state.removeMapLayer);
  const reorderMapLayers = useAppStore(state => state.reorderMapLayers);

  if (mapLayers.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col items-center justify-center text-slate-500">
        <p className="text-sm text-center">No maps loaded.</p>
        <p className="text-xs text-center mt-2">Use the Folder icon on the left to load a ROS Map YAML.</p>
      </div>
    );
  }

  // Very simple drag and drop logic is needed here ideally, but for now we'll just have up/down buttons
  const moveUp = (index: number) => {
    if (index > 0) reorderMapLayers(index, index - 1);
  };
  const moveDown = (index: number) => {
    if (index < mapLayers.length - 1) reorderMapLayers(index, index + 1);
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-2 space-y-2">
      {mapLayers.map((layer, index) => (
        <div key={layer.id} className="bg-slate-900 border border-slate-700 rounded-lg p-3 group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col text-slate-500">
                <button onClick={() => moveUp(index)} disabled={index === 0} className="hover:text-white disabled:opacity-30">▲</button>
                <button onClick={() => moveDown(index)} disabled={index === mapLayers.length - 1} className="hover:text-white disabled:opacity-30">▼</button>
              </div>
              <span className="text-sm font-medium text-slate-200 truncate w-32" title={layer.name}>{layer.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateMapLayer(layer.id, { visible: !layer.visible })}
                className="text-slate-400 hover:text-white"
                title="Toggle Visibility"
              >
                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove map layer '${layer.name}'?`)) {
                    removeMapLayer(layer.id);
                  }
                }}
                className="text-slate-400 hover:text-red-400"
                title="Remove Map"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Opacity</span>
              <span>{Math.round(layer.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={layer.opacity}
              onChange={(e) => updateMapLayer(layer.id, { opacity: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
