import { useState, useEffect, useRef } from "react";
import {
  MousePointer2,
  Download,
  Settings,
  Plus,
  MoreHorizontal,
  Puzzle,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { SettingsModal } from "./SettingsModal";
import { ExportModal } from "./ExportModal";

export function ToolPanel() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const activeTool = useAppStore((state) => state.activeTool);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const plugins = useAppStore((state) => state.plugins);
  const pluginSettings = useAppStore((state) => state.pluginSettings);
  const toolPanelMaxColumns = useAppStore((state) => state.toolPanelMaxColumns);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const setActivePlugin = useAppStore((state) => state.setActivePlugin);

  const [maxRows, setMaxRows] = useState(6);
  const panelRef = useRef<HTMLDivElement>(null);

  // Calculate dynamic rows
  useEffect(() => {
    const calcRows = () => {
      // Top tools: ~150px
      // Bottom tools: ~120px
      // Each icon height approx 48px (40px + 8px gap)
      const availableHeight = window.innerHeight - 300;
      setMaxRows(Math.max(1, Math.floor(availableHeight / 48)));
    };
    calcRows();
    window.addEventListener("resize", calcRows);
    return () => window.removeEventListener("resize", calcRows);
  }, []);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const handleExportWaypointsClick = () => {
    setIsExportOpen(true);
  };

  const tools = [
    { id: "select", icon: MousePointer2, label: "Select (V)" },
    { id: "add_point", icon: Plus, label: "Add Waypoint (P)" },
  ] as const;

  const enabledPluginsList = pluginSettings
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => plugins[s.id])
    .filter(Boolean);
  const maxIcons = maxRows * toolPanelMaxColumns;

  const visiblePlugins = enabledPluginsList.slice(0, maxIcons);
  const overflowPlugins = enabledPluginsList.slice(maxIcons);

  return (
    <div
      ref={panelRef}
      className="bg-slate-800 border-r border-slate-700 flex flex-col items-center py-4 px-2 gap-4 z-10 shadow-md transition-all duration-300 relative"
      style={{ minWidth: "4rem", width: "auto" }}
    >
      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">
        Tools
      </div>

      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;

        return (
          <button
            key={tool.id}
            onClick={() => {
              setActiveTool(tool.id);
              setActivePlugin(null);
            }}
            title={tool.label}
            className={`
              ui-icon-btn h-10 w-10 rounded-xl transition-all group flex-shrink-0
              ${isActive && !activePluginId ? "bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"}
            `}
          >
            <Icon
              size={20}
              className={
                isActive && !activePluginId
                  ? ""
                  : "group-hover:scale-110 transition-transform"
              }
            />
          </button>
        );
      })}

      <div className="w-full border-t border-slate-700/50 my-1" />

      {/* Dynamic Plugins Grid */}
      <div
        className="grid gap-2 items-start justify-items-center"
        style={{
          gridTemplateColumns: `repeat(${Math.ceil(visiblePlugins.length / maxRows) || 1}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${Math.min(maxRows, visiblePlugins.length || 1)}, minmax(0, auto))`,
        }}
      >
        {visiblePlugins.map((plugin) => {
          const isActive =
            activePluginId === plugin.id && activeTool === "add_generator";
          return (
            <button
              key={plugin.id}
              onClick={() => {
                setActiveTool("add_generator");
                setActivePlugin(plugin.id);
                setIsMoreMenuOpen(false);
              }}
              title={plugin.manifest.name}
              className={`
                ui-icon-btn h-10 w-10 rounded-xl transition-all flex-shrink-0
                ${isActive ? "bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] border-2 border-primary-300" : "bg-slate-900/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50"}
              `}
            >
              <Puzzle size={18} />
            </button>
          );
        })}

        {/* More Menu Toggle */}
        {overflowPlugins.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              title="More Plugins..."
              className={`
                ui-icon-btn h-10 w-10 rounded-xl transition-all
                ${isMoreMenuOpen ? "bg-slate-600 text-white" : "bg-slate-900/50 text-slate-400 hover:bg-slate-700 hover:text-white"}
              `}
            >
              <MoreHorizontal size={20} />
            </button>

            {/* Overflow Dropdown */}
            {isMoreMenuOpen && (
              <div className="absolute left-12 top-0 ml-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 z-50">
                {overflowPlugins.map((plugin) => {
                  const isActive =
                    activePluginId === plugin.id &&
                    activeTool === "add_generator";
                  return (
                    <button
                      key={plugin.id}
                      onClick={() => {
                        setActiveTool("add_generator");
                        setActivePlugin(plugin.id);
                        setIsMoreMenuOpen(false);
                      }}
                      className={`
                        w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors
                        ${isActive ? "bg-primary/20 text-primary-100 font-bold" : "text-slate-300 hover:bg-slate-700 hover:text-white"}
                      `}
                    >
                      <Puzzle
                        size={14}
                        className={
                          isActive ? "text-primary-300" : "text-slate-500"
                        }
                      />
                      <span className="truncate">{plugin.manifest.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto mb-4 border-t border-slate-700 pt-4 flex flex-col items-center w-full gap-3">
        <button
          onClick={handleExportWaypointsClick}
          title="Export Waypoints"
          className="ui-icon-btn h-10 w-10 rounded-xl group"
        >
          <Download
            size={20}
            className="group-hover:scale-110 transition-transform text-purple-400"
          />
        </button>

        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Settings & Plugins"
          className="ui-icon-btn h-10 w-10 rounded-xl mt-2"
        >
          <Settings
            size={20}
            className="text-slate-500 hover:text-white transition-colors"
          />
        </button>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
