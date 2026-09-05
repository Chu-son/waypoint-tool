import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { Modal, ModalHeader, ModalContent } from "./common/Modal";
import { Button } from "./common/Button";
import { Input } from "./common/Input";
import { Checkbox } from "./common/Checkbox";
import { FieldLabel } from "./common/FieldLabel";
import { Pencil, Sparkles, Plus, Bookmark } from "lucide-react";
import { cn } from "../../utils/cn";

interface NewCustomLayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewCustomLayerModal({ isOpen, onClose }: NewCustomLayerModalProps) {
  const customLayers = useAppStore((state) => state.customLayers) || [];
  const plugins = useAppStore((state) => state.plugins) || {};
  const addManualCustomLayer = useAppStore((state) => state.addManualCustomLayer);
  const setActiveCustomLayerId = useAppStore((state) => state.setActiveCustomLayerId);
  const setActivePlugin = useAppStore((state) => state.setActivePlugin);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setMapEditMode = useAppStore((state) => state.setMapEditMode);
  const setRightPanelActiveTab = useAppStore((state) => state.setRightPanelActiveTab);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);
  const selectNodes = useAppStore((state) => state.selectNodes);

  const [manualLayerName, setManualLayerName] = useState("");
  const [isReferenceManual, setIsReferenceManual] = useState(false);

  const layerPlugins = Object.values(plugins).filter(
    (p) => p && p.manifest && p.manifest.category === "map_layer_generator"
  );

  const defaultManualName = `Custom Layer ${customLayers.length + 1}`;

  const handleCreateManual = () => {
    selectNodes([]);
    const name = manualLayerName.trim() || defaultManualName;
    const newLayer = addManualCustomLayer(name, isReferenceManual);
    setActiveCustomLayerId(newLayer.id);
    setMapEditMode(true);
    setRightPanelActiveTab("inspector");
    setRightPanelOpen(true);
    setManualLayerName("");
    setIsReferenceManual(false);
    onClose();
  };

  const handleSelectPlugin = (pluginId: string) => {
    selectNodes([]);
    setActiveCustomLayerId("new");
    setActivePlugin(pluginId);
    setActiveTool("add_generator");
    setRightPanelActiveTab("inspector");
    setRightPanelOpen(true);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
    >
      <ModalHeader title="Create Custom Layer" onClose={onClose} />
      <ModalContent className="space-y-6">
        {/* Option 1: Manual Vector Layer */}
        <div className="space-y-3">
          <FieldLabel className="text-xs">Option 1: Manual Vector Drawing</FieldLabel>
          <div className="p-4 rounded-lg border border-border-base/50 bg-surface-panel/40 hover:border-primary-base/50 transition-all space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary-base/10 text-primary-base">
                <Pencil size={18} />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-bold text-text-base">Manual Vector Layer</h4>
                <p className="text-xs text-text-muted">
                  Draw obstacle boxes, circular forbidden zones, or freehand erase/paint brush strokes directly onto the canvas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Input
                value={manualLayerName}
                onChange={(e) => setManualLayerName(e.target.value)}
                placeholder={defaultManualName}
                className="h-8 text-xs bg-surface-base flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateManual();
                }}
              />
              <Button
                variant="primary"
                onClick={handleCreateManual}
                className="h-8 text-xs font-medium gap-1.5 shrink-0"
              >
                <Plus size={14} />
                <span>Create Manual Layer</span>
              </Button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted hover:text-text-base select-none pt-1">
              <Checkbox
                checked={isReferenceManual}
                onChange={(e) => setIsReferenceManual(e.target.checked)}
              />
              <span className="flex items-center gap-1.5">
                <Bookmark size={13} className={isReferenceManual ? "text-accent-reference fill-accent-reference" : ""} />
                参照用レイヤーとして作成（マップ合成・エクスポートから除外）
              </span>
            </label>
          </div>
        </div>

        {/* Option 2: Generator Plugins */}
        <div className="space-y-3">
          <FieldLabel className="text-xs">Option 2: Plugin Generator</FieldLabel>
          {layerPlugins.length === 0 ? (
            <div className="p-4 rounded-lg border border-border-base/30 bg-surface-panel/20 text-center text-xs text-text-muted">
              No <code>map_layer_generator</code> plugins currently installed.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {layerPlugins.map((plugin) => (
                <div
                  key={plugin.id}
                  onClick={() => handleSelectPlugin(plugin.id)}
                  className={cn(
                    "p-3 rounded-lg border border-border-base/40 bg-surface-panel/30",
                    "hover:border-accent-automation/50 hover:bg-accent-automation/5 transition-colors cursor-pointer",
                    "flex items-center justify-between gap-3 group"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-accent-automation/10 text-accent-automation">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-base group-hover:text-accent-automation transition-colors">
                        {plugin.manifest.name}
                      </h4>
                      {plugin.manifest.description && (
                        <p className="text-[11px] text-text-muted line-clamp-1">
                          {plugin.manifest.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs font-semibold group-hover:border-accent-automation/40 text-accent-automation shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPlugin(plugin.id);
                    }}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
