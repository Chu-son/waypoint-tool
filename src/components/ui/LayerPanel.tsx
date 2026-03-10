import { Eye, EyeOff, Trash2, FolderOpen, Layers, ChevronUp, ChevronDown } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { DialogAPI } from "../../api";
import { BackendAPI } from "../../api";
import { Button } from "./common/Button";
import { Slider } from "./common/Slider";

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
      const selectedPath = await DialogAPI.open({
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

  const moveUp = (index: number) => {
    if (index > 0) reorderMapLayers(index, index - 1);
  };
  const moveDown = (index: number) => {
    if (index < mapLayers.length - 1) reorderMapLayers(index, index + 1);
  };

  return (
    <div className="flex-1 overflow-hidden w-full flex flex-col bg-surface-base/20">
      <div className="p-4 shrink-0 border-b border-border-base/30 bg-surface-panel/30 backdrop-blur-md">
        <Button
          onClick={handleLoadMap}
          variant="secondary"
          className="w-full h-10 shadow-sm border-border-base/50 group hover:border-emerald-500/30 transition-all font-bold"
        >
          <FolderOpen size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          Load Map
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto w-full p-4 space-y-4">
        {mapLayers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted/40 animate-in fade-in zoom-in-95 duration-700">
            <Layers size={48} className="mb-4 stroke-[1px] opacity-20" />
            <p className="text-sm font-medium tracking-tight">No maps loaded.</p>
            <p className="text-[10px] uppercase tracking-widest mt-1 opacity-50">Upload YAML to start</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
              Loaded Layers
              <div className="h-px flex-1 bg-border-base/20" />
            </h3>
            {mapLayers.map((layer, index) => (
              <div
                key={layer.id}
                className="bg-surface-panel/40 backdrop-blur-sm border border-border-base/30 rounded-2xl p-4 shadow-subtle hover:border-border-base/60 transition-all group overflow-hidden relative"
              >
                {!layer.visible && (
                  <div className="absolute inset-0 bg-surface-base/40 z-1 pointer-events-none backdrop-grayscale-[0.5]" />
                )}
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        title="Move Up"
                      >
                        <ChevronUp size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
                        onClick={() => moveDown(index)}
                        disabled={index === mapLayers.length - 1}
                        title="Move Down"
                      >
                        <ChevronDown size={14} />
                      </Button>
                    </div>
                    <div>
                      <span
                        className="text-sm font-bold text-text-base truncate block max-w-[120px]"
                        title={layer.name}
                      >
                        {layer.name}
                      </span>
                      <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                        Layer {index + 1}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
                      onClick={() =>
                        updateMapLayer(layer.id, { visible: !layer.visible })
                      }
                      title="Toggle Visibility"
                    >
                      {layer.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
                      onClick={() => {
                        if (confirm(`Remove map layer '${layer.name}'?`)) {
                          removeMapLayer(layer.id);
                        }
                      }}
                      title="Remove Map"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>

                <div className="relative z-10 px-1">
                  <Slider
                    label="Layer Opacity"
                    valueDisplay={`${Math.round(layer.opacity * 100)}%`}
                    min="0"
                    max="1"
                    step="0.05"
                    value={layer.opacity}
                    onChange={(e) =>
                      updateMapLayer(layer.id, {
                        opacity: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
