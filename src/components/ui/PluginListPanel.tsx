import { useAppStore } from "../../stores/appStore";
import { Settings, Puzzle, Sparkles, Map, PenTool, Wand2, Image as ImageIcon, ExternalLink } from "lucide-react";

export function PluginListPanel() {
  const plugins = useAppStore((state) => state.plugins);
  const pluginSettings = useAppStore((state) => state.pluginSettings);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setActivePlugin = useAppStore((state) => state.setActivePlugin);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const activeTool = useAppStore((state) => state.activeTool);

  const setSettingsModalOpen = useAppStore((state) => state.setSettingsModalOpen);

  const enabledPluginsList = pluginSettings
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => plugins[s.id])
    .filter(Boolean);

  const getPluginIcon = (pluginId: string) => {
    const setting = pluginSettings.find(s => s.id === pluginId);
    const manifestIcon = plugins[pluginId]?.manifest?.icon;
    return setting?.icon || manifestIcon || "Puzzle";
  };

  const renderPluginIcon = (pluginId: string, size: number, className: string = "") => {
    const iconStr = getPluginIcon(pluginId);
    
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
  };

  return (
    <div className="flex-1 overflow-y-auto w-full flex flex-col bg-slate-800/30">
      <div className="p-3 shrink-0 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
        <span className="text-xs font-semibold text-slate-400">Available Generators</span>
        <button
          onClick={() => setSettingsModalOpen(true, 'plugins')}
          className="text-slate-400 hover:text-white transition-colors"
          title="Open Settings"
        >
          <Settings size={14} />
        </button>
      </div>

      <div className="flex-1 p-2 space-y-1">
        {enabledPluginsList.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-xs italic">
            No enabled plugins found.
          </div>
        ) : (
          enabledPluginsList.map((plugin) => {
            const isActive = activePluginId === plugin.id && activeTool === "add_generator";
            return (
              <div
                key={plugin.id}
                className={`group flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer ${
                  isActive 
                  ? "bg-primary/20 border-primary shadow-[0_0_10px_rgba(59,130,246,0.2)]" 
                  : "bg-slate-900/40 border-slate-700 hover:border-slate-500 hover:bg-slate-800/60"
                }`}
                onClick={() => {
                  setActiveTool("add_generator");
                  setActivePlugin(plugin.id);
                }}
              >
                <div className={`p-2 rounded-lg shrink-0 ${isActive ? "bg-primary text-white" : "bg-slate-800 text-slate-400"}`}>
                  {renderPluginIcon(plugin.id, 18)}
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold truncate ${isActive ? "text-primary-300" : "text-slate-200"}`}>
                      {plugin.manifest.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettingsModalOpen(true, 'plugins');
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-all p-1"
                      title="Plugin Details"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                  {plugin.manifest.description && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {plugin.manifest.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>


    </div>
  );
}
