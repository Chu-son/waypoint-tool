import { Eye, EyeOff, Trash2, FolderOpen, Layers, ChevronUp, ChevronDown, Crop } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { DialogAPI } from "../../api";
import { BackendAPI } from "../../api";
import { Button } from "./common/Button";
import { Slider } from "./common/Slider";
import { Select } from "./common/Select";
import { Input } from "./common/Input";

export function LayerPanel() {
  const mapLayers = useAppStore((state) => state.mapLayers);
  const updateMapLayer = useAppStore((state) => state.updateMapLayer);
  const removeMapLayer = useAppStore((state) => state.removeMapLayer);
  const reorderMapLayers = useAppStore((state) => state.reorderMapLayers);
  const addMapLayer = useAppStore((state) => state.addMapLayer);
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const setLastDirectory = useAppStore((state) => state.setLastDirectory);
  const exportRegions = useAppStore((state) => state.exportRegions);
  const updateExportRegion = useAppStore((state) => state.updateExportRegion);
  const removeExportRegion = useAppStore((state) => state.removeExportRegion);

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
                      onClick={async () => {
                        const confirmed = await DialogAPI.ask(
                          `Remove map layer '${layer.name}'?`,
                          { title: "Remove Map", kind: "warning" }
                        );
                        if (confirmed) {
                          removeMapLayer(layer.id);
                        }
                      }}
                      title="Remove Map"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>

                <div className="relative z-10 px-1 flex flex-col gap-3">
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
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 block">Blend Mode</span>
                    <Select
                      value={layer.blend_mode || 'overwrite'}
                      onChange={(e) => updateMapLayer(layer.id, { blend_mode: e.target.value as any })}
                      className="text-sm border-border-base/50"
                    >
                      <option value="overwrite">Overwrite (Ignore Unknown)</option>
                      <option value="merge_obstacles">Merge Obstacles</option>
                      <option value="merge_free">Merge Free Space</option>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Export Regions Section */}
        {(exportRegions || []).length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border-base/20">
            <div className="flex items-center justify-between ml-1 mb-2">
              <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] flex items-center gap-2 flex-1">
                Export Regions
                <div className="h-px flex-1 bg-border-base/20" />
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-2 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
                onClick={() => {
                  const allVisible = exportRegions.every(r => r.visible);
                  exportRegions.forEach(r => updateExportRegion(r.id, { visible: !allVisible }));
                }}
                title={exportRegions.every(r => r.visible) ? "Hide All Regions" : "Show All Regions"}
              >
                {exportRegions.every(r => r.visible) ? <Eye size={14} /> : <EyeOff size={14} />}
              </Button>
            </div>
            {exportRegions.map((region, index) => (
              <div
                key={region.id}
                className="bg-surface-panel/40 backdrop-blur-sm border border-border-base/30 rounded-2xl p-4 shadow-subtle hover:border-border-base/60 transition-all group overflow-hidden relative"
              >
                {!region.visible && (
                  <div className="absolute inset-0 bg-surface-base/40 z-1 pointer-events-none backdrop-grayscale-[0.5]" />
                )}
                
                <div className="flex items-center justify-between mb-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <Crop size={16} className="text-emerald-400" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                      Region {index + 1}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
                      onClick={() =>
                        updateExportRegion(region.id, { visible: !region.visible })
                      }
                      title="Toggle Visibility"
                    >
                      {region.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
                      onClick={() => removeExportRegion(region.id)}
                      title="Remove Region"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                <div className="relative z-10 px-1">
                  <Input
                    value={region.name}
                    onChange={(e) => updateExportRegion(region.id, { name: e.target.value })}
                    placeholder="Region Name"
                    className="h-8 text-sm bg-surface-base border-border-base/50 focus:border-emerald-500/50"
                  />
                  <div className="mt-2 flex gap-2">
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-[10px] text-text-muted">X</span>
                      <Input type="number" step="0.1" value={Math.round(region.rect.x * 100) / 100} onChange={(e) => updateExportRegion(region.id, { rect: { ...region.rect, x: parseFloat(e.target.value) || 0 }})} className="h-6 text-xs p-1 bg-surface-base" />
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-[10px] text-text-muted">Y</span>
                      <Input type="number" step="0.1" value={Math.round(region.rect.y * 100) / 100} onChange={(e) => updateExportRegion(region.id, { rect: { ...region.rect, y: parseFloat(e.target.value) || 0 }})} className="h-6 text-xs p-1 bg-surface-base" />
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-[10px] text-text-muted">W</span>
                      <Input type="number" step="0.1" min="0" value={Math.round(region.rect.width * 100) / 100} onChange={(e) => updateExportRegion(region.id, { rect: { ...region.rect, width: parseFloat(e.target.value) || 0 }})} className="h-6 text-xs p-1 bg-surface-base" />
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-[10px] text-text-muted">H</span>
                      <Input type="number" step="0.1" min="0" value={Math.round(region.rect.height * 100) / 100} onChange={(e) => updateExportRegion(region.id, { rect: { ...region.rect, height: parseFloat(e.target.value) || 0 }})} className="h-6 text-xs p-1 bg-surface-base" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
