import { useRef, useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { DialogAPI } from "../../api";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { MousePointer2, Minus, Square, X } from "lucide-react";
import { cn } from "../../utils/cn";

type MenuOption = {
  label: string;
  action?: () => void;
  shortcut?: string;
  divider?: boolean;
  danger?: boolean;
};

function DropdownMenu({
  label,
  options,
  isOpen,
  onClick,
  onClose,
  onMouseEnter,
}: {
  label: string;
  options: MenuOption[];
  isOpen: boolean;
  onClick: () => void;
  onClose: () => void;
  onMouseEnter: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={cn(
          "px-3 py-1.5 text-[13px] font-medium transition-colors rounded-md",
          isOpen ? "bg-surface-hover text-text-base shadow-inner" : "text-text-muted hover:bg-surface-hover hover:text-text-base"
        )}
      >
        {label}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-surface-panel/95 backdrop-blur-md border border-border-base shadow-2xl rounded-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
          {options.map((opt, i) =>
            opt.divider ? (
              <div key={i} className="h-px bg-border-base/50 my-1 mx-2" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  opt.action?.();
                  onClose();
                }}
                className={cn(
                  "w-full text-left px-4 py-1.5 text-[13px] flex justify-between items-center transition-colors group",
                  opt.danger ? "text-danger-base hover:bg-danger-base/10" : "text-text-muted hover:bg-primary-base hover:text-white"
                )}
              >
                <span>{opt.label}</span>
                {opt.shortcut && (
                  <span className={cn(
                    "text-[10px] text-text-muted font-mono tracking-tighter truncate ml-2",
                    !opt.danger && "group-hover:text-white/80"
                  )}>
                    {opt.shortcut}
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function TopMenu() {
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const removeNodes = useAppStore((state) => state.removeNodes);

  const showPaths = useAppStore((state) => state.showPaths);
  const showGrid = useAppStore((state) => state.showGrid);
  const enableSnapping = useAppStore((state) => state.enableSnapping);
  
  const setShowPaths = (v: boolean) => useAppStore.setState({ showPaths: v });
  const setShowGrid = (v: boolean) => useAppStore.setState({ showGrid: v });
  const setEnableSnapping = (v: boolean) => useAppStore.setState({ enableSnapping: v });

  const setSettingsModalOpen = useAppStore((state) => state.setSettingsModalOpen);
  const setExportModalOpen = useAppStore((state) => state.setExportModalOpen);
  const setExportMapsModalOpen = useAppStore((state) => state.setExportMapsModalOpen);
  const setShortcutsModalOpen = useAppStore((state) => state.setShortcutsModalOpen);
  const selectAllNodes = useAppStore((state) => state.selectAllNodes);
  const isLeftPanelOpen = useAppStore((state) => state.isLeftPanelOpen);
  const isRightPanelOpen = useAppStore((state) => state.isRightPanelOpen);
  const setLeftPanelOpen = useAppStore((state) => state.setLeftPanelOpen);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);
  const showProperties = useAppStore((state) => state.showProperties);
  const setShowProperties = useAppStore((state) => state.setShowProperties);
  const resetWindowLayout = useAppStore((state) => state.resetWindowLayout);
  const triggerFitToMaps = useAppStore((state) => state.triggerFitToMaps);
  const loadProject = useAppStore((state) => state.loadProject);
  const saveProject = useAppStore((state) => state.saveProject);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const toggleMenu = (menuName: string) => {
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  const closeMenu = () => setActiveMenu(null);
  const handleMouseEnter = (menuName: string) => {
    if (activeMenu && activeMenu !== menuName) {
      setActiveMenu(menuName);
    }
  };

  const handleExit = async () => {
    if (useAppStore.getState().isDirty) {
      const confirmed = await DialogAPI.ask(
        "未保存の変更があります。保存せずに終了してもよろしいですか？",
        {
          title: "終了の確認",
          kind: "warning",
        },
      );
      if (!confirmed) return;
    }
    useAppStore.getState().setIsDirty(false);
    try {
      // saveWindowState is removed as it's handled by the store's exitApp action or not needed here
    } catch (e) {}
    invoke("force_exit");
  };

  const fileOptions: MenuOption[] = [
    { label: "New Project...", action: () => useAppStore.getState().resetProject(), shortcut: "Ctrl+N" },
    { label: "Open Project...", action: loadProject, shortcut: "Ctrl+O" },
    { label: "Save Project", action: saveProject, shortcut: "Ctrl+S" },
    { divider: true, label: "" },
    { label: "Export Waypoints...", action: () => setExportModalOpen(true), shortcut: "Ctrl+E" },
    { label: "Export Maps...", action: () => setExportMapsModalOpen(true) },
    { label: "Settings...", action: () => setSettingsModalOpen(true, "general") },
    { divider: true, label: "" },
    { label: "Exit", action: handleExit, danger: true, shortcut: "Alt+F4" },
  ];

  const editOptions: MenuOption[] = [
    {
      label: "Select All",
      action: selectAllNodes,
      shortcut: "Ctrl+A",
    },
    {
      label: "Deselect All",
      action: () => useAppStore.setState({ selectedNodeIds: [] }),
    },
    { divider: true, label: "" },
    {
      label: "Delete Selected",
      action: () => {
        if (selectedNodeIds.length > 0) removeNodes(selectedNodeIds);
      },
      shortcut: "Del / Backspace",
    },
  ];

  const viewOptions: MenuOption[] = [
    {
      label: `${showProperties ? "✓ " : "  "}Show Properties`,
      action: () => setShowProperties(!showProperties),
    },
    { divider: true, label: "" },
    {
      label: `${showPaths ? "✓ " : "  "}Show Paths`,
      action: () => setShowPaths(!showPaths),
    },
    {
      label: `${showGrid ? "✓ " : "  "}Show Grid (Axes)`,
      action: () => setShowGrid(!showGrid),
    },
    {
      label: `${enableSnapping ? "✓ " : "  "}Snap to Previous Waypoint`,
      action: () => setEnableSnapping(!enableSnapping),
    },
    {
      label: "Fit to Map",
      action: triggerFitToMaps,
      shortcut: "Mid D-Click",
    },
    { divider: true, label: "" },
    {
      label: `${isLeftPanelOpen ? "✓ " : "  "}Show Left Panel`,
      action: () => setLeftPanelOpen(!isLeftPanelOpen),
    },
    {
      label: `${isRightPanelOpen ? "✓ " : "  "}Show Right Panel`,
      action: () => setRightPanelOpen(!isRightPanelOpen),
    },
    { divider: true, label: "" },
    {
      label: "Reset Window Layout",
      action: resetWindowLayout,
    },
  ];

  const helpOptions: MenuOption[] = [
    {
      label: "Keyboard Shortcuts",
      action: () => setShortcutsModalOpen(true),
    },
    {
      label: "Developer Tools",
      action: () => invoke("open_devtools"),
    },
    { divider: true, label: "" },
    {
      label: "About Waypoint Tool",
      action: async () => {
        const version = await getVersion();
        alert(`Waypoint Tool v${version}`);
      },
    },
  ];

  return (
    <div 
      className="h-9 bg-surface-base border-b border-border-base flex items-center px-4 shrink-0 text-text-muted z-50 relative select-none shadow-sm"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-6" data-tauri-drag-region>
        {/* App Logo/Name */}
        <div className="flex items-center gap-2 text-text-base font-bold tracking-wide pointer-events-none">
          <MousePointer2
            size={16}
            className="text-primary-base rotate-45 transform fill-primary-base"
          />
          <span className="text-[14px]">Waypoint Tool</span>
        </div>

        {/* Windows-style Application Menu */}
        <div className="flex gap-1 items-center">
          <DropdownMenu
            label="File"
            options={fileOptions}
            isOpen={activeMenu === "File"}
            onClick={() => toggleMenu("File")}
            onClose={closeMenu}
            onMouseEnter={() => handleMouseEnter("File")}
          />
          <DropdownMenu
            label="Edit"
            options={editOptions}
            isOpen={activeMenu === "Edit"}
            onClick={() => toggleMenu("Edit")}
            onClose={closeMenu}
            onMouseEnter={() => handleMouseEnter("Edit")}
          />
          <DropdownMenu
            label="View"
            options={viewOptions}
            isOpen={activeMenu === "View"}
            onClick={() => toggleMenu("View")}
            onClose={closeMenu}
            onMouseEnter={() => handleMouseEnter("View")}
          />
          <DropdownMenu
            label="Help"
            options={helpOptions}
            isOpen={activeMenu === "Help"}
            onClick={() => toggleMenu("Help")}
            onClose={closeMenu}
            onMouseEnter={() => handleMouseEnter("Help")}
          />
        </div>
      </div>

      {/* Window Controls (Tauri) */}
      <div className="flex items-center ml-auto">
        <button
          onClick={() => getCurrentWindow().minimize()}
          className="p-1 hover:bg-surface-hover text-text-muted transition-colors rounded-md"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => getCurrentWindow().toggleMaximize()}
          className="p-1 hover:bg-surface-hover text-text-muted transition-colors rounded-md mx-1"
        >
          <Square size={14} />
        </button>
        <button
          onClick={handleExit}
          className="p-1 hover:bg-danger-base hover:text-white text-text-muted transition-colors rounded-md"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
