import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { Modal, ModalHeader, ModalContent } from "./common/Modal";
import { Button } from "./common/Button";
import { Input } from "./common/Input";
import { FieldLabel } from "./common/FieldLabel";
import { Pencil, Sparkles, Plus } from "lucide-react";
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

  const layerPlugins = Object.values(plugins).filter(
    (p) => p && p.manifest && p.manifest.category === "map_layer_generator"
  );

  const defaultManualName = `Custom Layer ${customLayers.length + 1}`;

  const handleCreateManual = () => {
    selectNodes([]);
    const name = manualLayerName.trim() || defaultManualName;
    const newLayer = addManualCustomLayer(name);
    setActiveCustomLayerId(newLayer.id);
    setMapEditMode(true);
    setRightPanelActiveTab("inspector");
    setRightPanelOpen(true);
    setManualLayerName("");
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
          <div className="p-4 rounded-2xl border border-border-base/50 bg-surface-panel/40 hover:border-primary-base/50 transition-all space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary-base/10 text-primary-base">
                <Pencil size={20} />
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
                className="h-8 text-xs font-bold gap-1.5 shrink-0"
              >
                <Plus size={14} />
                <span>Create Manual Layer</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Option 2: Generator Plugins */}
        <div className="space-y-3">
          <FieldLabel className="text-xs">Option 2: Plugin Generator</FieldLabel>
          {layerPlugins.length === 0 ? (
            <div className="p-4 rounded-2xl border border-border-base/30 bg-surface-panel/20 text-center text-xs text-text-muted">
              No <code>map_layer_generator</code> plugins currently installed.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {layerPlugins.map((plugin) => (
                <div
                  key={plugin.id}
                  onClick={() => handleSelectPlugin(plugin.id)}
                  className={cn(
                    "p-3.5 rounded-2xl border border-border-base/40 bg-surface-panel/30",
                    "hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer",
                    "flex items-center justify-between gap-3 group"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-base group-hover:text-cyan-400 transition-colors">
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
                    className="h-7 text-xs font-semibold group-hover:border-cyan-500/40 text-cyan-400 shrink-0"
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
