import {
  MousePointer2,
  Hand,
  Download,
  Upload,
  Settings,
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
  const activePluginId = useAppStore((state) => state.activePluginId);
  const setActivePlugin = useAppStore((state) => state.setActivePlugin);

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

  return (
    <Panel
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
