import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { Settings, Puzzle, Sparkles, Map, PenTool, Wand2, Image as ImageIcon, ExternalLink, Route, Tag, Workflow, AlertTriangle } from "lucide-react";
import { EmptyState } from "./common/EmptyState";
import { cn } from "../../utils/cn";
import { resolvePluginDependencies } from "../../utils/dependencyResolver";

type FilterCategory = "all" | "waypoints" | "custom_layer" | "annotations" | "path_calculator" | "pipelines";

function PluginIcon({ iconStr, size, className }: { iconStr: string; size: number; className?: string }) {
  if (iconStr.startsWith("data:image/")) {
    return <img src={iconStr} alt="plugin-icon" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
  }

  switch (iconStr) {
    case "Sparkles": return <Sparkles size={size} className={className} />;
    case "Map": return <Map size={size} className={className} />;
    case "PenTool": return <PenTool size={size} className={className} />;
    case "Wand2": return <Wand2 size={size} className={className} />;
    case "ImageIcon": return <ImageIcon size={size} className={className} />;
    case "Route": return <Route size={size} className={className} />;
    case "Tag": return <Tag size={size} className={className} />;
    case "Workflow": return <Workflow size={size} className={className} />;
    default: return <Puzzle size={size} className={className} />;
  }
}

