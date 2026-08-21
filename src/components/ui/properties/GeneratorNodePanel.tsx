import { useState, useEffect } from "react";
import { useAppStore } from "../../../stores/appStore";
import { BackendAPI } from "../../../api";
import { Button } from "../common/Button";
import { AlertBox } from "../common/AlertBox";
import { PluginPropertyEditor } from "../PluginPropertyEditor";
import { PluginInputEditor } from "../PluginInputEditor";
import { Play, Settings2, RefreshCcw, BoxSelect } from "lucide-react";
import { WaypointNode } from "../../../types/store";
import { v4 as uuidv4 } from "uuid";

interface GeneratorNodePanelProps {
  node: WaypointNode;
  handleUpdate: (id: string, updates: any) => void;
}

export function GeneratorNodePanel({
  node,
  handleUpdate,
}: GeneratorNodePanelProps) {
  const plugins = useAppStore((state) => state.plugins);
  const pluginSettings = useAppStore((state) => state.pluginSettings);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);
  const explodeGenerator = useAppStore((state) => state.explodeGenerator);
  const removeNodes = useAppStore((state) => state.removeNodes);
  const updatePluginInteractionData = useAppStore(
    (state) => state.updatePluginInteractionData,
  );
  const pluginInteractionData = useAppStore(
    (state) => state.pluginInteractionData,
  );
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const mapLayers = useAppStore((state) => state.mapLayers);

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
      const filteredInteractionData: Record<string, any> = {};
      plugin.manifest.inputs?.forEach((inp) => {
        const key = inp.name || inp.id;
        if (key && pluginInteractionData[key]) {
          filteredInteractionData[key] = pluginInteractionData[key];
        }
      });

      const contextData: Record<string, any> = {
        ...node.generator_params,
        properties: genParams,
        interaction_data: filteredInteractionData,
      };

      if (plugin.manifest.needs?.includes('robot_footprint')) {
        contextData.robot_footprint = useAppStore.getState().robotFootprint;
      }

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

      const needsOccupancyGrid = plugin.manifest.needs?.some(
        (n) => n === 'occupancy_grid' || n === 'occupancy_grid_in_region'
      );

      const resultingWaypoints = await BackendAPI.runPlugin(
        plugin,
        contextData,
        pythonPathToUse,
        needsOccupancyGrid ? mapLayers : undefined,
      );

      if (
        Array.isArray(resultingWaypoints) &&
        resultingWaypoints.length > 0
      ) {
        useAppStore.getState().runInHistoryTransaction(() => {
          if (node.children_ids && node.children_ids.length > 0) {
            removeNodes(node.children_ids);
          }

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

          handleUpdate(node.id, { generator_params: contextData });
        });
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
