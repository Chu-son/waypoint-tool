import { Eye, EyeOff, Trash2, FolderOpen } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { open } from "@tauri-apps/plugin-dialog";
import { BackendAPI } from "../../api/backend";

export function LayerPanel() {
  const mapLayers = useAppStore((state) => state.mapLayers);
  const updateMapLayer = useAppStore((state) => state.updateMapLayer);
  const removeMapLayer = useAppStore((state) => state.removeMapLayer);
  const reorderMapLayers = useAppStore((state) => state.reorderMapLayers);
  const addMapLayer = useAppStore((state) => state.addMapLayer);
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const setLastDirectory = useAppStore((state) => state.setLastDirectory);

  const handleLoadMap = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [{ name: "ROS Map YAML", extensions: ["yaml"] }],
      });
      if (selectedPath) {
        const pathStr =
          typeof selectedPath === "string"
            ? selectedPath
            : (selectedPath as any).path;
        if (!pathStr) return;
        const lastSlash = Math.max(
          pathStr.lastIndexOf("/"),
          pathStr.lastIndexOf("\\"),
        );
        const dir = lastSlash > -1 ? pathStr.substring(0, lastSlash) : pathStr;
        setLastDirectory(dir);

        const result = await BackendAPI.loadROSMap(pathStr);
        const filename = pathStr.split(/[/\\]/).pop() || "Map";
        addMapLayer(
          filename,
          result.info,
          result.image_data_b64,
          result.width,
          result.height,
        );
      }
    } catch (err) {
      console.error("Failed to load map:", err);
      alert(`マップの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  // Very simple drag and drop logic is needed here ideally, but for now we'll just have up/down buttons
  const moveUp = (index: number) => {
    if (index > 0) reorderMapLayers(index, index - 1);
  };
  const moveDown = (index: number) => {
    if (index < mapLayers.length - 1) reorderMapLayers(index, index + 1);
  };

  return (
    <div className="flex-1 overflow-y-auto w-full flex flex-col">
      <div className="p-3 shrink-0 border-b border-slate-700/50">
        <button
          onClick={handleLoadMap}
          className="ui-btn ui-btn-secondary ui-btn-md w-full"
        >
          <FolderOpen size={16} className="text-emerald-400" />
          Load ROS Map (YAML)
        </button>
      </div>

      {mapLayers.length === 0 ? (
        <div className="p-6 flex flex-col items-center justify-center text-slate-500 flex-1">
          <p className="text-sm text-center">No maps loaded.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto w-full p-2 space-y-2">
          {mapLayers.map((layer, index) => (
            <div
              key={layer.id}
              className="bg-slate-900 border border-slate-700 rounded-lg p-3 group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col text-slate-500">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="hover:text-white disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === mapLayers.length - 1}
                      className="hover:text-white disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <span
                    className="text-sm font-medium text-slate-200 truncate w-32"
                    title={layer.name}
                  >
                    {layer.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateMapLayer(layer.id, { visible: !layer.visible })
                    }
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
                  onChange={(e) =>
                    updateMapLayer(layer.id, {
                      opacity: parseFloat(e.target.value),
                    })
                  }
                  className="ui-range"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
