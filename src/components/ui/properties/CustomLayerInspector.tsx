import { useState, useEffect } from "react";
import { useAppStore } from "../../../stores/appStore";
import { BackendAPI, DialogAPI } from "../../../api";
import { PluginCustomLayer, PluginInstance } from "../../../types/store";
import { Button } from "../common/Button";
import { Label } from "../common/Label";
import { Select } from "../common/Select";
import { Input } from "../common/Input";
import { Slider } from "../common/Slider";
import { Checkbox } from "../common/Checkbox";
import { AlertBox } from "../common/AlertBox";
import { FieldLabel } from "../common/FieldLabel";
import { PluginPropertyEditor } from "../PluginPropertyEditor";
import { PluginInputEditor } from "../PluginInputEditor";
import { Play, RefreshCcw, Sparkles, X, Trash2, Pencil, Square, Circle, Bookmark } from "lucide-react";
import { cn } from "../../../utils/cn";
import { v4 as uuidv4 } from "uuid";
import { prepareLayersForExport } from "../../../utils/mapRasterize";

export function CustomLayerInspector() {
  const customLayers = useAppStore((state) => state.customLayers) || [];
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const setActiveCustomLayerId = useAppStore((state) => state.setActiveCustomLayerId);
  const addPluginCustomLayer = useAppStore((state) => state.addPluginCustomLayer);
  const updateCustomLayer = useAppStore((state) => state.updateCustomLayer);
  const removeCustomLayer = useAppStore((state) => state.removeCustomLayer);
  const removeEditObject = useAppStore((state) => state.removeEditObject);

  const plugins = useAppStore((state) => state.plugins) || {};
  const pluginSettings = useAppStore((state) => state.pluginSettings) || [];
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);
  const mapLayers = useAppStore((state) => state.mapLayers) || [];
  const pluginInteractionData = useAppStore((state) => state.pluginInteractionData) || {};
  const updatePluginInteractionData = useAppStore((state) => state.updatePluginInteractionData);
  const clearPluginInteractionData = useAppStore((state) => state.clearPluginInteractionData);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setActivePlugin = useAppStore((state) => state.setActivePlugin);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const setPluginActiveProperties = useAppStore((state) => state.setPluginActiveProperties);

  // Map Edit States
  const isMapEditMode = useAppStore((state) => state.isMapEditMode);
  const setMapEditMode = useAppStore((state) => state.setMapEditMode);
  const mapEditSubTool = useAppStore((state) => state.mapEditSubTool);
  const setMapEditSubTool = useAppStore((state) => state.setMapEditSubTool);
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const setMapEditFillValue = useAppStore((state) => state.setMapEditFillValue);
  const mapEditBrushSize = useAppStore((state) => state.mapEditBrushSize);
  const setMapEditBrushSize = useAppStore((state) => state.setMapEditBrushSize);
  const selectedEditObjectId = useAppStore((state) => state.selectedEditObjectId);
  const setSelectedEditObjectId = useAppStore((state) => state.setSelectedEditObjectId);

  const existingLayer = customLayers.find((l) => l.id === activeCustomLayerId);
  const isNewPluginLayer = !existingLayer || activeCustomLayerId === "new";

  const layerPlugins = Object.values(plugins).filter(
    (p) => p && p.manifest && p.manifest.category === "map_layer_generator"
  );

  const [selectedPluginId, setSelectedPluginId] = useState<string>(() => {
    if (existingLayer && existingLayer.type === "plugin") return existingLayer.plugin_id;
    if (activePluginId && plugins[activePluginId]?.manifest.category === "map_layer_generator") {
      return activePluginId;
    }
    return layerPlugins[0]?.id || "";
  });

  const [params, setParams] = useState<Record<string, any>>({});
  const [layerName, setLayerName] = useState<string>("");
  const [layerOpacity, setLayerOpacity] = useState<number>(1.0);
  const [blendMode, setBlendMode] = useState<"overwrite" | "merge_obstacles" | "merge_free">("overwrite");
  const [isReference, setIsReference] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const activePlugin: PluginInstance | undefined = plugins[selectedPluginId];

  // Initialize state on active layer change
  useEffect(() => {
    if (existingLayer) {
      setLayerName(existingLayer.name);
      setLayerOpacity(existingLayer.opacity ?? 1.0);
      setBlendMode(existingLayer.blend_mode || "overwrite");
      setIsReference(!!existingLayer.is_reference);

      if (existingLayer.type === "plugin") {
        setSelectedPluginId(existingLayer.plugin_id);
        setActivePlugin(existingLayer.plugin_id);
        setActiveTool("add_generator");
        setParams({ ...existingLayer.params });

        clearPluginInteractionData();
        if (existingLayer.interaction_data) {
          Object.entries(existingLayer.interaction_data).forEach(([key, val]) => {
            updatePluginInteractionData(key, val);
          });
        }
      } else {
        // Manual layer
        setActiveTool("select");
      }
    } else {
      // New plugin layer creation
      const pluginIdToUse = (activePluginId && plugins[activePluginId]?.manifest.category === "map_layer_generator")
        ? activePluginId
        : (layerPlugins[0]?.id || "");

      setSelectedPluginId(pluginIdToUse);
      setActivePlugin(pluginIdToUse);
      setActiveTool("add_generator");
      setLayerName(plugins[pluginIdToUse]?.manifest.name || "Generated Layer");
      setLayerOpacity(0.7);
      setBlendMode("overwrite");
      setIsReference(false);

      if (pluginIdToUse && plugins[pluginIdToUse]) {
        const initialParams: Record<string, any> = {};
        plugins[pluginIdToUse].manifest.properties?.forEach((prop) => {
          if (prop.name) initialParams[prop.name] = prop.default ?? "";
        });
        setParams(initialParams);
      } else {
        setParams({});
      }
      clearPluginInteractionData();
    }
    setErrorInfo(null);
  }, [activeCustomLayerId]);

  // Sync active properties to store for canvas interaction hints
  useEffect(() => {
    if (activePlugin && setPluginActiveProperties && (isNewPluginLayer || existingLayer?.type === "plugin")) {
      setPluginActiveProperties(params);
    }
  }, [params, activePlugin, setPluginActiveProperties, isNewPluginLayer, existingLayer?.type]);

  const handlePluginChange = (pluginId: string) => {
    setSelectedPluginId(pluginId);
    setActivePlugin(pluginId);
    const p = plugins[pluginId];
    if (p) {
      const initialParams: Record<string, any> = {};
      p.manifest.properties?.forEach((prop) => {
        if (prop.name) initialParams[prop.name] = prop.default ?? "";
      });
      setParams(initialParams);
      if (isNewPluginLayer) {
        setLayerName(p.manifest.name);
      }
    }
    clearPluginInteractionData();
    setErrorInfo(null);
  };

  const handleExecutePlugin = async () => {
    if (!activePlugin) return;

    setIsExecuting(true);
    setErrorInfo(null);

    try {
      let pythonPathToUse = globalPythonPath?.trim() || "python3";
      if (activePlugin.manifest.type === "python") {
        const setting = pluginSettings.find((s) => s.id === activePlugin.id);
        if (setting && setting.pythonOverridePath && setting.pythonOverridePath.trim() !== "") {
          pythonPathToUse = setting.pythonOverridePath.trim();
        }
      }

      const filteredInteractionData: Record<string, any> = {};
      activePlugin.manifest.inputs?.forEach((inp) => {
        const key = inp.name || inp.id;
        if (key && pluginInteractionData[key]) {
          filteredInteractionData[key] = pluginInteractionData[key];
        }
      });

      const robotFootprint = useAppStore.getState().robotFootprint;

      const contextData: any = {
        properties: params,
        interaction_data: filteredInteractionData,
      };

      if (activePlugin.manifest.needs?.includes("robot_footprint") || robotFootprint) {
        contextData.robot_footprint = robotFootprint;
      }

      // 自分自身の再生成の場合は、古い結果が混ざらないように customLayers から自分自身を除外してマージ
      const otherCustomLayers = existingLayer
        ? customLayers.filter((l) => l.id !== existingLayer.id)
        : customLayers;

      const layersToPass = await prepareLayersForExport(mapLayers, otherCustomLayers);

      const result = await BackendAPI.runPlugin(
        activePlugin,
        contextData,
        pythonPathToUse,
        layersToPass
      );

      if (!result || !result.image_base64 || !result.info) {
        throw new Error(
          "Plugin returned invalid layer output. Expected { image_base64, info }."
        );
      }

      if (existingLayer && existingLayer.type === "plugin") {
        updateCustomLayer(existingLayer.id, {
          name: layerName || result.name || existingLayer.name,
          params,
          interaction_data: filteredInteractionData,
          image_base64: result.image_base64,
          info: result.info,
          opacity: layerOpacity,
          blend_mode: blendMode || result.blend_mode || "overwrite",
          is_reference: isReference,
        });
      } else {
        const newId = uuidv4();
        const newLayer: PluginCustomLayer = {
          id: newId,
          name: layerName || result.name || activePlugin.manifest.name || "Generated Layer",
          type: "plugin",
          plugin_id: activePlugin.id,
          params,
          interaction_data: filteredInteractionData,
          image_base64: result.image_base64,
          info: result.info,
          visible: true,
          opacity: layerOpacity,
          z_index: customLayers.length,
          blend_mode: blendMode || result.blend_mode || "overwrite",
          is_reference: isReference,
        };
        addPluginCustomLayer(newLayer);
        setActiveCustomLayerId(newId);
      }
    } catch (err: any) {
      console.error("Layer generation failed:", err);
      setErrorInfo(String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClose = () => {
    setActiveCustomLayerId(null);
    setMapEditMode(false);
    setActiveTool("select");
    clearPluginInteractionData();
  };

  const handleDelete = async () => {
    if (!existingLayer) return;
    const confirmed = await DialogAPI.ask(
      `カスタムレイヤー「${existingLayer.name}」を削除してもよろしいですか？`,
      { title: "レイヤーの削除", kind: "warning" }
    );
    if (confirmed) {
      removeCustomLayer(existingLayer.id);
      handleClose();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full flex flex-col bg-surface-panel/30 divide-y divide-border-base/30">
      {/* Header */}
      <div className="p-4 bg-surface-panel/50 flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              isNewPluginLayer || existingLayer?.type === "plugin"
                ? "bg-cyan-500/10 text-cyan-400"
                : "bg-primary-base/10 text-primary-base"
            )}>
              {isNewPluginLayer || existingLayer?.type === "plugin" ? <Sparkles size={16} /> : <Pencil size={16} />}
            </div>
            <div>
              <span className="text-xs font-bold text-text-base">
                {isNewPluginLayer
                  ? "Generate Plugin Layer"
                  : existingLayer?.type === "manual"
                  ? "Manual Custom Layer"
                  : "Plugin Custom Layer"}
              </span>
              <p className="text-[10px] text-text-muted">
                {isNewPluginLayer
                  ? "Configure and generate an overlay layer"
                  : existingLayer?.type === "manual"
                  ? "Vector draw tools and layer settings"
                  : activePlugin?.manifest.name}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="h-7 w-7 text-text-muted hover:text-text-base"
          title="Close Inspector"
        >
          <X size={14} />
        </Button>
      </div>

      {/* Main Settings */}
      <div className="p-4 space-y-4">
        {/* Layer Name */}
        {!isNewPluginLayer && existingLayer && (
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-text-muted">Layer Name</Label>
            <Input
              value={layerName}
              onChange={(e) => {
                setLayerName(e.target.value);
                updateCustomLayer(existingLayer.id, { name: e.target.value });
              }}
              className="h-8 text-xs bg-surface-base"
              placeholder="Layer Name"
            />
          </div>
        )}

        {/* --- SECTION A: Manual Vector Layer Tools --- */}
        {existingLayer && existingLayer.type === "manual" && (
          <div className="space-y-4">
            {/* Draw Mode Banner / Toggle */}
            <div className="space-y-2">
              <FieldLabel className="text-[10px]">Vector Drawing Tools</FieldLabel>
              <div className="grid grid-cols-3 gap-1.5 bg-surface-base/60 p-1 rounded-xl border border-border-base/40">
                <button
                  type="button"
                  onClick={() => {
                    setMapEditSubTool("rect");
                    setMapEditMode(true);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-semibold gap-1 transition-all",
                    isMapEditMode && mapEditSubTool === "rect"
                      ? "bg-primary-base text-white shadow-sm"
                      : "text-text-muted hover:text-text-base hover:bg-surface-hover/50"
                  )}
                >
                  <Square size={14} />
                  <span>Rectangle</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMapEditSubTool("circle");
                    setMapEditMode(true);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-semibold gap-1 transition-all",
                    isMapEditMode && mapEditSubTool === "circle"
                      ? "bg-primary-base text-white shadow-sm"
                      : "text-text-muted hover:text-text-base hover:bg-surface-hover/50"
                  )}
                >
                  <Circle size={14} />
                  <span>Circle</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMapEditSubTool("freehand");
                    setMapEditMode(true);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-semibold gap-1 transition-all",
                    isMapEditMode && mapEditSubTool === "freehand"
                      ? "bg-primary-base text-white shadow-sm"
                      : "text-text-muted hover:text-text-base hover:bg-surface-hover/50"
                  )}
                >
                  <Pencil size={14} />
                  <span>Brush</span>
                </button>
              </div>
            </div>

            {/* Fill Mode: Obstacle vs Free Space */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-text-muted">Paint Fill Type</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMapEditFillValue(0)}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all",
                    mapEditFillValue === 0
                      ? "bg-neutral-900 border-neutral-700 text-white shadow-sm"
                      : "bg-surface-base border-border-base/40 text-text-muted hover:text-text-base"
                  )}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-black border border-neutral-600" />
                  <span>Obstacle (0)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapEditFillValue(255)}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all",
                    mapEditFillValue === 255
                      ? "bg-white border-neutral-300 text-black shadow-sm"
                      : "bg-surface-base border-border-base/40 text-text-muted hover:text-text-base"
                  )}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-white border border-neutral-400" />
                  <span>Free (255)</span>
                </button>
              </div>
            </div>

            {/* Brush Size (for Freehand) */}
            {mapEditSubTool === "freehand" && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] text-text-muted font-medium">
                  <span>Brush Radius</span>
                  <span>{mapEditBrushSize} px</span>
                </div>
                <Slider
                  min={2}
                  max={50}
                  step={1}
                  value={mapEditBrushSize}
                  onChange={(e) => setMapEditBrushSize(parseInt(e.target.value))}
                />
              </div>
            )}

            {/* Vector Objects Count & List */}
            <div className="space-y-2 pt-2 border-t border-border-base/30">
              <div className="flex justify-between items-center">
                <FieldLabel className="text-[10px]">Drawn Objects</FieldLabel>
                <span className="text-[10px] text-text-muted">
                  {existingLayer.editObjects.length} objects
                </span>
              </div>
              {existingLayer.editObjects.length === 0 ? (
                <p className="text-[11px] text-text-muted bg-surface-base/40 p-2.5 rounded-xl text-center border border-border-base/20">
                  No objects drawn yet. Drag on canvas to draw.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {existingLayer.editObjects.map((obj, idx) => (
                    <div
                      key={obj.id}
                      onClick={() => setSelectedEditObjectId(obj.id)}
                      className={cn(
                        "p-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all",
                        selectedEditObjectId === obj.id
                          ? "bg-primary-base/10 border-primary-base/50 text-text-base"
                          : "bg-surface-base/40 border-border-base/30 text-text-muted hover:bg-surface-hover/40"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {obj.type === "rect" ? <Square size={13} /> : obj.type === "circle" ? <Circle size={13} /> : <Pencil size={13} />}
                        <span className="font-medium capitalize">{obj.type} #{idx + 1}</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-surface-panel/80 text-text-muted">
                          {obj.fillValue === 0 ? "Obstacle" : "Free"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-text-muted hover:text-danger-base"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEditObject(existingLayer.id, obj.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- SECTION B: Plugin Generator Layer Settings --- */}
        {(isNewPluginLayer || existingLayer?.type === "plugin") && (
          <div className="space-y-4">
            {isNewPluginLayer && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-text-muted">Layer Plugin</Label>
                {layerPlugins.length > 0 ? (
                  <Select
                    value={selectedPluginId}
                    onChange={(e) => handlePluginChange(e.target.value)}
                    className="w-full text-xs h-8"
                  >
                    {layerPlugins.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.manifest.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <AlertBox variant="danger" title="No Plugins">
                    No <code>map_layer_generator</code> plugins available.
                  </AlertBox>
                )}
              </div>
            )}

            {activePlugin?.manifest.description && (
              <p className="text-[11px] text-text-muted bg-surface-base/50 p-2.5 rounded-xl border border-border-base/30">
                {activePlugin.manifest.description}
              </p>
            )}

            {/* Interactive Inputs */}
            {activePlugin?.manifest.inputs && activePlugin.manifest.inputs.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-border-base/30">
                <FieldLabel className="text-[10px]">Interactive Inputs</FieldLabel>
                {activePlugin.manifest.inputs.map((inp, idx) => {
                  const key = inp.name || inp.id;
                  return (
                    <PluginInputEditor
                      key={`inp-${idx}`}
                      input={inp}
                      interactionData={pluginInteractionData[key]}
                      onUpdate={(data) => updatePluginInteractionData(key, data)}
                      mode="edit"
                      decimalPrecision={decimalPrecision}
                    />
                  );
                })}
              </div>
            )}

            {/* Parameters */}
            {activePlugin?.manifest.properties && activePlugin.manifest.properties.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-border-base/30">
                <FieldLabel className="text-[10px]">Parameters</FieldLabel>
                {activePlugin.manifest.properties.map((prop, idx) => {
                  const key = prop.name;
                  return (
                    <PluginPropertyEditor
                      key={`prop-${idx}`}
                      property={prop}
                      value={params[key]}
                      onChange={(val) => setParams((prev) => ({ ...prev, [key]: val }))}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- SECTION C: Common Settings (Reference Layer, Opacity & Blend Mode) --- */}
        <div className="space-y-3 pt-2 border-t border-border-base/30">
          <FieldLabel className="text-[10px]">Layer Properties</FieldLabel>

          {/* Reference Layer Setting */}
          <div className="p-3 rounded-xl bg-surface-base/50 border border-border-base/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark size={15} className={isReference ? "text-purple-400 fill-purple-400" : "text-text-muted"} />
                <span className="text-xs font-bold text-text-base">Reference Layer</span>
              </div>
              <Checkbox
                checked={isReference}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsReference(checked);
                  if (existingLayer) {
                    updateCustomLayer(existingLayer.id, { is_reference: checked });
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-text-muted">
              マップ合成（Merge）やエクスポートから除外され、下絵・参考情報としてオーバーレイ表示されます。
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] text-text-muted font-medium">
              <span>Opacity</span>
              <span>{Math.round(layerOpacity * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={layerOpacity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setLayerOpacity(val);
                if (existingLayer) {
                  updateCustomLayer(existingLayer.id, { opacity: val });
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-text-muted font-medium">Blend Mode</span>
              <Select
                value={blendMode}
                disabled={isReference}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setBlendMode(val);
                  if (existingLayer) {
                    updateCustomLayer(existingLayer.id, { blend_mode: val });
                  }
                }}
                className={cn(
                  "h-7 text-xs bg-surface-base border-border-base/50 w-36",
                  isReference && "opacity-50 cursor-not-allowed bg-surface-base/30"
                )}
              >
                <option value="overwrite">Overwrite</option>
                <option value="merge_obstacles">Merge Obstacles</option>
                <option value="merge_free">Merge Free Space</option>
              </Select>
            </div>
            {isReference && (
              <p className="text-[9px] text-purple-300/80 text-right">
                ※ 参照レイヤーのため合成されません
              </p>
            )}
          </div>
        </div>

        {errorInfo && (
          <AlertBox variant="danger" title="Generation Error">
            <div className="font-mono text-[10px] whitespace-pre-wrap break-all max-h-28 overflow-auto">
              {errorInfo}
            </div>
          </AlertBox>
        )}

        {/* --- Action Buttons --- */}
        <div className="pt-3 space-y-2">
          {(isNewPluginLayer || existingLayer?.type === "plugin") && (
            <Button
              variant="primary"
              onClick={handleExecutePlugin}
              disabled={isExecuting || !activePlugin}
              className="w-full h-9 text-xs font-bold gap-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white shadow-md shadow-cyan-500/20"
            >
              {isExecuting ? (
                <>
                  <RefreshCcw size={14} className="animate-spin" />
                  <span>Generating Layer...</span>
                </>
              ) : (
                <>
                  <Play size={14} className="fill-current" />
                  <span>{isNewPluginLayer ? "Generate Layer" : "Re-generate Layer"}</span>
                </>
              )}
            </Button>
          )}

          {!isNewPluginLayer && existingLayer && (
            <Button
              variant="secondary"
              onClick={handleDelete}
              className="w-full h-8 text-xs text-danger-base hover:bg-danger-base/10 border-danger-base/30 gap-1.5"
            >
              <Trash2 size={13} />
              <span>Delete Layer</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
