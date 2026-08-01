import { useState, useEffect, useRef } from "react";
import {
  MousePointer2,
  Hand,
  Download,
  Upload,
  Settings,
  MoreHorizontal,
  Puzzle,
  Sparkles,
  Map,
  PenTool,
  Wand2,
  Image as ImageIcon,
  Crop
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { ExportModal } from "./ExportModal";
import { ImportModal } from "./ImportModal";
import { Panel } from "./common/Panel";
import { Button } from "./common/Button";
import { FieldLabel } from "./common/FieldLabel";
import { cn } from "../../utils/cn";

function ToolIconButton({
  isActive,
  title,
  onClick,
  children,
}: {
  isActive?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      onClick={onClick}
      title={title}
      variant={isActive ? "primary" : "icon"}
      size="icon"
      className={cn(
        "rounded-xl transition-all flex-shrink-0 group",
        isActive && "shadow-[0_0_15px_rgba(59,130,246,0.5)] border-2 border-primary-base/50"
      )}
    >
      {children}
    </Button>
  );
}

export function ToolPanel() {
  const setSettingsModalOpen = useAppStore((state) => state.setSettingsModalOpen);
  const isExportModalOpen = useAppStore((state) => state.isExportModalOpen);
  const setExportModalOpen = useAppStore((state) => state.setExportModalOpen);
  const isImportModalOpen = useAppStore((state) => state.isImportModalOpen);
  const setImportModalOpen = useAppStore((state) => state.setImportModalOpen);

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
      const availableHeight = window.innerHeight - 300;
      setMaxRows(Math.max(1, Math.floor(availableHeight / 48)));
    };
    calcRows();
    window.addEventListener("resize", calcRows);
    return () => window.removeEventListener("resize", calcRows);
  }, []);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const handleExportWaypointsClick = () => {
    setExportModalOpen(true);
  };

  const handleImportWaypointsClick = () => {
    setImportModalOpen(true);
  };

  const tools = [
    { id: "select", icon: Hand, label: "Select (V)" },
    { id: "add_point", icon: MousePointer2, label: "Add Waypoint (P)" },
    { id: "add_export_region", icon: Crop, label: "Add Export Region" },
  ] as const;

  const enabledPluginsList = pluginSettings
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => plugins[s.id])
    .filter(Boolean);
  const maxIcons = maxRows * toolPanelMaxColumns;

  const visiblePlugins = enabledPluginsList.slice(0, maxIcons);
  const overflowPlugins = enabledPluginsList.slice(maxIcons);

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
    <Panel
      ref={panelRef}
      className="flex flex-col items-center py-4 px-2 gap-4 z-10 transition-all duration-300 relative border-r"
      style={{ minWidth: "4rem", width: "auto" }}
    >
      <FieldLabel className="mb-2">Tools</FieldLabel>

      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id && !activePluginId;

        return (
          <ToolIconButton
            key={tool.id}
            title={tool.label}
            isActive={isActive}
            onClick={() => {
              setActiveTool(tool.id);
              setActivePlugin(null);
            }}
          >
            <Icon
              size={20}
              className={isActive ? "" : "group-hover:scale-110 transition-transform"}
            />
          </ToolIconButton>
        );
      })}

      <div className="w-full border-t border-border-base/50 my-1" />

      {/* Dynamic Plugins Grid */}
      <div
        className="grid gap-2 justify-items-center"
        style={{
          gridTemplateColumns: `repeat(${toolPanelMaxColumns}, minmax(0, 1fr))`,
        }}
      >
        {visiblePlugins.map((plugin) => {
          const isActive =
            activePluginId === plugin.id && activeTool === "add_generator";
          return (
            <ToolIconButton
              key={plugin.id}
              title={plugin.manifest.name}
              isActive={isActive}
              onClick={() => {
                setActiveTool("add_generator");
                setActivePlugin(plugin.id);
                setIsMoreMenuOpen(false);
              }}
            >
              {renderPluginIcon(plugin.id, 18)}
            </ToolIconButton>
          );
        })}

        {/* More Menu Toggle */}
        {overflowPlugins.length > 0 && (
          <div className="relative">
            <Button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              title="More Plugins..."
              variant={isMoreMenuOpen ? "secondary" : "icon"}
              size="icon"
              className="rounded-xl transition-all"
            >
              <MoreHorizontal size={20} />
            </Button>

            {/* Overflow Dropdown */}
            {isMoreMenuOpen && (
              <Panel
                variant="overlay"
                className="absolute left-12 top-0 ml-2 w-48 rounded-lg py-2 z-50"
              >
                {overflowPlugins.map((plugin) => {
                  const isActive =
                    activePluginId === plugin.id &&
                    activeTool === "add_generator";
                  return (
                    <Button
                      key={plugin.id}
                      variant="ghost"
                      onClick={() => {
                        setActiveTool("add_generator");
                        setActivePlugin(plugin.id);
                        setIsMoreMenuOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-left justify-start text-sm flex items-center gap-3 transition-colors",
                        isActive ? "bg-primary-base/20 text-primary-base font-bold" : "text-text-muted hover:bg-surface-hover hover:text-text-base"
                      )}
                    >
                      {renderPluginIcon(plugin.id, 14, isActive ? "text-primary-base" : "text-text-muted")}
                      <span className="truncate">{plugin.manifest.name}</span>
                    </Button>
                  );
                })}
              </Panel>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto mb-4 border-t border-border-base pt-4 flex flex-col items-center w-full gap-3">
        <Button
          onClick={handleImportWaypointsClick}
          title="Import Waypoints"
          variant="icon"
          size="icon"
          className="rounded-xl group"
        >
          <Upload
            size={20}
            className="group-hover:scale-110 transition-transform text-primary-base"
          />
        </Button>

        <Button
          onClick={handleExportWaypointsClick}
          title="Export Waypoints"
          variant="icon"
          size="icon"
          className="rounded-xl group"
        >
          <Download
            size={20}
            className="group-hover:scale-110 transition-transform text-primary-base"
          />
        </Button>

        <Button
          onClick={() => setSettingsModalOpen(true, 'general')}
          title="Settings & Plugins"
          variant="icon"
          size="icon"
          className="rounded-xl mt-2"
        >
          <Settings
            size={20}
            className="text-text-muted hover:text-text-base transition-colors"
          />
        </Button>
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </Panel>
  );
}
