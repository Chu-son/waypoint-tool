import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { PluginPropertyEditor } from "./PluginPropertyEditor";
import { Button } from "./common/Button";
import { Select } from "./common/Select";
import { Label } from "./common/Label";
import { Checkbox } from "./common/Checkbox";
import { Route, RefreshCcw, ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

export function PathRouterMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const plugins = useAppStore((state) => state.plugins) || {};
  const activePathCalculatorPluginId = useAppStore((state) => state.activePathCalculatorPluginId);
  const setActivePathCalculatorPluginId = useAppStore((state) => state.setActivePathCalculatorPluginId);
  const pathCalculatorParams = useAppStore((state) => state.pathCalculatorParams) || {};
  const setPathCalculatorParams = useAppStore((state) => state.setPathCalculatorParams);
  const autoRecalculatePath = useAppStore((state) => state.autoRecalculatePath);
  const setAutoRecalculatePath = useAppStore((state) => state.setAutoRecalculatePath);
  const isCalculatingPath = useAppStore((state) => state.isCalculatingPath);
  const recalculatePath = useAppStore((state) => state.recalculatePath);

  const pathColor = useAppStore((state) => state.pathColor) || '#10b981';
  const setPathColor = useAppStore((state) => state.setPathColor);
  const pathWidth = useAppStore((state) => state.pathWidth) ?? 0.1;
  const setPathWidth = useAppStore((state) => state.setPathWidth);
  const pathOpacity = useAppStore((state) => state.pathOpacity) ?? 0.7;
  const setPathOpacity = useAppStore((state) => state.setPathOpacity);
  const syncPathWidthWithFootprint = useAppStore((state) => state.syncPathWidthWithFootprint);
  const setSyncPathWidthWithFootprint = useAppStore((state) => state.setSyncPathWidthWithFootprint);
  const robotFootprint = useAppStore((state) => state.robotFootprint);

  const PRESET_COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e', '#ffffff'];

  let currentFootprintWidth = 0.5;
  if (robotFootprint) {
    if (robotFootprint.type === 'circular') {
      currentFootprintWidth = (robotFootprint.radius || 0.25) * 2;
    } else if (robotFootprint.type === 'rectangular') {
      currentFootprintWidth = robotFootprint.width || 0.5;
    } else if (robotFootprint.type === 'polygon' && robotFootprint.points && robotFootprint.points.length > 0) {
      const maxR = Math.max(...robotFootprint.points.map((p: any) => Math.hypot(p.x, p.y)), 0.25);
      currentFootprintWidth = maxR * 2;
    }
  }

  const pathPlugins = Object.values(plugins).filter(
    (p) => p && p.manifest && p.manifest.category === "path_calculator"
  );

  const activePlugin = activePathCalculatorPluginId ? plugins[activePathCalculatorPluginId] : null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handlePluginSelect = (pluginId: string) => {
    if (!pluginId) {
      setActivePathCalculatorPluginId(null);
    } else {
      const p = plugins[pluginId];
      if (p) {
        const initialParams: Record<string, any> = {};
        p.manifest.properties?.forEach((prop) => {
          if (prop.name) initialParams[prop.name] = prop.default ?? "";
        });
        setPathCalculatorParams(initialParams);
      }
      setActivePathCalculatorPluginId(pluginId);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "px-2.5 py-1 text-[12px] font-medium transition-all rounded-md flex items-center gap-1.5 border",
          activePlugin
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
            : "text-text-muted border-border-base/50 hover:bg-surface-hover hover:text-text-base",
          isOpen && "ring-1 ring-primary-base"
        )}
        title="Path Routing Settings"
      >
        <Route size={14} className={activePlugin ? "text-emerald-400" : "text-text-muted"} />
        <span className="truncate max-w-[140px]">
          {activePlugin ? activePlugin.manifest.name : "Route: Straight"}
        </span>
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-80 bg-surface-panel/95 backdrop-blur-md border border-border-base shadow-2xl rounded-2xl p-4 z-50 animate-in fade-in slide-in-from-top-1 duration-100 space-y-4 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border-base/40 pb-2">
            <div className="flex items-center gap-2">
              <Route size={16} className="text-emerald-400" />
              <h3 className="text-xs font-bold text-text-base">Path Routing</h3>
            </div>
            {isCalculatingPath && (
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <RefreshCcw size={10} className="animate-spin" /> Calculating
              </span>
            )}
          </div>

          {/* Plugin Selection */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-text-muted">Algorithm</Label>
            <Select
              value={activePathCalculatorPluginId || ""}
              onChange={(e) => handlePluginSelect(e.target.value)}
              className="w-full text-xs h-8"
            >
              <option value="">Straight Line (Default)</option>
              {pathPlugins.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.manifest.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Path Appearance (Common Settings) */}
          <div className="space-y-3 pt-2 border-t border-border-base/40">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-bold text-text-base uppercase tracking-wider">
                Path Appearance
              </Label>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-text-muted">Color</Label>
                <div className="flex items-center gap-1">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPathColor(c)}
                      className={cn(
                        "w-3.5 h-3.5 rounded-full border transition-transform hover:scale-110",
                        pathColor.toLowerCase() === c.toLowerCase() ? "ring-2 ring-primary-base ring-offset-1 border-white" : "border-border-base/60"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={pathColor}
                  onChange={(e) => setPathColor(e.target.value)}
                  className="w-7 h-7 rounded border border-border-base cursor-pointer bg-transparent p-0"
                />
                <input
                  type="text"
                  value={pathColor}
                  onChange={(e) => setPathColor(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs font-mono bg-surface-base border border-border-base rounded text-text-base focus:outline-none focus:border-primary-base"
                  placeholder="#10b981"
                />
              </div>
            </div>

            {/* Opacity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-text-muted">Opacity</Label>
                <span className="text-[11px] font-mono text-text-base">
                  {Math.round((pathOpacity ?? 0.7) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={pathOpacity ?? 0.7}
                onChange={(e) => setPathOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-surface-base rounded-lg appearance-none cursor-pointer accent-primary-base"
              />
            </div>

            {/* Sync with Footprint Checkbox */}
            <div className="pt-1">
              <Label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer hover:text-text-base">
                <Checkbox
                  checked={syncPathWidthWithFootprint}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSyncPathWidthWithFootprint(e.target.checked)}
                />
                <span>Sync width with Footprint</span>
              </Label>
            </div>

            {/* Path Width */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-text-muted">
                  {syncPathWidthWithFootprint ? "Footprint Width" : "Path Width"}
                </Label>
                {syncPathWidthWithFootprint && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    (Footprint: {currentFootprintWidth.toFixed(2)}m)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={syncPathWidthWithFootprint ? currentFootprintWidth : pathWidth}
                  disabled={syncPathWidthWithFootprint}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setPathWidth(val);
                  }}
                  className={cn(
                    "w-full px-2.5 py-1 text-xs bg-surface-base border border-border-base rounded text-text-base focus:outline-none focus:border-primary-base",
                    syncPathWidthWithFootprint && "opacity-60 cursor-not-allowed bg-surface-base/40"
                  )}
                />
                <span className="text-xs text-text-muted font-mono">m</span>
              </div>
            </div>
          </div>

          {/* Properties for Active Plugin */}
          {activePlugin && (
            <div className="space-y-3 pt-2 border-t border-border-base/40">
              {activePlugin.manifest.description && (
                <p className="text-[11px] text-text-muted bg-surface-base/50 p-2 rounded-lg border border-border-base/30">
                  {activePlugin.manifest.description}
                </p>
              )}

              {activePlugin.manifest.properties && activePlugin.manifest.properties.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-text-base uppercase tracking-wider">
                    Parameters
                  </Label>
                  {activePlugin.manifest.properties.map((prop, idx) => {
                    const key = prop.name;
                    return (
                      <PluginPropertyEditor
                        key={`prop-${idx}`}
                        property={prop}
                        value={pathCalculatorParams[key]}
                        onChange={(val) =>
                          setPathCalculatorParams({ ...pathCalculatorParams, [key]: val })
                        }
                      />
                    );
                  })}
                </div>
              )}

              {/* Auto recalculate */}
              <div className="pt-2">
                <Label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer hover:text-text-base">
                  <Checkbox
                    checked={autoRecalculatePath}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutoRecalculatePath(e.target.checked)}
                  />
                  <span>Auto-recalculate on change</span>
                </Label>
              </div>

              {/* Recalculate Button */}
              <Button
                variant="primary"
                onClick={() => recalculatePath()}
                disabled={isCalculatingPath}
                className="w-full h-8 text-xs gap-1.5"
              >
                <RefreshCcw size={13} className={isCalculatingPath ? "animate-spin" : ""} />
                {isCalculatingPath ? "Calculating..." : "Recalculate Path"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
