import {
  MousePointer2,
  Hand,
  Download,
  Upload,
  Settings,
  Crop,
  Ruler,
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
        "rounded-md transition-colors flex-shrink-0",
        isActive
          ? "bg-primary-base text-text-inverse border-primary-base shadow-xs"
          : "hover:border-border-focus/60"
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
  const activePluginId = useAppStore((state) => state.activePluginId);
  const setActivePlugin = useAppStore((state) => state.setActivePlugin);

  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);

  const handleExportWaypointsClick = () => {
    setExportModalOpen(true);
  };

  const handleImportWaypointsClick = () => {
    setImportModalOpen(true);
  };

  const allTools = [
    { id: "select", icon: Hand, label: "Select (V)" },
    { id: "add_point", icon: MousePointer2, label: "Add Waypoint (P)" },
    { id: "measure", icon: Ruler, label: "Measure Distance (M)" },
    { id: "add_export_region", icon: Crop, label: "Add Export Region" },
  ] as const;

  const toolPanelConfig = isCustomUiMode ? customUiConfig?.layout?.toolPanel : undefined;
  const visibleTools = toolPanelConfig?.visibleTools
    ? allTools.filter((t) => toolPanelConfig.visibleTools!.includes(t.id as any))
    : allTools;

  const allowImport = toolPanelConfig?.allowImport !== false;
  const allowExport = toolPanelConfig?.allowExport !== false;
  const allowSettings = toolPanelConfig?.allowSettings !== false;
  const hasBottomActions = allowImport || allowExport || allowSettings;

  return (
    <Panel className="w-12 flex flex-col items-center py-3 px-1 gap-2 z-10 transition-all duration-200 relative border-r border-border-base shrink-0 select-none">
      <FieldLabel className="mb-0.5 text-[10px] tracking-wider uppercase">Tools</FieldLabel>

      {visibleTools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id && !activePluginId;

        return (
          <ToolIconButton
            key={tool.id}
            title={tool.label}
            isActive={isActive}
            onClick={() => {
              setActiveTool(tool.id as any);
              setActivePlugin(null);
            }}
          >
            <Icon size={16} />
          </ToolIconButton>
        );
      })}

      {hasBottomActions && (
        <div className="mt-auto mb-2 border-t border-border-base pt-2 flex flex-col items-center w-full gap-2">
          {allowImport && (
            <Button
              onClick={handleImportWaypointsClick}
              title="Import Waypoints"
              variant="icon"
              size="icon"
              className="rounded-md"
            >
              <Upload size={16} className="text-primary-base" />
            </Button>
          )}

          {allowExport && (
            <Button
              onClick={handleExportWaypointsClick}
              title="Export Waypoints"
              variant="icon"
              size="icon"
              className="rounded-md"
            >
              <Download size={16} className="text-primary-base" />
            </Button>
          )}

          {allowSettings && (
            <Button
              onClick={() => setSettingsModalOpen(true, 'general')}
              title="Settings & Plugins"
              variant="icon"
              size="icon"
              className="rounded-md mt-1"
            >
              <Settings
                size={16}
                className="text-text-muted hover:text-text-base transition-colors"
              />
            </Button>
          )}
        </div>
      )}

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
