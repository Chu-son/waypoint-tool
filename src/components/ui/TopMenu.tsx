import { useRef, useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { DialogAPI } from "../../api";
import { invoke } from "@tauri-apps/api/core";
import { MousePointer2 } from "lucide-react";

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
        className={`ui-btn border-transparent px-3 py-1.5 text-[13px] font-medium ${isOpen ? "bg-slate-700/80 text-white shadow-inner" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
      >
        {label}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-slate-800 border border-slate-700 shadow-2xl rounded py-1 z-50">
          {options.map((opt, i) =>
            opt.divider ? (
              <div key={i} className="h-px bg-slate-700/80 my-1 mx-2" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  opt.action?.();
                  onClose();
                }}
                className={`w-full text-left px-4 py-1.5 text-[13px] flex justify-between items-center transition-colors ${opt.danger ? "text-red-400 hover:bg-red-900/40" : "text-slate-300 hover:bg-primary hover:text-white"}`}
              >
                <span>{opt.label}</span>
                {opt.shortcut && (
                  <span className="text-[11px] text-slate-500 font-mono tracking-tighter truncate ml-2 group-hover:text-primary-200">
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
  const setShowPaths = useAppStore((state) => state.setShowPaths);
  const setShowGrid = useAppStore((state) => state.setShowGrid);

  const setSettingsModalOpen = useAppStore((state) => state.setSettingsModalOpen);
  const setExportModalOpen = useAppStore((state) => state.setExportModalOpen);
  const setShortcutsModalOpen = useAppStore((state) => state.setShortcutsModalOpen);
  const selectAllNodes = useAppStore((state) => state.selectAllNodes);
  const isLeftPanelOpen = useAppStore((state) => state.isLeftPanelOpen);
  const isRightPanelOpen = useAppStore((state) => state.isRightPanelOpen);
  const setLeftPanelOpen = useAppStore((state) => state.setLeftPanelOpen);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);
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
    { label: "Open Project...", action: loadProject, shortcut: "Ctrl+O" },
    { label: "Save Project", action: saveProject, shortcut: "Ctrl+S" },
    { divider: true, label: "" },
    { label: "Export Waypoints...", action: () => setExportModalOpen(true), shortcut: "Ctrl+E" },
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
      label: `${showPaths ? "✓ " : "  "}Show Paths`,
      action: () => setShowPaths(!showPaths),
    },
    {
      label: `${showGrid ? "✓ " : "  "}Show Grid (Axes)`,
      action: () => setShowGrid(!showGrid),
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
  ];

  const helpOptions: MenuOption[] = [
    {
      label: "Keyboard Shortcuts",
      action: () => setShortcutsModalOpen(true),
    },
    { divider: true, label: "" },
    {
      label: "About Waypoint Tool",
      action: () => {
        alert("Waypoint Tool v1.0.0\n\nA powerful tool for waypoint generation and editing.");
      },
    },
  ];

  return (
    <div className="h-9 bg-slate-950 border-b border-slate-800 flex items-center px-4 shrink-0 text-slate-300 z-50 relative select-none shadow-sm">
      <div className="flex items-center gap-6">
        {/* App Logo/Name */}
        <div className="flex items-center gap-2 text-slate-100 font-bold tracking-wide pointer-events-none">
          <MousePointer2
            size={16}
            className="text-primary rotate-45 transform fill-primary"
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
    </div>
  );
}
