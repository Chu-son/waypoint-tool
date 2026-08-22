import { ReactNode, useState } from "react";
import { MoreHorizontal, Columns, Layout } from "lucide-react";
import { Button } from "./common/Button";
import { FieldLabel } from "./common/FieldLabel";
import { cn } from "../../utils/cn";

export interface PanelTab {
  id: string;
  title: string;
  icon?: ReactNode;
  component: ReactNode;
}

interface PanelContainerProps {
  panels: PanelTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  viewMode: "tabs" | "split";
  onViewModeChange: (mode: "tabs" | "split") => void;
  onClose?: () => void;
  closeIcon?: ReactNode;
}

function TabButton({
  panel,
  isActive,
  onClick,
}: {
  panel: PanelTab;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-md flex items-center gap-1.5 shrink-0 transition-all cursor-pointer select-none",
        isActive
          ? "text-primary-base bg-primary-base/15 font-bold shadow-sm"
          : "text-text-muted hover:text-text-base hover:bg-surface-hover/60"
      )}
    >
      <span className={cn("transition-transform shrink-0", isActive ? "scale-105" : "")}>
        {panel.icon}
      </span>
      <span className="truncate">{panel.title}</span>
    </button>
  );
}

function MenuItem({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 transition-colors cursor-pointer rounded-md",
        isActive
          ? "text-primary-base font-bold bg-primary-base/10"
          : "text-text-muted hover:bg-surface-hover hover:text-text-base"
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate flex-1">{label}</span>
      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary-base shrink-0" />}
    </button>
  );
}

export function PanelContainer({
  panels,
  activeTabId,
  onTabChange,
  viewMode,
  onViewModeChange,
  onClose,
  closeIcon,
}: PanelContainerProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const activePanel = panels.find((p) => p.id === activeTabId) || panels[0];

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Header */}
      <div className="relative z-10 px-2 py-1.5 border-b border-border-base bg-surface-panel/90 flex justify-between items-center shrink-0 min-h-[38px] gap-1">
        <div className="flex items-center gap-1.5 overflow-hidden min-w-0 flex-1">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 shrink-0 text-text-muted hover:text-text-base"
            >
              {closeIcon}
            </Button>
          )}
          
          {viewMode === "tabs" ? (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
              {panels.map((panel) => (
                <TabButton
                  key={panel.id}
                  panel={panel}
                  isActive={activeTabId === panel.id}
                  onClick={() => onTabChange(panel.id)}
                />
              ))}
            </div>
          ) : (
            <FieldLabel className="ml-1 truncate">Split View</FieldLabel>
          )}
        </div>

        <div className="relative shrink-0 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              "h-7 w-7 transition-colors",
              isMenuOpen ? "bg-surface-hover text-text-base border-border-base" : "text-text-muted hover:text-text-base"
            )}
          >
            <MoreHorizontal size={16} />
          </Button>

          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsMenuOpen(false)} 
              />
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-surface-panel/98 backdrop-blur-md border border-border-base rounded-lg shadow-2xl p-1 z-50 animate-in fade-in zoom-in duration-100 origin-top-right">
                {/* Tabs List */}
                <div className="space-y-0.5">
                  {panels.map((panel) => (
                    <MenuItem
                      key={panel.id}
                      icon={panel.icon}
                      label={panel.title}
                      isActive={viewMode === "tabs" && activeTabId === panel.id}
                      onClick={() => {
                        onTabChange(panel.id);
                        if (viewMode !== "tabs") {
                          onViewModeChange("tabs");
                        }
                        setIsMenuOpen(false);
                      }}
                    />
                  ))}
                </div>

                {/* Divider */}
                <div className="my-1 border-t border-border-base/50" />

                {/* View Mode */}
                <div className="space-y-0.5">
                  <MenuItem
                    icon={<Layout size={14} />}
                    label="Tab View"
                    isActive={viewMode === "tabs"}
                    onClick={() => {
                      onViewModeChange("tabs");
                      setIsMenuOpen(false);
                    }}
                  />
                  <MenuItem
                    icon={<Columns size={14} className="rotate-90" />}
                    label="Split View (Vertical)"
                    isActive={viewMode === "split"}
                    onClick={() => {
                      onViewModeChange("split");
                      setIsMenuOpen(false);
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === "tabs" ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {activePanel?.component}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col divide-y divide-border-base/50">
            {panels.map((panel) => (
              <div key={panel.id} className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="px-3 py-1.5 bg-surface-panel/30 border-b border-border-base/20 flex items-center gap-2 shrink-0">
                  <FieldLabel>{panel.title}</FieldLabel>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                  {panel.component}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
