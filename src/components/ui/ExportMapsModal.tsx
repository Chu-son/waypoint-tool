import { useState } from "react";
import { Download, FolderOpen } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { BackendAPI, DialogAPI } from "../../api";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "./common/Modal";
import { Button } from "./common/Button";
import { Checkbox } from "./common/Checkbox";
import { Input } from "./common/Input";
import { OptionCard } from "./common/OptionCard";
import { FieldLabel } from "./common/FieldLabel";
import { EmptyState } from "./common/EmptyState";
import { rasterizeEditLayerToExportLayer } from "../../utils/mapRasterize";

export function ExportMapsModal() {
  const isOpen = useAppStore((state) => state.isExportMapsModalOpen);
  const onClose = () => useAppStore.getState().setExportMapsModalOpen(false);

  const exportRegions = useAppStore((state) => state.exportRegions);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const editLayers = useAppStore((state) => state.editLayers);
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const setLastDirectory = useAppStore((state) => state.setLastDirectory);

  const [selectedRegions, setSelectedRegions] = useState<Record<string, boolean>>(
    exportRegions.reduce((acc, r) => ({ ...acc, [r.id]: true }), {})
  );
  
  const [exportFormat, setExportFormat] = useState<'ros_standard' | 'png_only'>('ros_standard');
  const [mapListFilename, setMapListFilename] = useState("map_list.txt");
  const [outputMapList, setOutputMapList] = useState(true);

  if (!isOpen) return null;

  const handleExport = async () => {
    const selectedRegionIds = Object.keys(selectedRegions).filter(id => selectedRegions[id]);
    if (selectedRegionIds.length === 0) {
      alert("At least one export region must be selected.");
      return;
    }

    try {
      const saveDir = await DialogAPI.open({
        directory: true,
        multiple: false,
        defaultPath: lastDirectory || undefined,
      });

      if (saveDir) {
        const dirPath = typeof saveDir === "string" ? saveDir : (saveDir as any).path;
        if (!dirPath) return;
        setLastDirectory(dirPath);

        const regionsToExport = exportRegions
          .filter(r => selectedRegions[r.id])
          .map(r => ({
            name: r.name,
            rect: r.rect,
            layerVisibility: {},
          }));

        // Extract visible map layers (untouched base images)
        const visibleMapLayers = mapLayers
          .filter(layer => layer.visible)
          .map(layer => ({
            id: layer.id,
            name: layer.name,
            image_base64: layer.image_base64,
            info: layer.info,
            opacity: 1.0,
            blend_mode: layer.blend_mode || 'overwrite',
            z_index: layer.z_index,
          }));

        // Rasterize visible EditLayers into standalone transparent layers
        const editLayerExports = await Promise.all(
          editLayers.map(el => rasterizeEditLayerToExportLayer(el))
        );
        const validEditLayers = editLayerExports.filter((l): l is NonNullable<typeof l> => l !== null);

        const layersToExport = [...visibleMapLayers, ...validEditLayers];

        await BackendAPI.exportMaps({
          saveDir: dirPath,
          format: exportFormat,
          mapListFilename: outputMapList ? mapListFilename : null,
          regions: regionsToExport,
          layers: layersToExport,
        });

        alert("マップのエクスポートが完了しました。");
        onClose();
      }
    } catch (err) {
      console.error("Failed to export maps:", err);
      alert(`マップのエクスポートに失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader
        onClose={onClose}
        icon={<Download size={20} className="text-emerald-400" />}
        title="Export Maps"
      />

      <ModalContent className="p-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <FieldLabel>Export Format</FieldLabel>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="radio" 
                  checked={exportFormat === 'ros_standard'} 
                  onChange={() => setExportFormat('ros_standard')}
                  className="accent-emerald-500"
                />
                ROS Standard (.pgm + .yaml)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="radio" 
                  checked={exportFormat === 'png_only'} 
                  onChange={() => setExportFormat('png_only')}
                  className="accent-emerald-500"
                />
                Image Only (.png)
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between ml-1">
              <FieldLabel>Export Regions</FieldLabel>
              {exportRegions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] uppercase font-bold text-text-muted hover:text-primary-base hover:bg-primary-base/10 px-2"
                  onClick={() => {
                    const allSelected = exportRegions.every(r => selectedRegions[r.id]);
                    const newSelected = { ...selectedRegions };
                    exportRegions.forEach(r => newSelected[r.id] = !allSelected);
                    setSelectedRegions(newSelected);
                  }}
                >
                  {exportRegions.every(r => selectedRegions[r.id]) ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>
            {exportRegions.length === 0 ? (
              <EmptyState message="No export regions defined. Use the 'Add Export Region' tool to draw regions on the canvas first." />
            ) : (
              <div className="space-y-2">
                {exportRegions.map(region => (
                  <div key={region.id} className="bg-surface-panel/40 border border-border-base/20 rounded-lg p-3 flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={selectedRegions[region.id] || false}
                        onChange={(e) => setSelectedRegions(prev => ({ ...prev, [region.id]: e.target.checked }))}
                      />
                      <span className="font-bold text-sm text-text-base">{region.name}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-border-base/30">
            <OptionCard
              checked={outputMapList}
              onChange={setOutputMapList}
              title="Generate Map List File"
              description="Creates a text file containing the names of all exported maps."
            >
              {outputMapList && (
                <Input
                  value={mapListFilename}
                  onChange={(e) => setMapListFilename(e.target.value)}
                  placeholder="map_list.txt"
                  className="h-8 text-sm mt-2 font-mono"
                  onClick={(e) => e.preventDefault()}
                />
              )}
            </OptionCard>
          </div>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button
          variant="ghost"
          onClick={onClose}
          className="px-6 text-text-muted font-bold"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleExport}
          disabled={exportRegions.length === 0 || Object.values(selectedRegions).every(v => !v)}
          className="min-w-40"
        >
          <FolderOpen size={16} className="mr-2" />
          Select Output Folder
        </Button>
      </ModalFooter>
    </Modal>
  );
}
