import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Trash2, FolderOpen, ChevronUp, ChevronDown, Crop, ScanEye, Pencil, Sparkles, Settings2, Plus, SlidersHorizontal, RotateCcw, RotateCw, FlipHorizontal2, Move, Palette, Bookmark, Code2, Target } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { DialogAPI, BackendAPI } from "../../api";
import { Button } from "./common/Button";
import { Slider } from "./common/Slider";
import { Select } from "./common/Select";
import { Input } from "./common/Input";
import { LabeledNumericInput } from "./common/LabeledNumericInput";
import { FieldLabel } from "./common/FieldLabel";
import { EmptyState } from "./common/EmptyState";
import { ProjectMapLayer, CustomLayer, ExportRegion } from "../../types/store";
import { NewCustomLayerModal } from "./NewCustomLayerModal";
import { cn } from "../../utils/cn";

function CardFrame({
  visible = true,
  children,
  className,
  isActive = false,
  onClick,
  onContextMenu,
}: {
  visible?: boolean;
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "bg-surface-panel/40 backdrop-blur-sm border rounded-lg p-3 shadow-subtle hover:border-border-base/60 transition-all group overflow-hidden relative cursor-pointer",
        isActive ? "border-primary-base/80 bg-primary-base/5 ring-1 ring-primary-base/30" : "border-border-base/30",
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

interface LayerCardShellProps {
  visible: boolean;
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subBadges?: React.ReactNode;
  headerActions?: React.ReactNode;
  showSettings: boolean;
  onToggleSettings: () => void;
  settingsTooltip?: string;
  onToggleVisible: () => void;
  onRemove: () => void;
  removeTooltip?: string;
  children?: React.ReactNode;
}

function LayerCardShell({
  visible,
  isActive = false,
  onClick,
  onContextMenu,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  icon,
  title,
  subBadges,
  headerActions,
  showSettings,
  onToggleSettings,
  settingsTooltip = "Settings",
  onToggleVisible,
  onRemove,
  removeTooltip = "Remove",
  children,
}: LayerCardShellProps) {
  const hasReorder = !!onMoveUp && !!onMoveDown;

  return (
    <CardFrame visible={visible} isActive={isActive} onClick={onClick} onContextMenu={onContextMenu}>
      <div className={cn("flex items-center justify-between relative z-10", showSettings ? "mb-2.5" : "mb-0")}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-1.5">
          {hasReorder && (
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
                onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
                disabled={isFirst}
                title="Move Up"
              >
                <ChevronUp size={13} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-text-muted hover:text-text-base hover:bg-surface-hover/50 disabled:opacity-30 p-0"
                onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
                disabled={isLast}
                title="Move Down"
              >
                <ChevronDown size={13} />
              </Button>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {icon}
              {title}
            </div>
            {subBadges && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {subBadges}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {headerActions}

          <Button
            variant={showSettings ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "h-7 w-7 text-text-muted hover:text-text-base transition-all",
              showSettings && "text-accent-reference bg-accent-reference/10 border border-accent-reference/20"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSettings();
            }}
            title={settingsTooltip}
            aria-expanded={showSettings}
          >
            <SlidersHorizontal size={14} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
            onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
            title="Toggle Visibility"
          >
            {visible ? <Eye size={15} /> : <EyeOff size={15} />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title={removeTooltip}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>

      {showSettings && children && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 mt-2.5 pt-2.5 border-t border-border-base/40 space-y-3 bg-surface-base/40 p-2.5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {children}
        </div>
      )}
    </CardFrame>
  );
}

export function LayerPanel() {
  const mapLayers = useAppStore((state) => state.mapLayers);
  const updateMapLayer = useAppStore((state) => state.updateMapLayer);
  const removeMapLayer = useAppStore((state) => state.removeMapLayer);
  const reorderMapLayers = useAppStore((state) => state.reorderMapLayers);
  const addMapLayer = useAppStore((state) => state.addMapLayer);

  const customLayers = useAppStore((state) => state.customLayers) || [];
  const updateCustomLayer = useAppStore((state) => state.updateCustomLayer);
  const removeCustomLayer = useAppStore((state) => state.removeCustomLayer);
  const reorderCustomLayers = useAppStore((state) => state.reorderCustomLayers);
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const setActiveCustomLayerId = useAppStore((state) => state.setActiveCustomLayerId);

  const isMapEditMode = useAppStore((state) => state.isMapEditMode);
  const setMapEditMode = useAppStore((state) => state.setMapEditMode);
  const activeMapLayerId = useAppStore((state) => state.activeMapLayerId);
  const setActiveMapLayerId = useAppStore((state) => state.setActiveMapLayerId);

  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const setLastDirectory = useAppStore((state) => state.setLastDirectory);
  const exportRegions = useAppStore((state) => state.exportRegions);
  const updateExportRegion = useAppStore((state) => state.updateExportRegion);
  const removeExportRegion = useAppStore((state) => state.removeExportRegion);
  const isExportPreview = useAppStore((state) => state.isExportPreview);
  const setIsExportPreview = useAppStore((state) => state.setIsExportPreview);

  const setRightPanelActiveTab = useAppStore((state) => state.setRightPanelActiveTab);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);
  const selectNodes = useAppStore((state) => state.selectNodes);
  const openPluginDataModal = useAppStore((state) => state.openPluginDataModal);

  const showOccupancyHighlight = useAppStore((state) => state.showOccupancyHighlight);
  const setShowOccupancyHighlight = useAppStore((state) => state.setShowOccupancyHighlight);
  const runWithLoading = useAppStore((state) => state.runWithLoading);

  const [isNewCustomLayerModalOpen, setIsNewCustomLayerModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    type: "custom" | "map";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

        await runWithLoading(
          {
            message: "マップを読み込み中...",
            detail: pathStr.split(/[/\\]/).pop() || pathStr,
            blocking: true,
          },
          async () => {
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

  const moveUpCustom = (index: number) => {
    if (index > 0) reorderCustomLayers(index, index - 1);
  };
  const moveDownCustom = (index: number) => {
    if (index < customLayers.length - 1) reorderCustomLayers(index, index + 1);
  };

  return (
    <div className="flex-1 overflow-hidden w-full flex flex-col bg-surface-base/20">
      {/* Top Action Buttons */}
      <div className="p-4 shrink-0 border-b border-border-base/30 bg-surface-panel/30 backdrop-blur-md flex flex-col gap-2">
        <Button
          onClick={handleLoadMap}
          variant="secondary"
          className="w-full shadow-xs border-border-base/50 font-medium"
        >
          <FolderOpen size={16} className="text-accent-generator" />
          <span>Load Map</span>
        </Button>

        <Button
          onClick={() => setIsNewCustomLayerModalOpen(true)}
          variant="secondary"
          className="w-full shadow-xs border-border-base/50 font-medium"
          title="Create Custom Layer (Manual vector drawing or plugin generator)"
        >
          <Plus size={16} className="text-primary-base" />
          <span>Custom Layer</span>
        </Button>
      </div>

      {/* Layer List Scroll Area */}
      <div className="flex-1 overflow-y-auto w-full p-4 space-y-4">
        {/* Global Composite Preview & Highlight Controls (Above Custom Layers) */}
        {(mapLayers.length > 0 || customLayers.length > 0) && (
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-surface-panel/40 border border-border-base/40 rounded-xl shadow-sm">
            <span className="text-[11px] font-bold text-text-muted flex items-center gap-1.5">
              <span>Preview</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-[11px] font-semibold gap-1.5 transition-all",
                  showOccupancyHighlight
                    ? 'text-accent-reference bg-accent-reference/20 hover:bg-accent-reference/30 border border-accent-reference/40 shadow-sm'
                    : 'text-text-muted hover:text-text-base hover:bg-surface-hover/50'
                )}
                onClick={() => setShowOccupancyHighlight(!showOccupancyHighlight)}
                title={showOccupancyHighlight ? "Occupancy Highlight: ON (3値色分けプレビュー解除)" : "Occupancy Highlight: OFF (3値色分けプレビュー表示)"}
              >
                <Palette size={13} />
                <span>Occupancy</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-[11px] font-semibold gap-1.5 transition-all",
                  isExportPreview
                    ? 'text-accent-generator bg-accent-generator/20 hover:bg-accent-generator/30 border border-accent-generator/40 shadow-sm'
                    : 'text-text-muted hover:text-text-base hover:bg-surface-hover/50'
                )}
                onClick={() => setIsExportPreview(!isExportPreview)}
                title={isExportPreview ? "Merged Map Preview: ON (クリックで解除)" : "Merged Map Preview: OFF (クリックで有効化)"}
              >
                <ScanEye size={13} />
                <span>Merged</span>
              </Button>
            </div>
          </div>
        )}

        {/* Custom Layers Section */}
        {customLayers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 ml-1">
              <FieldLabel className="flex items-center gap-2 flex-1">
                Custom Layers
                <div className="h-px flex-1 bg-border-base/20" />
              </FieldLabel>
            </div>
            {customLayers.map((layer, index) => {
              const isActive = activeCustomLayerId === layer.id;
              const isEditing = isMapEditMode && isActive && layer.type === "manual";
              return (
                <CustomLayerCard
                  key={layer.id}
                  layer={layer}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === customLayers.length - 1}
                  isActive={isActive}
                  isEditing={isEditing}
                  onSelect={() => {
                    selectNodes([]);
                    setActiveCustomLayerId(layer.id);
                    setRightPanelActiveTab("inspector");
                    setRightPanelOpen(true);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectNodes([]);
                    setActiveCustomLayerId(layer.id);
                    setContextMenu({ type: "custom", id: layer.id, x: e.clientX, y: e.clientY });
                  }}
                  onToggleEdit={() => {
                    if (layer.type === "manual") {
                      if (isEditing) {
                        setMapEditMode(false);
                      } else {
                        selectNodes([]);
                        setActiveCustomLayerId(layer.id);
                        setMapEditMode(true);
                        setRightPanelActiveTab("inspector");
                        setRightPanelOpen(true);
                      }
                    }
                  }}
                  onOpenInspector={() => {
                    selectNodes([]);
                    setActiveCustomLayerId(layer.id);
                    setRightPanelActiveTab("inspector");
                    setRightPanelOpen(true);
                  }}
                  onMoveUp={() => moveUpCustom(index)}
                  onMoveDown={() => moveDownCustom(index)}
                  onToggleVisible={() => updateCustomLayer(layer.id, { visible: !layer.visible })}
                  onRemove={async () => {
                    const confirmed = await DialogAPI.ask(
                      `Remove custom layer '${layer.name}'?`,
                      { title: "Remove Custom Layer", kind: "warning" }
                    );
                    if (confirmed) {
                      removeCustomLayer(layer.id);
                      if (activeCustomLayerId === layer.id) {
                        setActiveCustomLayerId(null);
                        setMapEditMode(false);
                      }
                    }
                  }}
                  onUpdateLayer={(updates) => updateCustomLayer(layer.id, updates)}
                />
              );
            })}
          </div>
        )}

        {/* Loaded Map Layers Section */}
        {mapLayers.length === 0 && customLayers.length === 0 ? (
          <EmptyState message="No maps or custom layers. Click above to add." />
        ) : mapLayers.length > 0 ? (
          <div className={cn("space-y-4", customLayers.length > 0 && "pt-4 border-t border-border-base/20")}>
            <div className="flex items-center gap-2 ml-1">
              <FieldLabel className="flex items-center gap-2 flex-1">
                Map Layers
                <div className="h-px flex-1 bg-border-base/20" />
              </FieldLabel>
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ type: "map", id: layer.id, x: e.clientX, y: e.clientY });
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
        ) : null}

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

      {/* New Custom Layer Modal */}
      <NewCustomLayerModal
        isOpen={isNewCustomLayerModalOpen}
        onClose={() => setIsNewCustomLayerModalOpen(false)}
      />

      {/* Layer Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-surface-panel border border-border-base/60 rounded-xl shadow-xl p-1 w-52 text-xs text-text-base flex flex-col gap-0.5 backdrop-blur-md"
        >
          {contextMenu.type === "custom" && (() => {
            const layer = customLayers.find((l) => l.id === contextMenu.id);
            if (!layer) return null;
            const isManual = layer.type === "manual";
            const isEditing = isMapEditMode && activeCustomLayerId === layer.id && isManual;

            return (
              <>
                {/* 内部プロパティ / インスペクター表示 */}
                {!isManual ? (
                  <>
                    <button
                      onClick={() => {
                        openPluginDataModal(
                          `カスタムレイヤー: ${layer.name}`,
                          layer.plugin_data,
                          `プラグイン: ${layer.plugin_id || 'Unknown'} • 内部メタデータ (Read-only)`
                        );
                        setContextMenu(null);
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                    >
                      <Code2 size={13} className="text-accent-automation" />
                      <span>内部プロパティを表示</span>
                    </button>

                    <button
                      onClick={() => {
                        selectNodes([]);
                        setActiveCustomLayerId(layer.id);
                        setRightPanelActiveTab("inspector");
                        setRightPanelOpen(true);
                        setContextMenu(null);
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                    >
                      <Settings2 size={13} className="text-text-muted" />
                      <span>パラメータ編集 / 再生成</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      selectNodes([]);
                      setActiveCustomLayerId(layer.id);
                      setMapEditMode(!isEditing);
                      setRightPanelActiveTab("inspector");
                      setRightPanelOpen(true);
                      setContextMenu(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                  >
                    <Pencil size={13} className="text-primary-base" />
                    <span>{isEditing ? "ベクター編集を終了" : "ベクター編集を開始"}</span>
                  </button>
                )}

                {/* 参照レイヤー切り替え */}
                <button
                  onClick={() => {
                    updateCustomLayer(layer.id, { is_reference: !layer.is_reference });
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Bookmark size={13} className={layer.is_reference ? "fill-accent-reference text-accent-reference" : "text-text-muted"} />
                  <span>{layer.is_reference ? "参照レイヤー解除" : "参照レイヤーに設定"}</span>
                </button>

                {/* 表示 / 非表示 */}
                <button
                  onClick={() => {
                    updateCustomLayer(layer.id, { visible: !layer.visible });
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  {layer.visible ? <EyeOff size={13} className="text-text-muted" /> : <Eye size={13} className="text-text-base" />}
                  <span>{layer.visible ? "非表示にする" : "表示する"}</span>
                </button>

                <div className="h-px bg-border-base/30 my-0.5" />

                {/* 削除 */}
                <button
                  onClick={async () => {
                    setContextMenu(null);
                    const confirmed = await DialogAPI.ask(
                      `Remove custom layer '${layer.name}'?`,
                      { title: "Remove Custom Layer", kind: "warning" }
                    );
                    if (confirmed) {
                      removeCustomLayer(layer.id);
                      if (activeCustomLayerId === layer.id) {
                        setActiveCustomLayerId(null);
                        setMapEditMode(false);
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-danger-base/10 text-danger-base text-left w-full transition-colors"
                >
                  <Trash2 size={13} />
                  <span>削除 (Delete)</span>
                </button>
              </>
            );
          })()}

          {contextMenu.type === "map" && (() => {
            const layer = mapLayers.find((l) => l.id === contextMenu.id);
            if (!layer) return null;

            return (
              <>
                {/* 編集対象マップに設定 */}
                <button
                  onClick={() => {
                    setActiveMapLayerId(layer.id);
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  <Crop size={13} className="text-primary-base" />
                  <span>編集対象マップに設定</span>
                </button>

                {/* 表示 / 非表示 */}
                <button
                  onClick={() => {
                    updateMapLayer(layer.id, { visible: !layer.visible });
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-left w-full transition-colors text-text-base"
                >
                  {layer.visible ? <EyeOff size={13} className="text-text-muted" /> : <Eye size={13} className="text-text-base" />}
                  <span>{layer.visible ? "非表示にする" : "表示する"}</span>
                </button>

                <div className="h-px bg-border-base/30 my-0.5" />

                {/* 削除 */}
                <button
                  onClick={async () => {
                    setContextMenu(null);
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
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-danger-base/10 text-danger-base text-left w-full transition-colors"
                >
                  <Trash2 size={13} />
                  <span>削除 (Delete)</span>
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// --- Local Helper Components ---

interface CustomLayerCardProps {
  layer: CustomLayer;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onToggleEdit: () => void;
  onOpenInspector: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
  onUpdateLayer: (updates: Partial<CustomLayer>) => void;
}

function CustomLayerCard({
  layer,
  index,
  isFirst,
  isLast,
  isActive,
  isEditing,
  onSelect,
  onContextMenu,
  onToggleEdit,
  onOpenInspector,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onRemove,
  onUpdateLayer,
}: CustomLayerCardProps) {
  const isManual = layer.type === "manual";
  const [showSettings, setShowSettings] = useState(false);

  return (
    <LayerCardShell
      visible={layer.visible}
      isActive={isActive || isEditing}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      isFirst={isFirst}
      isLast={isLast}
      icon={
        isManual ? (
          <Pencil size={14} className="text-primary-base shrink-0" />
        ) : (
          <Sparkles size={14} className="text-accent-automation shrink-0" />
        )
      }
      title={
        <Input
          value={layer.name}
          onChange={(e) => onUpdateLayer({ name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="h-6 text-sm font-bold bg-transparent border-none p-0 focus:ring-0 focus:bg-surface-base/50 truncate max-w-[140px]"
        />
      }
      subBadges={
        <>
          <span
            className={cn(
              "text-[9px] font-bold uppercase px-1 py-0.2 rounded",
              isManual ? "bg-primary-base/15 text-primary-base" : "bg-accent-automation/20 text-accent-automation"
            )}
          >
            {isManual ? "Manual" : "Plugin"}
          </span>
          {layer.is_reference && (
            <span
              className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-accent-reference/20 text-accent-reference border border-accent-reference/30"
              title="Reference Layer (Excluded from Merge/Export)"
            >
              REF
            </span>
          )}
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
            Layer {index + 1} {isManual ? `• ${layer.editObjects.length} obj` : ""}
          </span>
        </>
      }
      headerActions={
        <>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 transition-all",
              layer.is_reference
                ? "text-accent-reference bg-accent-reference/20 hover:bg-accent-reference/30 border border-accent-reference/40"
                : "text-text-muted hover:text-accent-reference hover:bg-accent-reference/10"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateLayer({ is_reference: !layer.is_reference });
            }}
            title={
              layer.is_reference
                ? "Reference Layer: ON (マージ除外・オーバーレイ参照用)"
                : "Reference Layer: OFF (通常レイヤー)"
            }
          >
            <Bookmark size={14} className={layer.is_reference ? "fill-accent-reference" : ""} />
          </Button>

          {isManual ? (
            <Button
              variant={isEditing ? "primary" : "ghost"}
              size="icon"
              className="h-7 w-7 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEdit();
              }}
              title={isEditing ? "Stop Vector Editing" : "Start Vector Editing"}
            >
              <Pencil size={14} className={isEditing ? "text-primary-base" : ""} />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-text-muted hover:text-accent-automation hover:bg-accent-automation/10"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInspector();
              }}
              title="Edit Parameters / Re-generate in Inspector"
            >
              <Settings2 size={15} />
            </Button>
          )}
        </>
      }
      showSettings={showSettings}
      onToggleSettings={() => setShowSettings(!showSettings)}
      settingsTooltip="Edit Layer Settings (Opacity, Blend Mode)"
      onToggleVisible={onToggleVisible}
      onRemove={onRemove}
      removeTooltip="Remove Layer"
    >
      {/* Display Settings */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-text-base">Display</span>
        <Slider
          label="Opacity"
          valueDisplay={`${Math.round((layer.opacity ?? 1) * 100)}%`}
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity ?? 1}
          onChange={(e) => onUpdateLayer({ opacity: parseFloat(e.target.value) })}
        />

        <div className="flex flex-col gap-1 mt-1">
          <FieldLabel>Blend Mode</FieldLabel>
          <Select
            value={layer.blend_mode || "overwrite"}
            disabled={!!layer.is_reference}
            onChange={(e) => onUpdateLayer({ blend_mode: e.target.value as any })}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "h-7 text-xs bg-surface-base border-border-base/50",
              layer.is_reference && "opacity-50 cursor-not-allowed bg-surface-base/30"
            )}
          >
            <option value="overwrite">Overwrite</option>
            <option value="merge_obstacles">Merge Obstacles</option>
            <option value="merge_free">Merge Free Space</option>
          </Select>
          {layer.is_reference && (
            <p className="text-[9px] text-accent-reference/80 text-right">
              ※ 参照レイヤーのため合成されません
            </p>
          )}
        </div>
      </div>

      {/* Layer Actions */}
      <div className="pt-2 border-t border-border-base/30 flex items-center justify-between gap-2">
        {isManual ? (
          <span className="text-[10px] text-text-muted">
            Objects: <span className="font-semibold text-text-base">{layer.editObjects.length}</span>
          </span>
        ) : (
          <span className="text-[10px] text-text-muted truncate">
            Plugin: <span className="font-semibold text-text-base">{layer.plugin_id || "Generator"}</span>
          </span>
        )}
        {!isManual && (
          <Button
            variant="secondary"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInspector();
            }}
          >
            <Settings2 size={12} />
            <span>Inspector</span>
          </Button>
        )}
      </div>
    </LayerCardShell>
  );
}

interface LayerCardProps {
  layer: ProjectMapLayer;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isActiveTargetMap: boolean;
  isMapEditMode: boolean;
  onSelect: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
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
  onContextMenu,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onRemove,
  onUpdateLayer,
}: LayerCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const occupancySettings = useAppStore((state) => state.occupancySettings);

  const occThresh = layer.info?.occupied_thresh ?? occupancySettings?.defaultOccupiedThresh ?? 0.65;
  const freeThresh = layer.info?.free_thresh ?? occupancySettings?.defaultFreeThresh ?? 0.25;
  const negate = layer.info?.negate ?? occupancySettings?.defaultNegate ?? 0;

  // Origin & Initial Origin handling
  const rawOrigin = layer.info?.origin;
  const origin: [number, number, number] = Array.isArray(rawOrigin) && rawOrigin.length >= 2
    ? [Number(rawOrigin[0]) || 0, Number(rawOrigin[1]) || 0, Number(rawOrigin[2]) || 0]
    : [0, 0, 0];

  const rawInitialOrigin = layer.info?.initial_origin;
  const initialOrigin: [number, number, number] = Array.isArray(rawInitialOrigin) && rawInitialOrigin.length >= 2
    ? [Number(rawInitialOrigin[0]) || 0, Number(rawInitialOrigin[1]) || 0, Number(rawInitialOrigin[2]) || 0]
    : [...origin];

  const deltaX = origin[0] - initialOrigin[0];
  const deltaY = origin[1] - initialOrigin[1];
  const deltaYawRad = origin[2] - initialOrigin[2];
  const deltaYawDeg = deltaYawRad * (180.0 / Math.PI);

  const handleUpdateDelta = (updates: Partial<{ deltaX: number; deltaY: number; deltaYawDeg: number }>) => {
    const newDx = updates.deltaX !== undefined ? updates.deltaX : deltaX;
    const newDy = updates.deltaY !== undefined ? updates.deltaY : deltaY;
    const newDeg = updates.deltaYawDeg !== undefined ? updates.deltaYawDeg : deltaYawDeg;
    const newDeltaYawRad = newDeg * (Math.PI / 180.0);

    const newOx = initialOrigin[0] + newDx;
    const newOy = initialOrigin[1] + newDy;
    const newOyaw = initialOrigin[2] + newDeltaYawRad;

    onUpdateLayer({
      info: {
        ...layer.info,
        origin: [newOx, newOy, newOyaw],
        initial_origin: initialOrigin,
      },
    });
  };

  const handleResetPose = () => {
    onUpdateLayer({
      info: {
        ...layer.info,
        origin: [...initialOrigin],
        initial_origin: initialOrigin,
      },
    });
  };

  const handleRotateDelta = (stepDeg: number) => {
    let newDeg = Math.round((deltaYawDeg + stepDeg) / 90) * 90;
    newDeg = ((newDeg + 180) % 360 + 360) % 360 - 180;
    handleUpdateDelta({ deltaYawDeg: newDeg });
  };

  const handleUpdateInfo = (updates: Partial<{ occupied_thresh: number; free_thresh: number; negate: number }>) => {
    onUpdateLayer({
      info: {
        ...layer.info,
        origin,
        initial_origin: initialOrigin,
        ...updates,
      },
    });
  };

  const handleResetThresholds = () => {
    onUpdateLayer({
      info: {
        ...layer.info,
        origin,
        initial_origin: initialOrigin,
        occupied_thresh: occupancySettings?.defaultOccupiedThresh ?? 0.65,
        free_thresh: occupancySettings?.defaultFreeThresh ?? 0.25,
        negate: occupancySettings?.defaultNegate ?? 0,
      },
    });
  };

  return (
    <LayerCardShell
      visible={layer.visible}
      isActive={isActiveTargetMap}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      isFirst={isFirst}
      isLast={isLast}
      title={
        <span
          className="text-sm font-bold text-text-base truncate block max-w-[140px]"
          title={layer.name}
        >
          {layer.name}
        </span>
      }
      subBadges={
        <>
          {isMapEditMode && isActiveTargetMap && (
            <span className="text-[9px] font-bold uppercase bg-accent-generator/20 text-accent-generator px-1 py-0.5 rounded flex items-center gap-1">
              <Target size={11} className="shrink-0" />
              Target Map
            </span>
          )}
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
            Layer {index + 1}
          </span>
        </>
      }
      showSettings={showSettings}
      onToggleSettings={() => setShowSettings(!showSettings)}
      settingsTooltip="Edit Map Layer (Pose, Opacity, Blend, Thresholds)"
      onToggleVisible={onToggleVisible}
      onRemove={onRemove}
      removeTooltip="Remove Map"
    >
      {/* Section 1: Relative Pose */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-text-base flex items-center gap-1.5">
            <Move size={12} className="text-accent-generator" />
            Relative Pose (from YAML)
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={handleResetPose}
            title="Reset pose to YAML origin"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </Button>
        </div>

        {/* Quick Rotate Buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={() => handleRotateDelta(-90)}
            title="Rotate -90° (Counter-clockwise)"
          >
            <RotateCcw size={12} />
            <span>-90°</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={() => handleRotateDelta(180)}
            title="Rotate 180°"
          >
            <FlipHorizontal2 size={12} />
            <span>180°</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={() => handleRotateDelta(90)}
            title="Rotate +90° (Clockwise)"
          >
            <RotateCw size={12} />
            <span>+90°</span>
          </Button>
        </div>

        {/* Numeric Inputs for deltaX, deltaY, deltaYaw */}
        <div className="grid grid-cols-3 gap-1.5">
          <LabeledNumericInput
            label="ΔX (m)"
            value={deltaX}
            step={0.05}
            precision={3}
            onChange={(val) => handleUpdateDelta({ deltaX: val })}
          />
          <LabeledNumericInput
            label="ΔY (m)"
            value={deltaY}
            step={0.05}
            precision={3}
            onChange={(val) => handleUpdateDelta({ deltaY: val })}
          />
          <LabeledNumericInput
            label="ΔYaw (°)"
            value={deltaYawDeg}
            step={1}
            precision={1}
            onChange={(val) => handleUpdateDelta({ deltaYawDeg: val })}
          />
        </div>

        {/* Subtext with original YAML origin */}
        <div
          className="text-[9px] text-text-muted truncate font-mono px-0.5"
          title={`YAML Origin: [${initialOrigin[0]}, ${initialOrigin[1]}, ${initialOrigin[2]}]`}
        >
          YAML Origin: [{initialOrigin[0].toFixed(2)}, {initialOrigin[1].toFixed(2)}, {(initialOrigin[2] * (180 / Math.PI)).toFixed(1)}°]
        </div>
      </div>

      {/* Section 2: Display Settings */}
      <div className="space-y-2 pt-2 border-t border-border-base/30">
        <span className="text-[11px] font-bold text-text-base">Display</span>
        <Slider
          label="Layer Opacity"
          valueDisplay={`${Math.round(layer.opacity * 100)}%`}
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity}
          onChange={(e) => onUpdateLayer({ opacity: parseFloat(e.target.value) })}
        />
        <div className="flex flex-col gap-1 mt-1">
          <FieldLabel>Blend Mode</FieldLabel>
          <Select
            value={layer.blend_mode || 'overwrite'}
            onChange={(e) => onUpdateLayer({ blend_mode: e.target.value as any })}
            onClick={(e) => e.stopPropagation()}
            className="text-xs border-border-base/50 h-7"
          >
            <option value="overwrite">Overwrite (Ignore Unknown)</option>
            <option value="merge_obstacles">Merge Obstacles</option>
            <option value="merge_free">Merge Free Space</option>
          </Select>
        </div>
      </div>

      {/* Section 3: Occupancy Thresholds */}
      <div className="space-y-3 pt-2 border-t border-border-base/30">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-text-base flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-occupancy-unknown inline-block" />
            Occupancy Thresholds
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={handleResetThresholds}
            title="Reset thresholds to project defaults"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </Button>
        </div>

        {/* Mini Visual Threshold Bar */}
        <div className="h-2 w-full rounded overflow-hidden flex border border-border-base/40">
          <div
            style={{ width: `${Math.min(100, Math.max(0, freeThresh * 100))}%` }}
            className="bg-occupancy-free/80"
            title={`Free: 0.00 ~ ${freeThresh.toFixed(2)}`}
          />
          <div
            style={{
              width: `${Math.max(0, (occThresh - freeThresh) * 100)}%`,
            }}
            className="bg-occupancy-unknown/80"
            title={`Unknown: ${freeThresh.toFixed(2)} ~ ${occThresh.toFixed(2)}`}
          />
          <div
            style={{
              width: `${Math.max(0, (1.0 - occThresh) * 100)}%`,
            }}
            className="bg-occupancy-obstacle/80"
            title={`Obstacle: ${occThresh.toFixed(2)} ~ 1.00`}
          />
        </div>

        <Slider
          label="Occupied Thresh"
          valueDisplay={occThresh.toFixed(2)}
          min="0"
          max="1"
          step="0.01"
          value={occThresh}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            handleUpdateInfo({ occupied_thresh: Math.max(val, freeThresh) });
          }}
        />

        <Slider
          label="Free Thresh"
          valueDisplay={freeThresh.toFixed(2)}
          min="0"
          max="1"
          step="0.01"
          value={freeThresh}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            handleUpdateInfo({ free_thresh: Math.min(val, occThresh) });
          }}
        />

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-text-muted font-medium">Negate</span>
          <Select
            value={negate}
            onChange={(e) => handleUpdateInfo({ negate: parseInt(e.target.value) as 0 | 1 })}
            className="h-6 text-[11px] bg-surface-base border-border-base/50 w-32 py-0"
          >
            <option value={0}>0 (Standard)</option>
            <option value={1}>1 (Inverted)</option>
          </Select>
        </div>
      </div>
    </LayerCardShell>
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
  const [showSettings, setShowSettings] = useState(false);

  return (
    <LayerCardShell
      visible={region.visible}
      icon={<Crop size={14} className="text-accent-generator shrink-0" />}
      title={
        <Input
          value={region.name}
          onChange={(e) => onUpdateRegion({ name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Region Name"
          className="h-6 text-sm font-bold bg-transparent border-none p-0 focus:ring-0 focus:bg-surface-base/50 truncate max-w-[140px]"
        />
      }
      subBadges={
        <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-accent-generator/20 text-accent-generator">
          Region {index + 1}
        </span>
      }
      showSettings={showSettings}
      onToggleSettings={() => setShowSettings(!showSettings)}
      settingsTooltip="Region Bounds Settings"
      onToggleVisible={onToggleVisible}
      onRemove={onRemove}
      removeTooltip="Remove Region"
    >
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-text-base">Region Bounds</span>
        <div className="grid grid-cols-2 gap-2">
          <LabeledNumericInput
            label="X (m)"
            value={region.rect.x}
            step={0.1}
            precision={2}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, x: val } })}
          />
          <LabeledNumericInput
            label="Y (m)"
            value={region.rect.y}
            step={0.1}
            precision={2}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, y: val } })}
          />
          <LabeledNumericInput
            label="Width (m)"
            value={region.rect.width}
            min={0}
            step={0.1}
            precision={2}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, width: val } })}
          />
          <LabeledNumericInput
            label="Height (m)"
            value={region.rect.height}
            min={0}
            step={0.1}
            precision={2}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, height: val } })}
          />
        </div>
      </div>
    </LayerCardShell>
  );
}

