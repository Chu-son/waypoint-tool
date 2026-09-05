import { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { Play, Settings2, X, RefreshCcw } from "lucide-react";
import { PluginPropertyEditor } from "./PluginPropertyEditor";
import { PluginInputEditor } from "./PluginInputEditor";
import { Button } from "./common/Button";
import { cn } from "../../utils/cn";
import { Label } from "./common/Label";
import { AlertBox } from "./common/AlertBox";

export function PluginParamsPanel() {
  const activeTool = useAppStore((state) => state.activeTool);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const plugins = useAppStore((state) => state.plugins);
  const nodes = useAppStore((state) => state.nodes) || {};
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds) || [];
  const pluginInteractionData = useAppStore(
    (state) => state.pluginInteractionData,
  );
  const activeInputIndex = useAppStore((state) => state.activeInputIndex);
  const setActiveInputIndex = useAppStore((state) => state.setActiveInputIndex);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const updatePluginInteractionData = useAppStore(
    (state) => state.updatePluginInteractionData,
  );
  const runWithLoading = useAppStore((state) => state.runWithLoading);

  const [params, setParams] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const plugin = activePluginId ? plugins[activePluginId] : null;

  useEffect(() => {
    // Reset params when different plugin selected
    if (plugin) {
      const initialParams: Record<string, any> = {};
      const inputs = plugin.manifest.inputs || [];
      inputs.forEach((inp) => {
        const key = inp.name || inp.id;
        if (key) {
          initialParams[key] = inp.default ?? "";
        }
      });
      const properties = plugin.manifest.properties || [];
      properties.forEach((prop) => {
        const key = prop.name;
        if (key) {
          initialParams[key] = prop.default ?? "";
        }
      });
      setParams(initialParams);
      setErrorInfo(null);
    }
  }, [activePluginId, plugin]);

  // Sync all param values to the global store so MapCanvas can use them for interaction hints
  useEffect(() => {
    if (!plugin) return;
    useAppStore.getState().setPluginActiveProperties(params);
  }, [params, plugin]);

  // Auto-advance to next unset input when current input is completed
  useEffect(() => {
    if (!plugin || activeTool !== "add_generator") return;
    const inputs = plugin.manifest.inputs || [];
    if (inputs.length <= 1) return;

    const currentInput = inputs[activeInputIndex];
    const currentKey = currentInput?.name || currentInput?.id;
    if (!currentKey || !pluginInteractionData[currentKey]) return;

    // Do NOT auto-advance if current input is a points list (user adds multiple points interactively)
    if (currentInput.type === "points" || currentInput.type === "point_list") {
      return;
    }

    // Current input has data - find next unset input
    for (let i = activeInputIndex + 1; i < inputs.length; i++) {
      const inp = inputs[i];
      const k = inp.name || inp.id;
      if (k && !pluginInteractionData[k]) {
        setActiveInputIndex(i);
        return;
      }
    }
  }, [
    pluginInteractionData,
    activeInputIndex,
    plugin,
    activeTool,
    setActiveInputIndex,
  ]);

  if (activeTool !== "add_generator" || !plugin) {
    return null;
  }

  // Handle runtime undefined manifest issues gracefully
  const inputs = plugin.manifest.inputs || [];
  const properties = plugin.manifest.properties || [];
  const needsSelection =
    plugin.manifest.needs?.includes("selected_points") || false;

  const handleExecute = async () => {
    if (needsSelection && selectedNodeIds.length === 0) {
      setErrorInfo(
        "This plugin requires selecting waypoint(s) on the canvas first.",
      );
      return;
    }

    setIsExecuting(true);
    setErrorInfo(null);
    try {
      await runWithLoading(
        {
          message: "プラグインを実行中...",
          detail: plugin.manifest.name || plugin.id,
          blocking: true,
        },
        async () => {
          const contextData: any = {
            properties: params,
            interaction_data: {},
          };

          // Add interaction inputs (points & rectangles) to the parameter payload for python scripts
          inputs.forEach((inp) => {
            const key = inp.name || inp.id;
            if (key && pluginInteractionData[key]) {
              contextData.interaction_data[key] = pluginInteractionData[key];
            }
          });

          if (needsSelection) {
            contextData.selected_points = selectedNodeIds
              .map((id) => nodes[id]?.transform)
              .filter(Boolean);
          }

          if (plugin.manifest.needs?.includes('robot_footprint')) {
            contextData.robot_footprint = useAppStore.getState().robotFootprint;
          }

          // Collect waypoint range if waypoint inputs are used
          let idsToConsume: string[] = [];
          const waypointInputs = inputs.filter((inp) => inp.type === "waypoint");
          if (waypointInputs.length > 0) {
            const waypointIndices = waypointInputs
              .map((inp) => pluginInteractionData[inp.name || inp.id])
              .filter((idx) => idx !== undefined && idx !== null);

            if (waypointIndices.length > 0) {
              const rootNodeIds = useAppStore.getState().rootNodeIds;
              const minIdx = Math.min(...waypointIndices);
              const maxIdx = Math.max(...waypointIndices);
              idsToConsume = rootNodeIds.slice(minIdx, maxIdx + 1);
            }
          }

          const result = await useAppStore.getState().executeGeneratorPlugin({
            plugin,
            properties: params,
            interactionData: pluginInteractionData,
            placement: idsToConsume.length > 0
              ? { type: 'replace_ids', ids: idsToConsume }
              : { type: 'use_insertion_target' },
          });

          if (result.success) {
            if (result.parentWaypointId) {
              useAppStore.getState().selectNodes([result.parentWaypointId]);
            } else if (result.annotationGroupId) {
              useAppStore.getState().selectAnnotationObjects([result.annotationGroupId]);
            } else if (result.customLayerIds.length > 0) {
              useAppStore.getState().setActiveCustomLayerId(result.customLayerIds[0]);
            }
            useAppStore.getState().setActiveTool("select");
          }
        }
      );
    } catch (err: any) {
      console.error("Plugin execution failed:", err);
      setErrorInfo(err.toString());
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col h-full bg-surface-base border-l border-border-base">
      <div className="flex justify-between items-start mb-4 border-b border-border-base/50 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-primary-base" />
            <h2 className="text-sm font-bold text-text-base leading-none">
              {plugin.manifest.name}
            </h2>
          </div>
          <p className="text-[11px] text-text-muted mt-1 leading-tight">
            {plugin.manifest.description || "No description provided"}
          </p>
        </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Reload Plugin"
              onClick={async () => {
                try {
                  const reloadPlugins = useAppStore.getState().reloadPlugins;
                  await reloadPlugins();
                } catch (err) {
                  alert(`プラグインのリロードに失敗しました: ${String(err)}`);
                }
              }}
              className="h-7 w-7 text-text-muted hover:text-primary-base"
            >
              <RefreshCcw size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const store = useAppStore.getState();
                store.setActiveTool("select");
                store.setActivePlugin(null);
                store.clearPluginInteractionData();
              }}
              className="h-7 w-7"
            >
              <X size={14} />
            </Button>
          </div>
      </div>

      <div className="space-y-4 flex-1">
        {/* Step indicator for multi-input plugins */}
        {inputs.length > 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Input Steps
              </Label>
              <span className="text-[10px] text-text-muted">
                {activeInputIndex + 1} / {inputs.length}
              </span>
            </div>
            <div className="flex gap-1">
              {inputs.map((inp, idx) => {
                const key = inp.name || inp.id || "";
                const rawVal = pluginInteractionData[key];
                const hasData = Array.isArray(rawVal) ? rawVal.length > 0 : !!rawVal;
                const isActive = idx === activeInputIndex;
                return (
                  <Button
                    key={idx}
                    variant={isActive ? "primary" : hasData ? "secondary" : "ghost"}
                    onClick={() => setActiveInputIndex(idx)}
                    className={cn(
                      "flex-1 py-1 px-1 h-auto text-[10px]",
                      isActive && "bg-primary-base/20 border-primary-base text-primary-base",
                      hasData && !isActive && "bg-status-success/10 border-status-success/30 text-status-success",
                      !isActive && !hasData && "bg-surface-panel/50 border-border-base/50 text-text-muted hover:border-border-base"
                    )}
                    title={inp.label || key}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold",
                          isActive ? "bg-primary-base text-text-inverse" : hasData ? "bg-status-success text-text-inverse" : "bg-surface-hover text-text-muted"
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className="truncate">
                        {inp.type === "rectangle"
                          ? "▭"
                          : inp.type === "points" || inp.type === "point_list"
                            ? "⁝"
                            : inp.type === "point"
                              ? "◉"
                              : "●"}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Interaction Inputs */}
        {inputs.length > 0 &&
          inputs.map((inp, idx) => {
            const key = inp.name || inp.id;
            if (!key) return null;
            const isActiveStep = idx === activeInputIndex;
            const rawVal = pluginInteractionData[key];
            const hasData = Array.isArray(rawVal) ? rawVal.length > 0 : !!rawVal;
            return (
              <PluginInputEditor
                key={`input-${idx}`}
                input={inp}
                interactionData={pluginInteractionData[key]}
                onUpdate={(data) => updatePluginInteractionData(key, data)}
                mode="creation"
                index={idx}
                totalSteps={inputs.length}
                isActive={isActiveStep}
                hasData={hasData}
                decimalPrecision={decimalPrecision}
              />
            );
          })}

        {/* Properties */}
        {properties.length > 0 &&
          properties.map((prop, idx) => {
            const key = prop.name;
            if (!key) return null;
            return (
              <div
                key={`prop-container-${idx}`}
                className="mt-3 pt-3 border-t border-border-base/50"
              >
                <PluginPropertyEditor
                  property={prop}
                  value={params[key]}
                  onChange={(val) =>
                    setParams((prev) => ({ ...prev, [key]: val }))
                  }
                />
              </div>
            );
          })}

        {needsSelection && (
          <AlertBox title="Requires Waypoint Selection" className="mt-4">
            You currently have{" "}
            <strong className="text-primary-base">
              {selectedNodeIds.length}
            </strong>{" "}
            points selected.
          </AlertBox>
        )}

        {errorInfo && (
          <AlertBox title="Execution Error" variant="danger" className="mt-4">
            <div className="font-mono whitespace-pre-wrap break-all overflow-auto max-h-32">
              {errorInfo}
            </div>
          </AlertBox>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-border-base/50">
        <Button
          disabled={
            isExecuting || (needsSelection && selectedNodeIds.length === 0)
          }
          onClick={handleExecute}
          variant="primary"
          className="h-9 w-full"
        >
          {isExecuting ? (
            <RefreshCcw size={14} className="animate-spin mr-2" />
          ) : (
            <Play
              size={14}
              className={cn(
                "mr-2",
                !(needsSelection && selectedNodeIds.length === 0) && "fill-current"
              )}
            />
          )}
          {isExecuting ? "Executing..." : "Generate Path"}
        </Button>
      </div>
    </div>
  );
}
