import { useState } from 'react';
import { Eye, EyeOff, FolderOpen, ChevronDown, ScanEye, Plus, Palette, FolderPlus } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { Button } from '../common/Button';
import { FieldLabel } from '../common/FieldLabel';
import { NewCustomLayerModal } from '../modals/NewCustomLayerModal';
import { cn } from '../../../utils/cn';
import { importMapFromDialog } from '../../../services/mapImport';
import { groupLayerItems, selectedLayerItemIds } from '../../../services/layerCommands';
import { GeoMapCard } from './GeoMapCard';
import { RegionCard } from './RegionCard';
import { LayerVisibilitySetBar } from './LayerVisibilitySetBar';
import { LayerTree } from './LayerTree';

export function LayerPanel() {
  const hasLayers = useAppStore((state) => state.mapLayers.length > 0 || state.customLayers.length > 0);
  const hasTreeItems = useAppStore((state) => state.rootLayerIds.length > 0);
  const exportRegions = useAppStore((state) => state.exportRegions);
  const updateExportRegion = useAppStore((state) => state.updateExportRegion);
  const removeExportRegion = useAppStore((state) => state.removeExportRegion);
  const isExportPreview = useAppStore((state) => state.isExportPreview);
  const setIsExportPreview = useAppStore((state) => state.setIsExportPreview);
  const showOccupancyHighlight = useAppStore((state) => state.showOccupancyHighlight);
  const setShowOccupancyHighlight = useAppStore((state) => state.setShowOccupancyHighlight);
  const addLayerGroup = useAppStore((state) => state.addLayerGroup);

  const [isNewCustomLayerModalOpen, setIsNewCustomLayerModalOpen] = useState(false);
  const [isExportRegionsOpen, setIsExportRegionsOpen] = useState(true);

  const handleGroup = () => {
    const selected = selectedLayerItemIds();
    if (selected.length > 0) groupLayerItems(selected);
    else addLayerGroup();
  };

  return (
    <div className="flex-1 overflow-hidden w-full flex flex-col bg-surface-base/20">
      {/* Top Action Buttons */}
      <div className="p-4 shrink-0 border-b border-border-base/30 bg-surface-panel/30 backdrop-blur-md flex flex-col gap-2">
        <Button
          onClick={() => importMapFromDialog({ atSelection: true })}
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
        <GeoMapCard />

        <LayerVisibilitySetBar />

        {/* Global Composite Preview & Highlight Controls */}
        {hasLayers && (
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-surface-panel/40 border border-border-base/40 rounded-lg shadow-sm">
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

        {/* Layer Tree: maps, custom layers and groups, top of the stack first */}
        <div className="space-y-2">
          {hasTreeItems && (
            <div className="flex items-center gap-2 ml-1">
              <FieldLabel className="flex items-center gap-2 flex-1">
                Layers
                <div className="h-px flex-1 bg-border-base/20" />
              </FieldLabel>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-text-muted hover:text-accent-anchor"
                onClick={handleGroup}
                aria-label="グループ"
                title="選択した項目をグループ化（未選択なら空のグループを追加） Ctrl+G"
              >
                <FolderPlus size={14} />
              </Button>
            </div>
          )}
          <LayerTree />
        </div>

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

      <NewCustomLayerModal isOpen={isNewCustomLayerModalOpen} onClose={() => setIsNewCustomLayerModalOpen(false)} />
    </div>
  );
}
