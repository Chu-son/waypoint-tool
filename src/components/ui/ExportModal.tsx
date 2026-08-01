import { Save } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { DialogAPI } from "../../api";
import { BackendAPI } from "../../api";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "./common/Modal";
import { Button } from "./common/Button";
import { Checkbox } from "./common/Checkbox";
import { Label } from "./common/Label";
import { cn } from "../../utils/cn";
import { OptionCard } from "./common/OptionCard";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const exportTemplates = useAppStore((state) => state.exportTemplates);
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const setLastDirectory = useAppStore((state) => state.setLastDirectory);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const optionsSchema = useAppStore((state) => state.optionsSchema);

  const [includeImage, setIncludeImage] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([
    "__default_yaml__",
  ]);

  if (!isOpen) return null;

  const toggleFormat = (fmtId: string) => {
    setSelectedFormats((prev) =>
      prev.includes(fmtId) ? prev.filter((f) => f !== fmtId) : [...prev, fmtId],
    );
  };

  const handleExport = async () => {
    if (selectedFormats.length === 0) {
      alert("At least one export format must be selected.");
      return;
    }

    try {
      const savePath = await DialogAPI.save({
        defaultPath: lastDirectory || undefined,
      });

      if (savePath) {
        // Remove trailing extension if user typed one, so we can append cleanly
        let basePath = savePath;
        const lastDot = basePath.lastIndexOf(".");
        const lastSlash = Math.max(
          basePath.lastIndexOf("/"),
          basePath.lastIndexOf("\\"),
        );
        if (lastDot > lastSlash) {
          basePath = basePath.substring(0, lastDot);
        }

        if (lastSlash > -1) setLastDirectory(basePath.substring(0, lastSlash));

        // 1. Flatten all waypoints including generator children
        const flatIds: string[] = [];
        rootNodeIds.forEach((id) => {
          const node = nodes[id];
          if (!node) return;
          if (node.type === "manual") flatIds.push(id);
          else if (node.type === "generator" && node.children_ids) {
            flatIds.push(...node.children_ids);
          }
        });

        // 2. Hydrate and map
        const waypointsToExport = flatIds
          .map((id, index) => {
            const node = nodes[id];
            if (!node) return null;

            const fullOptions: Record<string, any> = {};
            if (optionsSchema && optionsSchema.options) {
              optionsSchema.options.forEach((opt: any) => {
                fullOptions[opt.name] =
                  node.options && node.options[opt.name] !== undefined
                    ? node.options[opt.name]
                    : opt.default;
              });
            }
            if (node.options) {
              Object.keys(node.options).forEach((k) => {
                if (fullOptions[k] === undefined)
                  fullOptions[k] = node.options![k];
              });
            }

            const qx = node.transform?.qx || 0;
            const qy = node.transform?.qy || 0;
            const qz = node.transform?.qz || 0;
            const qw = node.transform?.qw ?? 1;
            const yawVal = Math.atan2(
              2.0 * (qw * qz + qx * qy),
              1.0 - 2.0 * (qy * qy + qz * qz),
            );

            return {
              index: index + indexStartIndex,
              id: node.id,
              type: node.type,
              x: node.transform?.x ?? 0,
              y: node.transform?.y ?? 0,
              z: node.transform?.z ?? 0,
              yaw: yawVal,
              qx,
              qy,
              qz,
              qw,
              options: fullOptions,
            };
          })
          .filter((n) => n !== null);

        // Extract image if requested
        let imageDataB64 = undefined;
        if (includeImage) {
          useAppStore.setState({ shouldFitToMaps: Date.now() });
          await new Promise((r) => setTimeout(r, 800)); // wait for Pixi
          const canvas = document.querySelector("canvas");
          if (canvas) {
            imageDataB64 = canvas.toDataURL("image/png").split(",")[1];
          }
        }

        // Export each selected format
        for (let i = 0; i < selectedFormats.length; i++) {
          const formatId = selectedFormats[i];

          let extension = "yaml";
          let suffix = "";
          let templateContent = undefined;

          // Check Default Formats first
          const defaultFormat = useAppStore
            .getState()
            .defaultExportFormats.find((f) => f.id === formatId);
          if (defaultFormat) {
            extension = defaultFormat.extension;
            suffix = defaultFormat.suffix;
          } else {
            // Check Custom Templates
            const t = exportTemplates.find((x) => x.id === formatId);
            if (t) {
              templateContent = t.content;
              extension = t.extension;
              suffix = t.suffix || "";
            } else {
              continue; // Skip invalid
            }
          }

          const finalPath = `${basePath}${suffix}.${extension}`;

          // Only send image on the first format to avoid overwriting identical PNGs wastefully
          await BackendAPI.exportWaypoints(
            finalPath,
            waypointsToExport as any[],
            templateContent,
            i === 0 ? imageDataB64 : undefined,
          );
        }

        alert("エクスポートが完了しました。");
        onClose();
      }
    } catch (err) {
      console.error("Failed to export waypoints:", err);
      alert(`エクスポートに失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader
        onClose={onClose}
        icon={<Save size={20} className="text-primary-base" />}
        title="Export Waypoints"
      />

      <ModalContent className="p-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="space-y-4">
            <Label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1 block">
              Desired Output Formats
            </Label>
            <div className="grid grid-cols-1 gap-2 bg-surface-base/30 p-4 rounded-xl border border-border-base/40 shadow-inner">
              {useAppStore
                .getState()
                .defaultExportFormats.filter((f) => f.enabled)
                .map((f) => (
                  <label
                    key={f.id}
                    className="flex items-center justify-between p-3 px-4 rounded-lg bg-surface-panel/40 border border-border-base/20 hover:border-primary-base/30 hover:bg-surface-panel/60 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={selectedFormats.includes(f.id)}
                        onChange={() => toggleFormat(f.id)}
                      />
                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-text-base group-hover:text-primary-base transition-colors">
                          {f.name}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono uppercase">
                          Standard Format (.{f.extension})
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              {exportTemplates.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center justify-between p-3 px-4 rounded-lg bg-surface-panel/40 border border-border-base/20 hover:border-primary-base/30 hover:bg-surface-panel/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedFormats.includes(t.id)}
                      onChange={() => toggleFormat(t.id)}
                    />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-text-base group-hover:text-primary-base transition-colors">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono uppercase flex items-center gap-2">
                        <span>{t.scope === 'local' ? '[Local]' : '[Global]'}</span>
                        <span>Custom Template (.{t.extension})</span>
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-text-muted/80 leading-relaxed px-2">
              Select multiple formats to generate all simultaneously. Suffixes specified in settings will be automatically appended to filenames.
            </p>
          </div>

          <div className="pt-6 border-t border-border-base/30">
            <OptionCard
              checked={includeImage}
              onChange={setIncludeImage}
              title="Include High-Res Map Shot"
              description="Generates a dedicated `.png` capture highlighting all exported waypoints on top of the map layer."
            />
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
          disabled={selectedFormats.length === 0}
          className={cn(
            "min-w-40 shadow-lg transition-all",
            selectedFormats.length > 0 ? "bg-primary-base hover:bg-primary-hover hover:scale-105 active:scale-95 shadow-primary-base/20" : "opacity-50"
          )}
        >
          <Save size={16} className="mr-2" />
          Choose Path & Export
        </Button>
      </ModalFooter>
    </Modal>
  );
}
