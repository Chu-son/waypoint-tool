import { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { BackendAPI } from "../../api";
import { Play, Settings2, X, AlertCircle, RefreshCcw } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { PluginPropertyEditor } from "./PluginPropertyEditor";
import { PluginInputEditor } from "./PluginInputEditor";
import { Button } from "./common/Button";
import { cn } from "../../utils/cn";
import { Label } from "./common/Label";

export function PluginParamsPanel() {
  const activeTool = useAppStore((state) => state.activeTool);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const plugins = useAppStore((state) => state.plugins);
  const pluginSettings = useAppStore((state) => state.pluginSettings);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);
  const pluginInteractionData = useAppStore(
    (state) => state.pluginInteractionData,
  );
  const activeInputIndex = useAppStore((state) => state.activeInputIndex);
  const setActiveInputIndex = useAppStore((state) => state.setActiveInputIndex);

  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const updatePluginInteractionData = useAppStore(
    (state) => state.updatePluginInteractionData,
  );

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
    plugin.manifest.needs?.includes("selected_points" as any) || false;

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

      // ----------------------------------------------------------------------
      // Python Configuration Injection
      // ----------------------------------------------------------------------
      let pythonPathToUse = globalPythonPath?.trim() || "python3";
      if (plugin.manifest.type === "python") {
        const setting = pluginSettings.find((s) => s.id === plugin.id);
        if (
          setting &&
          setting.pythonOverridePath &&
          setting.pythonOverridePath.trim() !== ""
        ) {
          pythonPathToUse = setting.pythonOverridePath.trim();
        }
      }

      // Execute plugin through backend API (passing contextual Python path)
      const resultingWaypoints = await BackendAPI.runPlugin(
        plugin,
        contextData,
        pythonPathToUse,
      );

      if (Array.isArray(resultingWaypoints) && resultingWaypoints.length > 0) {
        // Create Parent Generator Node
        const parentId = uuidv4();
        useAppStore.getState().addNode({
          id: parentId,
          type: "generator",
          plugin_id: plugin.id,
          generator_params: contextData,
          children_ids: [],
        });

        // Build new child nodes
        resultingWaypoints.forEach((wp) => {
          let qx = wp.qx ?? 0,
            qy = wp.qy ?? 0,
            qz = wp.qz ?? 0,
            qw = wp.qw ?? 1;
          // If python returned Euler yaw and skipped quaternions, convert it
          if (typeof wp.yaw === "number" && typeof wp.qw !== "number") {
            const halfYaw = wp.yaw / 2.0;
            qz = Math.sin(halfYaw);
            qw = Math.cos(halfYaw);
          }

          const id = uuidv4();
          useAppStore.getState().addNode(
            {
              id,
              type: "manual",
              transform: wp.transform || {
                x: wp.x ?? 0,
                y: wp.y ?? 0,
                qx,
                qy,
                qz,
                qw,
              },
              options: wp.options || {},
            },
            parentId,
          ); // append to parent
        });

        // Auto select the newly generated parent node
        useAppStore.getState().selectNodes([parentId]);
        // Switch tool back to select, which triggers inspector to switch to Regenerate
        useAppStore.getState().setActiveTool("select");
      } else {
        setErrorInfo(
          "Plugin executed successfully but returned 0 waypoints. Check your settings.",
        );
      }
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => useAppStore.getState().setActiveTool("select")}
          className="h-7 w-7"
        >
          <X size={14} />
        </Button>
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
                const hasData = !!pluginInteractionData[key];
                const isActive = idx === activeInputIndex;
                return (
                  <Button
                    key={idx}
                    variant={isActive ? "primary" : hasData ? "secondary" : "ghost"}
                    onClick={() => setActiveInputIndex(idx)}
                    className={cn(
                      "flex-1 py-1 px-1 h-auto text-[10px]",
                      isActive && "bg-primary-base/20 border-primary-base text-primary-base",
                      hasData && !isActive && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                      !isActive && !hasData && "bg-surface-panel/50 border-border-base/50 text-text-muted hover:border-border-base"
                    )}
                    title={inp.label || key}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold",
                          isActive ? "bg-primary-base text-white" : hasData ? "bg-emerald-600 text-white" : "bg-surface-hover text-text-muted"
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className="truncate">
                        {inp.type === "rectangle"
                          ? "▭"
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
            const hasData = !!pluginInteractionData[key];
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
          <div className="mt-4 p-3 bg-primary-base/10 border border-primary-base/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle
                size={14}
                className="text-primary-base mt-0.5 shrink-0"
              />
              <div>
                <h4 className="text-xs font-bold text-primary-base">
                  Requires Waypoint Selection
                </h4>
                <p className="text-[10px] text-primary-base/70 mt-0.5">
                  You currently have{" "}
                  <strong className="text-primary-base">
                    {selectedNodeIds.length}
                  </strong>{" "}
                  points selected.
                </p>
              </div>
            </div>
          </div>
        )}

        {errorInfo && (
          <div className="mt-4 p-3 bg-red-950/20 border border-red-900/50 rounded-lg">
            <h4 className="text-xs font-bold text-red-500 mb-1">
              Execution Error
            </h4>
            <div className="text-[10px] font-mono text-red-400 whitespace-pre-wrap break-all overflow-auto max-h-32">
              {errorInfo}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-border-base/50">
        <Button
          disabled={
            isExecuting || (needsSelection && selectedNodeIds.length === 0)
          }
          onClick={handleExecute}
          className="h-9 w-full bg-primary-base hover:bg-primary-hover text-white"
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
