import { ReactNode, useState } from "react";
import { MoreHorizontal, Columns, Layout } from "lucide-react";

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
      <div className="p-3 border-b border-slate-700 bg-slate-800/80 backdrop-blur flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          {onClose && (
            <button
              onClick={onClose}
              className="ui-icon-btn h-7 w-7 border-transparent bg-transparent shrink-0"
            >
              {closeIcon}
            </button>
          )}
          
          {viewMode === "tabs" ? (
            <div className="flex space-x-4 overflow-x-auto no-scrollbar">
              {panels.map((panel) => (
                <button
                  key={panel.id}
                  onClick={() => onTabChange(panel.id)}
                  className={`text-xs font-bold uppercase tracking-wider pb-1 flex items-center gap-1 shrink-0 transition-colors ${
                    activeTabId === panel.id
                      ? "text-primary border-b-2 border-primary"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {panel.icon}
                  {panel.title}
                </button>
              ))}
            </div>
          ) : (
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 truncate">
              Side Panel (Split View)
            </h2>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`ui-icon-btn h-7 w-7 border-transparent transition-colors ${
              isMenuOpen ? "bg-slate-700 text-white" : "bg-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <MoreHorizontal size={16} />
          </button>

          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsMenuOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-20">
                <button
                  onClick={() => {
                    onViewModeChange("tabs");
                    setIsMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                    viewMode === "tabs" ? "text-primary font-bold bg-primary/10" : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <Layout size={14} />
                  Tab View
                </button>
                <button
                  onClick={() => {
                    onViewModeChange("split");
                    setIsMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                    viewMode === "split" ? "text-primary font-bold bg-primary/10" : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <Columns size={14} className="rotate-90" />
                  Split View (Vertical)
                </button>
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
          <div className="flex-1 overflow-hidden flex flex-col divide-y divide-slate-700">
            {panels.map((panel) => (
              <div key={panel.id} className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/30 flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {panel.title}
                  </span>
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
