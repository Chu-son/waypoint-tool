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
        "text-[11px] font-bold uppercase tracking-wider pb-1 flex items-center gap-1.5 shrink-0 transition-all border-b-2",
        isActive
          ? "text-primary-base border-primary-base"
          : "text-text-muted border-transparent hover:text-text-base"
      )}
    >
      <span className={cn("transition-transform", isActive ? "scale-110" : "")}>
        {panel.icon}
      </span>
      {panel.title}
    </button>
  );
}

function ViewModeMenuItem({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-2 text-left text-xs flex items-center gap-2 transition-colors",
        isActive
          ? "text-primary-base font-bold bg-primary-base/10"
          : "text-text-muted hover:bg-surface-hover hover:text-text-base"
      )}
    >
      {icon}
      {label}
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
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Header */}
      <div className="relative z-10 px-3 py-2 border-b border-border-base bg-surface-panel/80 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 shrink-0"
            >
              {closeIcon}
            </Button>
          )}
          
          {viewMode === "tabs" ? (
            <div className="flex space-x-4 overflow-x-auto no-scrollbar">
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
            <FieldLabel className="ml-1">Split View</FieldLabel>
          )}
        </div>

        <div className="relative shrink-0">
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
                className="fixed inset-0 z-10" 
                onClick={() => setIsMenuOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 bg-surface-panel/95 backdrop-blur-md border border-border-base rounded-lg shadow-2xl py-1 z-20 animate-in fade-in zoom-in duration-100 origin-top-right">
                <ViewModeMenuItem
                  icon={<Layout size={14} />}
                  label="Tab View"
                  isActive={viewMode === "tabs"}
                  onClick={() => {
                    onViewModeChange("tabs");
                    setIsMenuOpen(false);
                  }}
                />
                <ViewModeMenuItem
                  icon={<Columns size={14} className="rotate-90" />}
                  label="Split View (Vertical)"
                  isActive={viewMode === "split"}
                  onClick={() => {
                    onViewModeChange("split");
                    setIsMenuOpen(false);
                  }}
                />
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
