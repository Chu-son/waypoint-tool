import { useState } from 'react';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../common/ContextMenu';
import {
  Eye,
  EyeOff,
  Trash2,
  FolderOpen,
  ChevronDown,
  Crop,
  ScanEye,
  Pencil,
  Settings2,
  Plus,
  Palette,
  Bookmark,
  Code2,
} from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { DialogAPI, BackendAPI } from '../../../api';
import { Button } from '../common/Button';
import { FieldLabel } from '../common/FieldLabel';
import { EmptyState } from '../common/EmptyState';
import { NewCustomLayerModal } from '../modals/NewCustomLayerModal';
import { cn } from '../../../utils/cn';
import { notifyError } from '../../../services/notify';
import { CustomLayerCard } from './CustomLayerCard';
import { MapLayerCard } from './MapLayerCard';
import { RegionCard } from './RegionCard';

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
  const [isExportRegionsOpen, setIsExportRegionsOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<{
    type: 'custom' | 'map';
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const handleLoadMap = async () => {
    try {
      const selectedPath = await DialogAPI.open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [{ name: 'ROS Map YAML', extensions: ['yaml'] }],
      });
      if (selectedPath) {
        const pathStr = typeof selectedPath === 'string' ? selectedPath : (selectedPath as any).path;
        if (!pathStr) return;
        const lastSlash = Math.max(pathStr.lastIndexOf('/'), pathStr.lastIndexOf('\\'));
        const dir = lastSlash > -1 ? pathStr.substring(0, lastSlash) : pathStr;
        setLastDirectory(dir);

        await runWithLoading(
          {
            message: 'マップを読み込み中...',
            detail: pathStr.split(/[/\\]/).pop() || pathStr,
            blocking: true,
          },
          async () => {
            const result = await BackendAPI.loadROSMap(pathStr);
            const filename = pathStr.split(/[/\\]/).pop() || 'Map';
            addMapLayer(filename, result.info, result.image_data_b64, result.width, result.height);
          },
        );
      }
    } catch (err) {
      console.error('Failed to load map:', err);
      void notifyError(`マップの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
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
                  'h-7 px-2 text-[11px] font-semibold gap-1.5 transition-all',
                  showOccupancyHighlight
                    ? 'text-accent-reference bg-accent-reference/20 hover:bg-accent-reference/30 border border-accent-reference/40 shadow-sm'
                    : 'text-text-muted hover:text-text-base hover:bg-surface-hover/50',
                )}
                onClick={() => setShowOccupancyHighlight(!showOccupancyHighlight)}
                title={
                  showOccupancyHighlight
                    ? 'Occupancy Highlight: ON (3値色分けプレビュー解除)'
                    : 'Occupancy Highlight: OFF (3値色分けプレビュー表示)'
                }
              >
                <Palette size={13} />
                <span>Occupancy</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2 text-[11px] font-semibold gap-1.5 transition-all',
                  isExportPreview
                    ? 'text-accent-generator bg-accent-generator/20 hover:bg-accent-generator/30 border border-accent-generator/40 shadow-sm'
                    : 'text-text-muted hover:text-text-base hover:bg-surface-hover/50',
                )}
                onClick={() => setIsExportPreview(!isExportPreview)}
                title={
                  isExportPreview
                    ? 'Merged Map Preview: ON (クリックで解除)'
                    : 'Merged Map Preview: OFF (クリックで有効化)'
                }
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
              const isEditing = isMapEditMode && isActive && layer.type === 'manual';
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
                    setRightPanelActiveTab('inspector');
                    setRightPanelOpen(true);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectNodes([]);
                    setActiveCustomLayerId(layer.id);
                    setContextMenu({ type: 'custom', id: layer.id, x: e.clientX, y: e.clientY });
                  }}
                  onToggleEdit={() => {
                    if (layer.type === 'manual') {
                      if (isEditing) {
                        setMapEditMode(false);
                      } else {
                        selectNodes([]);
                        setActiveCustomLayerId(layer.id);
                        setMapEditMode(true);
                        setRightPanelActiveTab('inspector');
                        setRightPanelOpen(true);
                      }
                    }
                  }}
                  onOpenInspector={() => {
                    selectNodes([]);
                    setActiveCustomLayerId(layer.id);
                    setRightPanelActiveTab('inspector');
                    setRightPanelOpen(true);
                  }}
                  onMoveUp={() => moveUpCustom(index)}
                  onMoveDown={() => moveDownCustom(index)}
                  onToggleVisible={() => updateCustomLayer(layer.id, { visible: !layer.visible })}
                  onRemove={async () => {
                    const confirmed = await DialogAPI.ask(`Remove custom layer '${layer.name}'?`, {
                      title: 'Remove Custom Layer',
                      kind: 'warning',
                    });
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
          <div className={cn('space-y-4', customLayers.length > 0 && 'pt-4 border-t border-border-base/20')}>
            <div className="flex items-center gap-2 ml-1">
              <FieldLabel className="flex items-center gap-2 flex-1">
                Map Layers
                <div className="h-px flex-1 bg-border-base/20" />
              </FieldLabel>
            </div>
            {mapLayers.map((layer, index) => {
              const isActiveTargetMap = activeMapLayerId === layer.id;
              return (
                <MapLayerCard
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
                    setContextMenu({ type: 'map', id: layer.id, x: e.clientX, y: e.clientY });
                  }}
                  onMoveUp={() => moveUpMap(index)}
                  onMoveDown={() => moveDownMap(index)}
                  onToggleVisible={() => updateMapLayer(layer.id, { visible: !layer.visible })}
                  onRemove={async () => {
                    const confirmed = await DialogAPI.ask(`Remove map layer '${layer.name}'?`, {
                      title: 'Remove Map',
                      kind: 'warning',
                    });
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
              <button
                onClick={() => setIsExportRegionsOpen(!isExportRegionsOpen)}
                className="flex items-center gap-1.5 flex-1 text-left cursor-pointer group select-none py-0.5"
              >
                <ChevronDown
                  size={13}
                  className={cn(
                    'text-text-muted group-hover:text-text-base transition-transform shrink-0',
                    !isExportRegionsOpen && '-rotate-90',
                  )}
                />
                <FieldLabel className="flex items-center gap-2 flex-1 cursor-pointer">
                  Export Regions
                  <span className="text-[10px] font-normal text-text-muted bg-surface-hover/80 px-1.5 py-0.2 rounded-full">
                    {exportRegions.length}
                  </span>
                  <div className="h-px flex-1 bg-border-base/20" />
                </FieldLabel>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-2 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
                onClick={() => {
                  const allVisible = exportRegions.every((r) => r.visible);
                  exportRegions.forEach((r) => updateExportRegion(r.id, { visible: !allVisible }));
                }}
                title={exportRegions.every((r) => r.visible) ? 'Hide All Regions' : 'Show All Regions'}
              >
                {exportRegions.every((r) => r.visible) ? <Eye size={14} /> : <EyeOff size={14} />}
              </Button>
            </div>
            {isExportRegionsOpen &&
              exportRegions.map((region, index) => (
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
      <NewCustomLayerModal isOpen={isNewCustomLayerModalOpen} onClose={() => setIsNewCustomLayerModalOpen(false)} />

      {/* Layer Context Menu */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {contextMenu.type === 'custom' &&
            (() => {
              const layer = customLayers.find((l) => l.id === contextMenu.id);
              if (!layer) return null;
              const isManual = layer.type === 'manual';
              const isEditing = isMapEditMode && activeCustomLayerId === layer.id && isManual;

              return (
                <>
                  {!isManual ? (
                    <>
                      <ContextMenuItem
                        icon={<Code2 size={13} className="text-accent-automation" />}
                        onSelect={() =>
                          openPluginDataModal(
                            `カスタムレイヤー: ${layer.name}`,
                            layer.plugin_data,
                            `プラグイン: ${layer.plugin_id || 'Unknown'} • 内部メタデータ (Read-only)`,
                          )
                        }
                      >
                        内部プロパティを表示
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<Settings2 size={13} className="text-text-muted" />}
                        onSelect={() => {
                          selectNodes([]);
                          setActiveCustomLayerId(layer.id);
                          setRightPanelActiveTab('inspector');
                          setRightPanelOpen(true);
                        }}
                      >
                        パラメータ編集 / 再生成
                      </ContextMenuItem>
                    </>
                  ) : (
                    <ContextMenuItem
                      icon={<Pencil size={13} className="text-primary-base" />}
                      onSelect={() => {
                        selectNodes([]);
                        setActiveCustomLayerId(layer.id);
                        setMapEditMode(!isEditing);
                        setRightPanelActiveTab('inspector');
                        setRightPanelOpen(true);
                      }}
                    >
                      {isEditing ? 'ベクター編集を終了' : 'ベクター編集を開始'}
                    </ContextMenuItem>
                  )}
                  <ContextMenuItem
                    icon={
                      <Bookmark
                        size={13}
                        className={
                          layer.is_reference ? 'fill-accent-reference text-accent-reference' : 'text-text-muted'
                        }
                      />
                    }
                    onSelect={() => updateCustomLayer(layer.id, { is_reference: !layer.is_reference })}
                  >
                    {layer.is_reference ? '参照レイヤー解除' : '参照レイヤーに設定'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={
                      layer.visible ? (
                        <EyeOff size={13} className="text-text-muted" />
                      ) : (
                        <Eye size={13} className="text-text-base" />
                      )
                    }
                    onSelect={() => updateCustomLayer(layer.id, { visible: !layer.visible })}
                  >
                    {layer.visible ? '非表示にする' : '表示する'}
                  </ContextMenuItem>

                  <ContextMenuSeparator />

                  <ContextMenuItem
                    tone="danger"
                    icon={<Trash2 size={13} />}
                    onSelect={async () => {
                      const confirmed = await DialogAPI.ask(`Remove custom layer '${layer.name}'?`, {
                        title: 'Remove Custom Layer',
                        kind: 'warning',
                      });
                      if (confirmed) {
                        removeCustomLayer(layer.id);
                        if (activeCustomLayerId === layer.id) {
                          setActiveCustomLayerId(null);
                          setMapEditMode(false);
                        }
                      }
                    }}
                  >
                    削除 (Delete)
                  </ContextMenuItem>
                </>
              );
            })()}

          {contextMenu.type === 'map' &&
            (() => {
              const layer = mapLayers.find((l) => l.id === contextMenu.id);
              if (!layer) return null;

              return (
                <>
                  <ContextMenuItem
                    icon={<Crop size={13} className="text-primary-base" />}
                    onSelect={() => setActiveMapLayerId(layer.id)}
                  >
                    編集対象マップに設定
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={
                      layer.visible ? (
                        <EyeOff size={13} className="text-text-muted" />
                      ) : (
                        <Eye size={13} className="text-text-base" />
                      )
                    }
                    onSelect={() => updateMapLayer(layer.id, { visible: !layer.visible })}
                  >
                    {layer.visible ? '非表示にする' : '表示する'}
                  </ContextMenuItem>

                  <ContextMenuSeparator />

                  <ContextMenuItem
                    tone="danger"
                    icon={<Trash2 size={13} />}
                    onSelect={async () => {
                      const confirmed = await DialogAPI.ask(`Remove map layer '${layer.name}'?`, {
                        title: 'Remove Map',
                        kind: 'warning',
                      });
                      if (confirmed) {
                        removeMapLayer(layer.id);
                        if (activeMapLayerId === layer.id) {
                          setActiveMapLayerId(null);
                        }
                      }
                    }}
                  >
                    削除 (Delete)
                  </ContextMenuItem>
                </>
              );
            })()}
        </ContextMenu>
      )}
    </div>
  );
}

// --- Local Helper Components ---