function PluginCard({
  plugin,
  iconStr,
  isActive,
  allPlugins,
  onSelect,
  onOpenDetails,
}: {
  plugin: any;
  iconStr: string;
  isActive: boolean;
  allPlugins: Record<string, any>;
  onSelect: () => void;
  onOpenDetails: () => void;
}) {
  const isPipeline = plugin.manifest.type === 'pipeline';
  const primaryOutput = isPipeline
    ? 'pipeline'
    : plugin.manifest.primary_output || (
        plugin.manifest.category === 'map_layer_generator'
          ? 'custom_layer'
          : plugin.manifest.category === 'path_calculator'
          ? 'path_calculator'
          : 'waypoints'
      );

  const hasDependencies = Boolean(
    (plugin.manifest?.plugin_dependencies && plugin.manifest.plugin_dependencies.length > 0) ||
    (isPipeline && plugin.manifest?.pipeline?.steps && plugin.manifest.pipeline.steps.length > 0)
  );
  const depReport = hasDependencies ? resolvePluginDependencies(plugin, allPlugins) : null;
  const hasDepIssues = depReport ? !depReport.isValid : false;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer",
        isActive
          ? "bg-primary-base/20 border-primary-base shadow-lg shadow-primary-base/10"
          : "bg-surface-base/40 border-border-base hover:border-border-base/60 hover:bg-surface-hover"
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          "p-2 rounded-lg shrink-0",
          isActive ? "bg-primary-base text-text-inverse" : "bg-surface-hover text-text-muted"
        )}
      >
        <PluginIcon iconStr={iconStr} size={18} />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-xs font-bold truncate",
              isActive ? "text-primary-base" : "text-text-base"
            )}
          >
            {plugin.manifest.name}
          </span>
          <div className="flex items-center gap-1">
            {hasDepIssues && (
              <span
                className="flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded bg-status-warning/15 text-status-warning border border-status-warning/30 font-medium"
                title={depReport?.issues.map((i) => i.message).join("\n")}
              >
                <AlertTriangle size={10} />
                <span>Issue</span>
              </span>
            )}
            <span
              className={cn(
                "text-[9px] px-1.5 py-0.2 rounded font-mono border",
                isPipeline
                  ? "bg-primary-base/15 text-primary-base border-primary-base/30 font-semibold"
                  : "bg-surface-hover text-text-muted border-border-base/30"
              )}
            >
              {primaryOutput}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails();
              }}
              className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-base transition-all p-0.5"
              title="Plugin Details"
            >
              <ExternalLink size={11} />
            </button>
          </div>
        </div>
        {plugin.manifest.description && (
          <p className="text-[10px] text-text-muted/70 truncate mt-0.5">
            {plugin.manifest.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function PluginListPanel() {
  const plugins = useAppStore((state) => state.plugins) || {};
  const rawPluginSettings = useAppStore((state) => state.pluginSettings);
  const pluginSettings = Array.isArray(rawPluginSettings) ? rawPluginSettings : [];
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setActivePlugin = useAppStore((state) => state.setActivePlugin);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const activeTool = useAppStore((state) => state.activeTool);
  const setSettingsModalOpen = useAppStore((state) => state.setSettingsModalOpen);
  const selectNodes = useAppStore((state) => state.selectNodes);
  const setRightPanelActiveTab = useAppStore((state) => state.setRightPanelActiveTab);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);
  const setActivePathCalculatorPluginId = useAppStore((state) => state.setActivePathCalculatorPluginId);

  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");

  const allEnabledPlugins = (pluginSettings || [])
    .filter((s) => s.enabled)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => (plugins || {})[s.id])
    .filter((p) => p && p.manifest);

  const filteredPlugins = allEnabledPlugins.filter((p) => {
    const isPipeline = p.manifest.type === 'pipeline';
    if (filterCategory === "all") return true;
    if (filterCategory === "pipelines") return isPipeline;
    if (isPipeline) return false;
    const po = p.manifest.primary_output || (
      p.manifest.category === 'map_layer_generator'
        ? 'custom_layer'
        : p.manifest.category === 'path_calculator'
        ? 'path_calculator'
        : 'waypoints'
    );
    return po === filterCategory;
  });

  const getPluginIconStr = (pluginId: string) => {
    const setting = pluginSettings.find(s => s.id === pluginId);
    const p = plugins[pluginId];
    const manifestIcon = p?.manifest?.icon;
    if (setting?.icon) return setting.icon;
    if (manifestIcon) return manifestIcon;
    if (p?.manifest?.type === 'pipeline') return "Workflow";
    return "Puzzle";
  };

  const handleSelectPlugin = (plugin: any) => {
    const po = plugin.manifest.primary_output || (
      plugin.manifest.category === 'map_layer_generator'
        ? 'custom_layer'
        : plugin.manifest.category === 'path_calculator'
        ? 'path_calculator'
        : 'waypoints'
    );

    if (po === "path_calculator") {
      setActivePathCalculatorPluginId(plugin.id);
    } else {
      selectNodes([]);
      setActivePlugin(plugin.id);
      setActiveTool("add_generator");
      setRightPanelActiveTab("inspector");
      setRightPanelOpen(true);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full flex flex-col bg-surface-panel/30">
      <div className="p-3 shrink-0 border-b border-border-base/30 flex justify-between items-center bg-surface-panel/50">
        <span className="text-xs font-semibold text-text-muted">Available Plugins</span>
        <button
          onClick={() => setSettingsModalOpen(true, 'plugins')}
          className="text-text-muted hover:text-text-base transition-colors"
          title="Open Settings"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="p-2 border-b border-border-base/20 flex items-center gap-1 overflow-x-auto">
        {(
          [
            { id: "all", label: "All" },
            { id: "waypoints", label: "Waypoints" },
            { id: "custom_layer", label: "Layers" },
            { id: "annotations", label: "Annotations" },
            { id: "path_calculator", label: "Path" },
            { id: "pipelines", label: "Pipelines", icon: Workflow },
          ] as const
        ).map((tab) => {
          const Icon = 'icon' in tab ? tab.icon : undefined;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterCategory(tab.id)}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1",
                filterCategory === tab.id
                  ? "bg-primary-base text-text-inverse shadow-xs"
                  : "bg-surface-panel/60 text-text-muted hover:text-text-base hover:bg-surface-hover"
              )}
            >
              {Icon && <Icon size={11} className="shrink-0" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 p-2 space-y-1">
        {filteredPlugins.length === 0 ? (
          <EmptyState message="該当するプラグインがありません。" />
        ) : (
          filteredPlugins.map((plugin) => {
            const isActive = activePluginId === plugin.id && activeTool === "add_generator";
            return (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                iconStr={getPluginIconStr(plugin.id)}
                isActive={isActive}
                allPlugins={plugins}
                onSelect={() => handleSelectPlugin(plugin)}
                onOpenDetails={() => setSettingsModalOpen(true, 'plugins')}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
