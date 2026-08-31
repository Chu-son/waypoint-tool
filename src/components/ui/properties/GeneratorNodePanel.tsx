import { useState, useEffect } from "react";
import { useAppStore } from "../../../stores/appStore";
import { Button } from "../common/Button";
import { AlertBox } from "../common/AlertBox";
import { PluginPropertyEditor } from "../PluginPropertyEditor";
import { PluginInputEditor } from "../PluginInputEditor";
import { PluginDataViewer } from "../common/PluginDataViewer";
import { Play, Settings2, RefreshCcw, BoxSelect, Code2, Maximize2 } from "lucide-react";
import { WaypointNode } from "../../../types/store";

interface GeneratorNodePanelProps {
  node: WaypointNode;
  handleUpdate?: (id: string, updates: any) => void;
}

export function GeneratorNodePanel({
  node,
}: GeneratorNodePanelProps) {
  const plugins = useAppStore((state) => state.plugins);
  const explodeGenerator = useAppStore((state) => state.explodeGenerator);
  const openPluginDataModal = useAppStore((state) => state.openPluginDataModal);
  const updatePluginInteractionData = useAppStore(
    (state) => state.updatePluginInteractionData,
  );
  const pluginInteractionData = useAppStore(
    (state) => state.pluginInteractionData,
  );
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const runWithLoading = useAppStore((state) => state.runWithLoading);

  const [genParams, setGenParams] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  const pluginId = node.plugin_id || "";
  const plugin = plugins[pluginId];

  useEffect(() => {
    if (node.generator_params?.properties)
      setGenParams({ ...node.generator_params.properties });
    if (node.generator_params?.interaction_data) {
      Object.entries(node.generator_params.interaction_data).forEach(
        ([key, val]) => {
          updatePluginInteractionData(key, val);
        },
      );
    }
  }, [node.id]);

  useEffect(() => {
    useAppStore.getState().setPluginActiveProperties(genParams);
  }, [genParams, node.id]);

  const handleRegenerate = async () => {
    if (!plugin) return;
    setIsExecuting(true);
    try {
      await runWithLoading(
        {
          message: "ウェイポイントを再生成中...",
          detail: plugin.manifest.name || plugin.id,
          blocking: true,
        },
        async () => {
          const filteredInteractionData: Record<string, any> = {};
          plugin.manifest.inputs?.forEach((inp) => {
            const key = inp.name || inp.id;
            if (key && pluginInteractionData[key]) {
              filteredInteractionData[key] = pluginInteractionData[key];
            }
          });

          await useAppStore.getState().executeGeneratorPlugin({
            plugin,
            properties: genParams,
            interactionData: filteredInteractionData,
            existingExecutionId: node.source_execution_id,
            targetParentWaypointId: node.id,
          });
        }
      );
    } catch (err: any) {
      console.error("Generator regeneration failed:", err);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col h-full">
      <div className="mb-4 pb-3 border-b border-border-base/50">
        <h2 className="text-sm font-bold text-accent-generator mb-1 flex items-center gap-2">
          <Settings2 size={16} /> Generator Node
        </h2>
        <p className="text-[11px] text-text-muted font-mono break-all">
          {node.id}
        </p>
      </div>

      {plugin ? (
        <div className="space-y-4 flex-1">
          <h3 className="text-xs font-semibold text-text-base bg-surface-panel p-2 rounded">
            {plugin.manifest.name}
          </h3>

          {plugin.manifest.properties?.map((prop, idx) => {
            const key = prop.name;
            if (!key) return null;
            return (
              <PluginPropertyEditor
                key={`prop-${idx}`}
                property={prop}
                value={genParams[key]}
                onChange={(val) =>
                  setGenParams((prev) => ({ ...prev, [key]: val }))
                }
                className="mb-4"
              />
            );
          })}

          {plugin.manifest.inputs?.map((inp, idx) => {
            const key = inp.name || inp.id;
            if (!key) return null;

            return (
              <PluginInputEditor
                key={`input-${idx}`}
                input={inp}
                interactionData={pluginInteractionData[key]}
                onUpdate={(data) => {
                  updatePluginInteractionData(key, data);
                }}
                mode="edit"
                decimalPrecision={decimalPrecision}
              />
            );
          })}

          {/* Internal Properties (Read-only Metadata) */}
          <div className="space-y-2 pt-3 border-t border-border-base/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Code2 size={13} className="text-accent-automation" />
                <span className="text-[11px] font-bold text-text-base">内部プロパティ (Internal Properties)</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border-base/30 font-mono">
                Read-only
              </span>
            </div>

            {node.plugin_data && Object.keys(node.plugin_data).length > 0 ? (
              <div className="space-y-1.5">
                <PluginDataViewer data={node.plugin_data} title="Waypoint Plugin Data" defaultExpanded={true} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    openPluginDataModal(
                      `ジェネレーター: ${plugin?.manifest.name || 'Waypoint Generator'}`,
                      node.plugin_data,
                      `ノードID: ${node.id} • 内部メタデータ (Read-only)`
                    )
                  }
                  className="w-full text-[10px] text-accent-automation hover:bg-accent-automation/10 gap-1 h-6"
                >
                  <Maximize2 size={11} />
                  <span>全画面ダイアログで開く</span>
                </Button>
              </div>
            ) : (
              <p className="text-[10px] text-text-muted/60 bg-surface-base/30 p-2 rounded-lg border border-border-base/20 italic">
                内部プロパティ（plugin_data）はありません。
              </p>
            )}
          </div>

          <div className="pt-4 mt-6 border-t border-border-base space-y-2">
            <Button
              variant="primary"
              disabled={isExecuting}
              onClick={handleRegenerate}
              className="w-full h-9 gap-2"
            >
              {isExecuting ? (
                <RefreshCcw size={14} className="animate-spin" />
              ) : (
                <Play size={14} className="fill-current" />
              )}
              {isExecuting ? "Re-Generating..." : "Re-Generate Path"}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const { DialogAPI } = await import("../../../api");
                const confirmed = await DialogAPI.ask(
                  "Are you sure you want to explode this generator? This will convert it into independent manual waypoints and cannot be undone.",
                  { title: "Explode Generator", kind: "warning" }
                );
                if (confirmed) {
                  explodeGenerator(node.id);
                }
              }}
              className="w-full h-9 gap-2"
              title="Explode into individual manual waypoints"
            >
              <BoxSelect size={14} />
              Explode to Waypoints
            </Button>
          </div>
        </div>
      ) : (
        <AlertBox variant="danger" title="Plugin Not Loaded">
          Plugin "{pluginId}" is no longer available or loaded. Cannot edit parameters.
        </AlertBox>
      )}
    </div>
  );
}
