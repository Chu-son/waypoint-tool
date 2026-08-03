import { Eye, EyeOff, Trash2, FolderOpen, ChevronUp, ChevronDown, Crop, ScanEye, Pencil } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { DialogAPI } from "../../api";
import { BackendAPI } from "../../api";
import { Button } from "./common/Button";
import { Slider } from "./common/Slider";
import { Select } from "./common/Select";
import { Input } from "./common/Input";
import { FieldLabel } from "./common/FieldLabel";
import { EmptyState } from "./common/EmptyState";
import { ProjectMapLayer, EditLayer, ExportRegion } from "../../types/store";
import { cn } from "../../utils/cn";

function CardFrame({
  visible = true,
  children,
  className,
  isActive = false,
  onClick,
}: {
  visible?: boolean;
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-surface-panel/40 backdrop-blur-sm border rounded-2xl p-4 shadow-subtle hover:border-border-base/60 transition-all group overflow-hidden relative",
        isActive ? "border-primary-base/80 bg-primary-base/5" : "border-border-base/30",
        className
      )}
    >
      {!visible && (
        <div className="absolute inset-0 bg-surface-base/40 z-1 pointer-events-none backdrop-grayscale-[0.5]" />
      )}
      {children}
    </div>
  );
}

export function LayerPanel() {
  const mapLayers = useAppStore((state) => state.mapLayers);
  const updateMapLayer = useAppStore((state) => state.updateMapLayer);
  const removeMapLayer = useAppStore((state) => state.removeMapLayer);
  const reorderMapLayers = useAppStore((state) => state.reorderMapLayers);
  const addMapLayer = useAppStore((state) => state.addMapLayer);

  const editLayers = useAppStore((state) => state.editLayers) || [];
  const addEditLayer = useAppStore((state) => state.addEditLayer);
  const removeEditLayer = useAppStore((state) => state.removeEditLayer);
  const updateEditLayer = useAppStore((state) => state.updateEditLayer);
  const reorderEditLayers = useAppStore((state) => state.reorderEditLayers);

  const isMapEditMode = useAppStore((state) => state.isMapEditMode);
  const setMapEditMode = useAppStore((state) => state.setMapEditMode);
  const activeEditLayerId = useAppStore((state) => state.activeEditLayerId);
  const setActiveEditLayerId = useAppStore((state) => state.setActiveEditLayerId);
  const activeMapLayerId = useAppStore((state) => state.activeMapLayerId);
  const setActiveMapLayerId = useAppStore((state) => state.setActiveMapLayerId);

  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const setLastDirectory = useAppStore((state) => state.setLastDirectory);
  const exportRegions = useAppStore((state) => state.exportRegions);
  const updateExportRegion = useAppStore((state) => state.updateExportRegion);
  const removeExportRegion = useAppStore((state) => state.removeExportRegion);
  const isExportPreview = useAppStore((state) => state.isExportPreview);
  const setIsExportPreview = useAppStore((state) => state.setIsExportPreview);

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

  const moveUpMap = (index: number) => {
    if (index > 0) reorderMapLayers(index, index - 1);
  };
  const moveDownMap = (index: number) => {
    if (index < mapLayers.length - 1) reorderMapLayers(index, index + 1);
  };

  const moveUpEdit = (index: number) => {
    if (index > 0) reorderEditLayers(index, index - 1);
  };
  const moveDownEdit = (index: number) => {
    if (index < editLayers.length - 1) reorderEditLayers(index, index + 1);
  };

  return (
    <div className="flex-1 overflow-hidden w-full flex flex-col bg-surface-base/20">
      <div className="p-4 shrink-0 border-b border-border-base/30 bg-surface-panel/30 backdrop-blur-md flex flex-col gap-2">
        <Button
          onClick={handleLoadMap}
          variant="secondary"
          className="w-full h-9 shadow-sm border-border-base/50 group hover:border-emerald-500/30 transition-all font-bold"
        >
          <FolderOpen size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          Load Map
        </Button>
        <Button
          onClick={() => {
            const count = editLayers.length + 1;
            const newLayer = addEditLayer(`Edit Layer ${count}`);
            if (newLayer?.id) {
              setActiveEditLayerId(newLayer.id);
              setMapEditMode(true);
            }
          }}
          variant="secondary"
          className="w-full h-9 shadow-sm border-border-base/50 group hover:border-primary-base/30 transition-all font-bold"
          title="Add Edit Layer and Start Editing"
        >
          <Pencil size={16} className="text-primary-base group-hover:scale-110 transition-transform" />
          <span>Add Edit Layer</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto w-full p-4 space-y-4">
        {/* Edit Layers Section */}
        {editLayers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 ml-1">
              <FieldLabel className="flex items-center gap-2 flex-1">
                Edit Layers
                <div className="h-px flex-1 bg-border-base/20" />
              </FieldLabel>
            </div>
            {editLayers.map((layer, index) => {
              const isActiveEdit = activeEditLayerId === layer.id;
              const isEditing = isMapEditMode && isActiveEdit;
              return (
                <EditLayerCard
                  key={layer.id}
                  layer={layer}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === editLayers.length - 1}
                  isActive={isActiveEdit}
                  isEditing={isEditing}
                  onSelect={() => setActiveEditLayerId(layer.id)}
                  onToggleEdit={() => {
                    if (isEditing) {
                      setMapEditMode(false);
                    } else {
                      setActiveEditLayerId(layer.id);
                      setMapEditMode(true);
                    }
                  }}
                  onMoveUp={() => moveUpEdit(index)}
                  onMoveDown={() => moveDownEdit(index)}
                  onToggleVisible={() => updateEditLayer(layer.id, { visible: !layer.visible })}
                  onRemove={async () => {
                    const confirmed = await DialogAPI.ask(
                      `Remove edit layer '${layer.name}'?`,
                      { title: "Remove Edit Layer", kind: "warning" }
                    );
                    if (confirmed) {
                      removeEditLayer(layer.id);
                      if (activeEditLayerId === layer.id) {
                        setActiveEditLayerId(null);
                      }
                    }
                  }}
                  onUpdateLayer={(updates) => updateEditLayer(layer.id, updates)}
                />
              );
            })}
          </div>
        )}

        {/* Loaded Map Layers Section */}
        {mapLayers.length === 0 ? (
          <EmptyState message="No maps loaded. Upload YAML to start." />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 ml-1">
              <FieldLabel className="flex items-center gap-2 flex-1">
                Loaded Maps
                <div className="h-px flex-1 bg-border-base/20" />
              </FieldLabel>
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 transition-all ${
                  isExportPreview
                    ? 'text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20'
                    : 'text-text-muted hover:text-text-base hover:bg-surface-hover/50'
                }`}
                onClick={() => setIsExportPreview(!isExportPreview)}
                title={isExportPreview ? "Export Preview: ON (クリックで解除)" : "Export Preview: OFF (クリックで有効化)"}
              >
                <ScanEye size={14} />
              </Button>
            </div>
            {mapLayers.map((layer, index) => {
              const isActiveTargetMap = activeMapLayerId === layer.id;
              return (
                <LayerCard
                  key={layer.id}
                  layer={layer}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === mapLayers.length - 1}
                  isActiveTargetMap={isActiveTargetMap}
                  isMapEditMode={isMapEditMode}
                  onSelect={() => {
                    if (isMapEditMode) setActiveMapLayerId(layer.id);
                  }}
                  onMoveUp={() => moveUpMap(index)}
                  onMoveDown={() => moveDownMap(index)}
                  onToggleVisible={() => updateMapLayer(layer.id, { visible: !layer.visible })}
                  onRemove={async () => {
                    const confirmed = await DialogAPI.ask(
                      `Remove map layer '${layer.name}'?`,
                      { title: "Remove Map", kind: "warning" }
                    );
                    if (confirmed) {
                      removeMapLayer(layer.id);
                      if (activeMapLayerId === layer.id) {
                        setActiveMapLayerId(null);
                      }
                    }
                  }}
                  onUpdateLayer={(updates) => updateMapLayer(layer.id, updates)}
                />
              );
            })}
          </div>
        )}

        {/* Export Regions Section */}
        {(exportRegions || []).length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border-base/20">
            <div className="flex items-center justify-between ml-1 mb-2">
              <FieldLabel className="flex items-center gap-2 flex-1">
                Export Regions
                <div className="h-px flex-1 bg-border-base/20" />
              </FieldLabel>
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
              <RegionCard
                key={region.id}
                region={region}
                index={index}
                onToggleVisible={() => updateExportRegion(region.id, { visible: !region.visible })}
                onRemove={() => removeExportRegion(region.id)}
                onUpdateRegion={(updates) => updateExportRegion(region.id, updates)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Local Helper Components ---

interface LayerCardProps {
  layer: ProjectMapLayer;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isActiveTargetMap: boolean;
  isMapEditMode: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
  onUpdateLayer: (updates: Partial<ProjectMapLayer>) => void;
}

function LayerCard({
  layer,
  index,
  isFirst,
  isLast,
  isActiveTargetMap,
  isMapEditMode,
  onSelect,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onRemove,
  onUpdateLayer,
}: LayerCardProps) {
  return (
    <CardFrame visible={layer.visible} isActive={isActiveTargetMap} onClick={onSelect}>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
              onClick={onMoveUp}
              disabled={isFirst}
              title="Move Up"
            >
              <ChevronUp size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
              onClick={onMoveDown}
              disabled={isLast}
              title="Move Down"
            >
              <ChevronDown size={14} />
            </Button>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-sm font-bold text-text-base truncate block max-w-[120px]"
                title={layer.name}
              >
                {layer.name}
              </span>
              {isMapEditMode && isActiveTargetMap && (
                <span className="text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded">
                  🎯 Target Map
                </span>
              )}
            </div>
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
            onClick={onToggleVisible}
            title="Toggle Visibility"
          >
            {layer.visible ? <Eye size={18} /> : <EyeOff size={18} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
            onClick={onRemove}
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
          onChange={(e) => onUpdateLayer({ opacity: parseFloat(e.target.value) })}
        />
        <div className="flex flex-col gap-1.5 mt-1">
          <FieldLabel>Blend Mode</FieldLabel>
          <Select
            value={layer.blend_mode || 'overwrite'}
            onChange={(e) => onUpdateLayer({ blend_mode: e.target.value as any })}
            className="text-sm border-border-base/50"
          >
            <option value="overwrite">Overwrite (Ignore Unknown)</option>
            <option value="merge_obstacles">Merge Obstacles</option>
            <option value="merge_free">Merge Free Space</option>
          </Select>
        </div>
      </div>
    </CardFrame>
  );
}

interface EditLayerCardProps {
  layer: EditLayer;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onToggleEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
  onUpdateLayer: (updates: Partial<Omit<EditLayer, 'editObjects'>>) => void;
}

function EditLayerCard({
  layer,
  index,
  isFirst,
  isLast,
  isActive,
  isEditing,
  onSelect,
  onToggleEdit,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onRemove,
  onUpdateLayer,
}: EditLayerCardProps) {

  return (
    <CardFrame visible={layer.visible} isActive={isActive || isEditing} onClick={onSelect}>
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
              onClick={onMoveUp}
              disabled={isFirst}
              title="Move Up"
            >
              <ChevronUp size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
              onClick={onMoveDown}
              disabled={isLast}
              title="Move Down"
            >
              <ChevronDown size={14} />
            </Button>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Pencil size={14} className="text-primary-base" />
              <Input
                value={layer.name}
                onChange={(e) => onUpdateLayer({ name: e.target.value })}
                className="h-6 text-sm font-bold bg-transparent border-none p-0 focus:ring-0 focus:bg-surface-base/50"
              />
            </div>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
              Edit Layer {index + 1} • {layer.editObjects.length} objects
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant={isEditing ? "primary" : "ghost"}
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
            onClick={(e) => {
              e.stopPropagation();
              onToggleEdit();
            }}
            title={isEditing ? "編集モードを終了" : "このレイヤーの編集モードを開始"}
          >
            <Pencil size={15} className={isEditing ? "text-primary-base" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
            onClick={onToggleVisible}
            title="Toggle Visibility"
          >
            {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
            onClick={onRemove}
            title="Remove Edit Layer"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="relative z-10 px-1">
        <Slider
          label="Opacity"
          valueDisplay={`${Math.round(layer.opacity * 100)}%`}
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity}
          onChange={(e) => onUpdateLayer({ opacity: parseFloat(e.target.value) })}
        />
      </div>
    </CardFrame>
  );
}

interface RegionCardProps {
  region: ExportRegion;
  index: number;
  onToggleVisible: () => void;
  onRemove: () => void;
  onUpdateRegion: (updates: Partial<ExportRegion>) => void;
}

function RegionCard({
  region,
  index,
  onToggleVisible,
  onRemove,
  onUpdateRegion,
}: RegionCardProps) {
  return (
    <CardFrame visible={region.visible}>
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
            onClick={onToggleVisible}
            title="Toggle Visibility"
          >
            {region.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
            onClick={onRemove}
            title="Remove Region"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="relative z-10 px-1">
        <Input
          value={region.name}
          onChange={(e) => onUpdateRegion({ name: e.target.value })}
          placeholder="Region Name"
          className="h-8 text-sm bg-surface-base border-border-base/50 focus:border-emerald-500/50"
        />
        <div className="mt-2 flex gap-2">
          <CoordField
            label="X"
            value={region.rect.x}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, x: val } })}
          />
          <CoordField
            label="Y"
            value={region.rect.y}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, y: val } })}
          />
          <CoordField
            label="W"
            value={region.rect.width}
            min="0"
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, width: val } })}
          />
          <CoordField
            label="H"
            value={region.rect.height}
            min="0"
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, height: val } })}
          />
        </div>
      </div>
    </CardFrame>
  );
}

interface CoordFieldProps {
  label: string;
  value: number;
  min?: string;
  onChange: (val: number) => void;
}

function CoordField({ label, value, min, onChange }: CoordFieldProps) {
  return (
    <div className="flex-1 flex items-center gap-1">
      <span className="text-[10px] text-text-muted font-bold uppercase">{label}</span>
      <Input
        type="number"
        step="0.1"
        min={min}
        value={Math.round(value * 100) / 100}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-6 text-xs p-1 bg-surface-base"
      />
    </div>
  );
}
