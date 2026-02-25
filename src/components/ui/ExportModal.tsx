import { X, Save, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { save } from "@tauri-apps/plugin-dialog";
import { BackendAPI } from "../../api/backend";

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
      const savePath = await save({
        defaultPath: lastDirectory || undefined,
        title: "Select Destination Base Path",
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80 shrink-0">
          <h2 className="text-lg font-bold text-slate-200">Export Options</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300 block">
                Output Formats
              </label>
              <div className="flex flex-col gap-2 bg-slate-900/50 p-3 rounded border border-slate-700">
                {useAppStore
                  .getState()
                  .defaultExportFormats.filter((f) => f.enabled)
                  .map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFormats.includes(f.id)}
                        onChange={() => toggleFormat(f.id)}
                        className="ui-checkbox"
                      />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                        {f.name} (.{f.extension})
                      </span>
                    </label>
                  ))}
                {exportTemplates.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFormats.includes(t.id)}
                      onChange={() => toggleFormat(t.id)}
                      className="ui-checkbox"
                    />
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                      {t.name} (.{t.extension})
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Select multiple formats to generate all simultaneously. Suffixes
                specified in the Settings panel will be automatically appended.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={includeImage}
                    onChange={(e) => setIncludeImage(e.target.checked)}
                    className="peer w-5 h-5 appearance-none border-2 border-slate-600 rounded-md bg-slate-900 checked:bg-primary checked:border-primary transition-colors cursor-pointer"
                  />
                  <ImageIcon
                    size={14}
                    className="absolute text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                    Include Canvas Image
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Saves a .png image of the current visible canvas (Map +
                    Waypoints with visible attributes) alongside the exported
                    file.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedFormats.length === 0}
              className={`ui-btn ui-btn-md ${selectedFormats.length === 0 ? "border-slate-700 bg-slate-700 text-slate-400 opacity-50 cursor-not-allowed" : "ui-btn-primary shadow-blue-500/20 shadow-lg"}`}
            >
              <Save size={16} /> Choose Path & Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
