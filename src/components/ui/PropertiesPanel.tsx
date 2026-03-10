import { useAppStore } from "../../stores/appStore";
import { OptionDef } from "../../types/store";
import { Eye, EyeOff, Play, Settings2, RefreshCcw, BoxSelect } from "lucide-react";
import { useState, useEffect } from "react";
import { BackendAPI } from "../../api";
import { v4 as uuidv4 } from "uuid";
import { NumericInput } from "./NumericInput";
import { PluginPropertyEditor } from "./PluginPropertyEditor";
import { PluginInputEditor } from "./PluginInputEditor";
import { Button } from "./common/Button";
import { Input } from "./common/Input";
import { Select } from "./common/Select";
import { Checkbox } from "./common/Checkbox";
import { Label } from "./common/Label";
import { cn } from "../../utils/cn";

export function PropertiesPanel() {
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const optionsSchema = useAppStore((state) => state.optionsSchema);
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const updateNode = useAppStore((state) => state.updateNode);
  const removeNodes = useAppStore((state) => state.removeNodes);
  const visibleAttributes = useAppStore((state) => state.visibleAttributes);
  const toggleAttributeVisibility = useAppStore(
    (state) => state.toggleAttributeVisibility,
  );
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);

  const plugins = useAppStore((state) => state.plugins);
  const pluginSettings = useAppStore((state) => state.pluginSettings);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);
  const explodeGenerator = useAppStore((state) => state.explodeGenerator);

  const [genParams, setGenParams] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const updatePluginInteractionData = useAppStore(
    (state) => state.updatePluginInteractionData,
  );
  const pluginInteractionData = useAppStore(
    (state) => state.pluginInteractionData,
  );

  const isMultiSelection = selectedNodeIds.length > 1;
  const node = isMultiSelection ? null : nodes[selectedNodeIds[0]];

  useEffect(() => {
    if (!isMultiSelection && node?.type === "generator") {
      if (node.generator_params?.properties)
        setGenParams({ ...node.generator_params.properties });
      if (node.generator_params?.interaction_data) {
        // Sync to global store so MapCanvas shows the preview
        Object.entries(node.generator_params.interaction_data).forEach(
          ([key, val]) => {
            updatePluginInteractionData(key, val);
          },
        );
      }
    } else {
      // Clear global preview when not editing a generator
      useAppStore.getState().clearPluginInteractionData();
    }
  }, [node?.id, isMultiSelection]);

  // Sync current property values to the global store so MapCanvas can use them for interaction hints
  useEffect(() => {
    if (!isMultiSelection && node?.type === "generator") {
      useAppStore.getState().setPluginActiveProperties(genParams);
    }
  }, [genParams, node?.id, isMultiSelection]);

  if (selectedNodeIds.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4">
        <div className="text-sm text-text-muted italic mb-4">
          No item selected.
        </div>
      </div>
    );
  }

  const handleUpdate = (id: string, updates: any) => {
    updateNode(id, updates);
  };

  if (!isMultiSelection && !node) return null;

  const nodeIndex = node ? rootNodeIds.indexOf(node.id) : -1;

  // --------------------------------------------------------------------------
  // GENERATOR NODE UI
  // --------------------------------------------------------------------------
  if (!isMultiSelection && node?.type === "generator") {
    const pluginId = node.plugin_id || "";
    const plugin = plugins[pluginId];

    const handleRegenerate = async () => {
      if (!plugin) return;
      setIsExecuting(true);
      try {
        const filteredInteractionData: Record<string, any> = {};
        plugin.manifest.inputs?.forEach((inp) => {
          const key = inp.name || inp.id;
          if (key && pluginInteractionData[key]) {
            filteredInteractionData[key] = pluginInteractionData[key];
          }
        });

        const contextData = {
          ...node.generator_params,
          properties: genParams,
          interaction_data: filteredInteractionData,
        };

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

        const resultingWaypoints = await BackendAPI.runPlugin(
          plugin,
          contextData,
          pythonPathToUse,
        );

        if (
          Array.isArray(resultingWaypoints) &&
          resultingWaypoints.length > 0
        ) {
          // Remove old children
          if (node.children_ids && node.children_ids.length > 0) {
            removeNodes(node.children_ids);
          }

          // Add new children
          const newChildIds: string[] = [];
          resultingWaypoints.forEach((wp) => {
            let qx = wp.qx ?? 0,
              qy = wp.qy ?? 0,
              qz = wp.qz ?? 0,
              qw = wp.qw ?? 1;
            if (typeof wp.yaw === "number" && typeof wp.qw !== "number") {
              const halfYaw = wp.yaw / 2.0;
              qz = Math.sin(halfYaw);
              qw = Math.cos(halfYaw);
            }
            const id = uuidv4();
            newChildIds.push(id);
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
              node.id,
            );
          });

          // Update generator params on the node
          handleUpdate(node.id, { generator_params: contextData });
        } else {
          alert("Plugin executed but returned 0 waypoints.");
        }
      } catch (err: any) {
        console.error("Re-generation failed:", err);
        alert(`Failed to re-generate:\n${err.toString()}`);
      } finally {
        setIsExecuting(false);
      }
    };

    return (
      <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col h-full">
        <div className="mb-4 pb-3 border-b border-border-base/50">
          <h2 className="text-sm font-bold text-emerald-400 mb-1 flex items-center gap-2">
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

            {/* Properties */}
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

            {/* Interaction Inputs */}
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

            <div className="pt-4 mt-6 border-t border-border-base">
              <Button
                disabled={isExecuting}
                onClick={handleRegenerate}
                className="w-full h-9 gap-2 shadow transition-colors bg-emerald-600 hover:bg-emerald-500"
              >
                {isExecuting ? (
                  <RefreshCcw size={14} className="animate-spin" />
                ) : (
                  <Play size={14} className="fill-current" />
                )}
                {isExecuting ? "Re-Generating..." : "Re-Generate Path"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to explode this generator? This will convert it into independent manual waypoints and cannot be undone."
                    )
                  ) {
                    explodeGenerator(node.id);
                  }
                }}
                className="w-full h-9 gap-2 mt-2 border-red-900/50 hover:bg-red-950/30 text-red-400 hover:text-red-300 transition-colors"
                title="Explode into individual manual waypoints"
              >
                <BoxSelect size={14} />
                Explode to Waypoints
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-red-400 italic bg-red-950/20 p-3 rounded border border-red-900/50">
            Plugin "{pluginId}" is no longer available or loaded. Cannot edit
            parameters.
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MANUAL NODE UI (Original)
  // --------------------------------------------------------------------------
  return (
    <div className="flex-1 overflow-y-auto w-full p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-text-base mb-1">
          {isMultiSelection
            ? `Multiple Selected (${selectedNodeIds.length})`
            : `Waypoint [${nodeIndex >= 0 ? nodeIndex + indexStartIndex : "?"}]`}
        </h2>
        {!isMultiSelection && (
          <p className="text-xs text-text-muted font-mono break-all">
            {node?.id}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {/* Index Group */}
        <div className="space-y-2 relative">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Index
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-text-muted hover:text-text-base"
              onClick={() => toggleAttributeVisibility("index")}
              title="Toggle Index on Canvas"
            >
              {visibleAttributes.includes("index") ? (
                <Eye size={14} />
              ) : (
                <EyeOff size={14} />
              )}
            </Button>
          </div>
          <div className="bg-surface-panel border border-border-base rounded px-2 py-1 text-sm text-text-base font-mono">
            {isMultiSelection
              ? "Mixed Selection"
              : nodeIndex >= 0
                ? String(nodeIndex + indexStartIndex)
                : "-"}
          </div>
        </div>

        {/* Transform Group */}
        <div className="space-y-2 relative pt-2">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Transform (World)
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-text-muted hover:text-text-base"
              onClick={() => toggleAttributeVisibility("transform")}
              title="Toggle Transform on Canvas"
            >
              {visibleAttributes.includes("transform") ? (
                <Eye size={14} />
              ) : (
                <EyeOff size={14} />
              )}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="block text-xs text-text-muted mb-1">X (m)</Label>
              <NumericInput
                value={isMultiSelection ? 0 : (node?.transform?.x ?? 0)}
                precision={decimalPrecision}
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={(val) => {
                  if (isMultiSelection) {
                    selectedNodeIds.forEach((id) => {
                      const n = nodes[id];
                      if (n && n.transform)
                        handleUpdate(id, {
                          transform: { ...n.transform, x: val },
                        });
                    });
                  } else {
                    handleUpdate(node!.id, {
                      transform: { ...node!.transform!, x: val },
                    });
                  }
                }}
              />
            </div>
            <div>
              <Label className="block text-xs text-text-muted mb-1">Y (m)</Label>
              <NumericInput
                value={isMultiSelection ? 0 : (node?.transform?.y ?? 0)}
                precision={decimalPrecision}
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={(val) => {
                  if (isMultiSelection) {
                    selectedNodeIds.forEach((id) => {
                      const n = nodes[id];
                      if (n && n.transform)
                        handleUpdate(id, {
                          transform: { ...n.transform, y: val },
                        });
                    });
                  } else {
                    handleUpdate(node!.id, {
                      transform: { ...node!.transform!, y: val },
                    });
                  }
                }}
              />
            </div>
            <div>
              <Label className="block text-xs text-text-muted mb-1">Z (m)</Label>
              <NumericInput
                value={isMultiSelection ? 0 : (node?.transform?.z ?? 0)}
                precision={decimalPrecision}
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={(val) => {
                  if (isMultiSelection) {
                    selectedNodeIds.forEach((id) => {
                      const n = nodes[id];
                      if (n && n.transform)
                        handleUpdate(id, {
                          transform: { ...n.transform, z: val },
                        });
                    });
                  } else {
                    handleUpdate(node!.id, {
                      transform: { ...node!.transform!, z: val },
                    });
                  }
                }}
              />
            </div>
            <div className="col-span-3">
              <Label className="block text-xs text-text-muted mb-1">
                Yaw (rad)
              </Label>
              <NumericInput
                step="0.01"
                precision={decimalPrecision}
                value={
                  isMultiSelection
                    ? 0
                    : node?.transform
                      ? Math.atan2(
                          2.0 *
                            ((node.transform.qw ?? 1) *
                              (node.transform.qz || 0) +
                              (node.transform.qx || 0) *
                                (node.transform.qy || 0)),
                          1.0 -
                            2.0 *
                              ((node.transform.qy || 0) *
                                (node.transform.qy || 0) +
                                (node.transform.qz || 0) *
                                  (node.transform.qz || 0)),
                        )
                      : 0
                }
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={(val) => {
                  const halfYaw = val / 2.0;
                  const qz = Math.sin(halfYaw);
                  const qw = Math.cos(halfYaw);
 
                  if (isMultiSelection) {
                    selectedNodeIds.forEach((id) => {
                      const n = nodes[id];
                      if (n && n.transform)
                        handleUpdate(id, {
                          transform: { ...n.transform, qx: 0, qy: 0, qz, qw },
                        });
                    });
                  } else {
                    handleUpdate(node!.id, {
                      transform: { ...node!.transform!, qx: 0, qy: 0, qz, qw },
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Custom Options Group */}
        <div className="space-y-2 pt-4 border-t border-border-base">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex justify-between items-center">
            Custom Options
          </h3>

          {!optionsSchema ? (
            <div className="text-xs text-text-muted italic p-2 bg-surface-panel rounded border border-border-base">
              No schema loaded. Load a schema (YAML) from the Toolbar.
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {optionsSchema.options.map((opt: OptionDef) => {
                const nodeOptVal = isMultiSelection
                  ? ""
                  : (node?.options?.[opt.name] ?? opt.default ?? "");

                const handleChange = (
                  val:
                    | string
                    | number
                    | boolean
                    | Array<string | number | boolean>,
                ) => {
                  const currentState = useAppStore.getState();
                  if (isMultiSelection) {
                    selectedNodeIds.forEach((id) => {
                      const n = currentState.nodes[id];
                      if (n) {
                        handleUpdate(id, {
                          options: { ...(n.options || {}), [opt.name]: val },
                        });
                      }
                    });
                  } else {
                    const n = currentState.nodes[node!.id];
                    handleUpdate(node!.id, {
                      options: { ...(n.options || {}), [opt.name]: val },
                    });
                  }
                };

                return (
                  <div key={opt.name}>
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs text-text-muted">
                        {opt.label || opt.name}{" "}
                        <span className="opacity-50 text-[10px] ml-1 uppercase">
                          ({opt.type})
                        </span>
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-text-muted hover:text-text-base"
                        onClick={() =>
                          toggleAttributeVisibility(`options.${opt.name}`)
                        }
                        title={`Toggle ${opt.name} on Canvas`}
                      >
                        {visibleAttributes.includes(`options.${opt.name}`) ? (
                          <Eye size={12} />
                        ) : (
                          <EyeOff size={12} />
                        )}
                      </Button>
                    </div>

                    {opt.type === "list" ? (
                      <Input
                        type="text"
                        value={
                          Array.isArray(nodeOptVal)
                            ? nodeOptVal.join(", ")
                            : String(nodeOptVal || "")
                        }
                        placeholder={
                          isMultiSelection
                            ? "Mixed"
                            : opt.default !== undefined
                              ? Array.isArray(opt.default)
                                ? opt.default.join(", ")
                                : String(opt.default)
                              : "csv"
                        }
                        onChange={(e) => {
                          const rawArr = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0);
                          let parsedArr: any[] = rawArr;
                          if (opt.item_type === "float") {
                            parsedArr = rawArr
                              .map((s) => parseFloat(s))
                              .filter((n) => !isNaN(n));
                          } else if (opt.item_type === "integer") {
                            parsedArr = rawArr
                              .map((s) => parseInt(s, 10))
                              .filter((n) => !isNaN(n));
                          } else if (opt.item_type === "boolean") {
                            parsedArr = rawArr.map(
                              (s) => s === "true" || s === "1",
                            );
                          }
                          handleChange(parsedArr);
                        }}
                      />
                    ) : opt.type === "string" &&
                      opt.enum_values &&
                      opt.enum_values.length > 0 ? (
                      <Select
                        value={String(nodeOptVal)}
                        onChange={(e) => handleChange(e.target.value)}
                      >
                        {isMultiSelection && (
                          <option value="" disabled hidden>
                            Mixed
                          </option>
                        )}
                        {opt.enum_values.map((v: string) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    ) : opt.type === "integer" || opt.type === "float" ? (
                      <Input
                        type="number"
                        step={opt.type === "float" ? "0.1" : "1"}
                        value={String(nodeOptVal)}
                        placeholder={
                          isMultiSelection ? "Mixed" : String(opt.default || "")
                        }
                        onChange={(e) => {
                          const val =
                            opt.type === "float"
                              ? parseFloat(e.target.value)
                              : parseInt(e.target.value, 10);
                          if (!isNaN(val)) handleChange(val);
                        }}
                      />
                    ) : opt.type === "boolean" ? (
                      <Checkbox
                        checked={Boolean(nodeOptVal)}
                        onChange={(e) => handleChange(e.target.checked)}
                      />
                    ) : (
                      <Input
                        type="text"
                        value={String(nodeOptVal)}
                        placeholder={
                          isMultiSelection ? "Mixed" : String(opt.default || "")
                        }
                        onChange={(e) => handleChange(e.target.value)}
                        className={cn(
                          String(nodeOptVal).trim() === "" && !isMultiSelection && "border-amber-500/50"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
