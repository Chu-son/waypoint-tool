import { useState } from "react";
import { Download, FolderOpen } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { BackendAPI, DialogAPI } from "../../api";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "./common/Modal";
import { Button } from "./common/Button";
import { Checkbox } from "./common/Checkbox";
import { Label } from "./common/Label";
import { Input } from "./common/Input";

export function ExportMapsModal() {
  const isOpen = useAppStore((state) => state.isExportMapsModalOpen);
  const onClose = () => useAppStore.getState().setExportMapsModalOpen(false);

  const exportRegions = useAppStore((state) => state.exportRegions);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const updateExportRegion = useAppStore((state) => state.updateExportRegion);
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
            layerVisibility: r.layerVisibility || {},
          }));

        const layersToExport = mapLayers.map(layer => ({
          id: layer.id,
          name: layer.name,
          image_base64: layer.image_base64,
          info: layer.info,
          opacity: layer.opacity,
          blend_mode: layer.blend_mode || 'normal',
          z_index: layer.z_index,
        }));

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
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <Download size={20} className="text-emerald-400" />
          <span>Export Maps</span>
        </div>
      </ModalHeader>

      <ModalContent className="p-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <Label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1 block">
              Export Format
            </Label>
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
              <Label className="text-xs font-bold text-text-muted uppercase tracking-widest block m-0">
                Export Regions & Layer Selection
              </Label>
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
              <div className="text-sm text-text-muted bg-surface-base/30 p-4 rounded-xl border border-border-base/40">
                No export regions defined. Use the 'Add Export Region' tool to draw regions on the canvas first.
              </div>
            ) : (
              <div className="space-y-2">
                {exportRegions.map(region => (
                  <div key={region.id} className="bg-surface-panel/40 border border-border-base/20 rounded-lg p-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={selectedRegions[region.id] || false}
                        onChange={(e) => setSelectedRegions(prev => ({ ...prev, [region.id]: e.target.checked }))}
                      />
                      <span className="font-bold text-sm text-text-base">{region.name}</span>
                    </label>
                    {selectedRegions[region.id] && (
                      <div className="mt-3 pl-7 space-y-2 border-l-2 border-border-base/30 ml-2">
                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest mb-1 block">Included Layers</span>
                        {mapLayers.map(layer => {
                           const isIncluded = region.layerVisibility?.[layer.id] !== false; // Default true
                           return (
                             <label key={layer.id} className="flex items-center gap-2 cursor-pointer">
                               <Checkbox
                                 checked={isIncluded}
                                 onChange={(e) => {
                                   const newVis = { ...(region.layerVisibility || {}), [layer.id]: e.target.checked };
                                   updateExportRegion(region.id, { layerVisibility: newVis });
                                 }}
                               />
                               <span className="text-xs text-text-muted">{layer.name} <span className="opacity-50 text-[10px]">({layer.blend_mode || 'normal'})</span></span>
                             </label>
                           );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-border-base/30">
            <label className="flex items-start gap-4 p-4 rounded-xl bg-primary-base/5 border border-primary-base/10 hover:border-primary-base/30 hover:bg-primary-base/[0.08] transition-all cursor-pointer group">
              <div className="pt-1">
                <Checkbox
                  checked={outputMapList}
                  onChange={(e) => setOutputMapList(e.target.checked)}
                />
              </div>
              <div className="space-y-2 w-full">
                <p className="text-sm font-bold text-text-base group-hover:text-primary-base transition-colors">
                  Generate Map List File
                </p>
                <p className="text-[11px] text-text-muted/80 leading-relaxed">
                  Creates a text file containing the names of all exported maps.
                </p>
                {outputMapList && (
                  <Input 
                    value={mapListFilename}
                    onChange={(e) => setMapListFilename(e.target.value)}
                    placeholder="map_list.txt"
                    className="h-8 text-sm mt-2"
                    onClick={e => e.preventDefault()}
                  />
                )}
              </div>
            </label>
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
          onClick={handleExport}
          disabled={exportRegions.length === 0 || Object.values(selectedRegions).every(v => !v)}
          className="min-w-40 shadow-lg bg-emerald-500 hover:bg-emerald-600 hover:scale-105 active:scale-95 shadow-emerald-500/20 text-white border-transparent"
        >
          <FolderOpen size={16} className="mr-2" />
          Select Output Folder
        </Button>
      </ModalFooter>
    </Modal>
  );
}
