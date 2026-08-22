import { useAppStore } from "../../stores/appStore";
import { Settings, Puzzle, Sparkles, Map, PenTool, Wand2, Image as ImageIcon, ExternalLink } from "lucide-react";
import { EmptyState } from "./common/EmptyState";
import { cn } from "../../utils/cn";

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
    default: return <Puzzle size={size} className={className} />;
  }
}

function PluginCard({
  plugin,
  iconStr,
  isActive,
  onSelect,
  onOpenDetails,
}: {
  plugin: any;
  iconStr: string;
  isActive: boolean;
  onSelect: () => void;
  onOpenDetails: () => void;
}) {
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
          isActive ? "bg-primary-base text-white" : "bg-surface-hover text-text-muted"
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails();
            }}
            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-base transition-all p-1"
            title="Plugin Details"
          >
            <ExternalLink size={12} />
          </button>
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
  const plugins = useAppStore((state) => state.plugins);
  const pluginSettings = useAppStore((state) => state.pluginSettings);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setActivePlugin = useAppStore((state) => state.setActivePlugin);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const activeTool = useAppStore((state) => state.activeTool);

  const setSettingsModalOpen = useAppStore((state) => state.setSettingsModalOpen);

  const enabledPluginsList = (pluginSettings || [])
    .filter((s) => s.enabled)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => (plugins || {})[s.id])
    .filter((p) => p && p.manifest && p.manifest.category !== "map_layer_generator" && p.manifest.category !== "path_calculator");

  const getPluginIconStr = (pluginId: string) => {
    const setting = pluginSettings.find(s => s.id === pluginId);
    const manifestIcon = plugins[pluginId]?.manifest?.icon;
    return setting?.icon || manifestIcon || "Puzzle";
  };

  return (
    <div className="flex-1 overflow-y-auto w-full flex flex-col bg-surface-panel/30">
      <div className="p-3 shrink-0 border-b border-border-base/30 flex justify-between items-center bg-surface-panel/50">
        <span className="text-xs font-semibold text-text-muted">Available Generators</span>
        <button
          onClick={() => setSettingsModalOpen(true, 'plugins')}
          className="text-text-muted hover:text-text-base transition-colors"
          title="Open Settings"
        >
          <Settings size={14} />
        </button>
      </div>

      <div className="flex-1 p-2 space-y-1">
        {enabledPluginsList.length === 0 ? (
          <EmptyState message="No enabled plugins found." />
        ) : (
          enabledPluginsList.map((plugin) => {
            const isActive = activePluginId === plugin.id && activeTool === "add_generator";
            return (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                iconStr={getPluginIconStr(plugin.id)}
                isActive={isActive}
                onSelect={() => {
                  setActiveTool("add_generator");
                  setActivePlugin(plugin.id);
                }}
                onOpenDetails={() => setSettingsModalOpen(true, 'plugins')}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
