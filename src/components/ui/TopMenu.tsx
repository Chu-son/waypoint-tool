import { useRef, useState, useEffect, useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import { DialogAPI } from "../../api";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { MousePointer2, Minus, Square, X } from "lucide-react";
import { cn } from "../../utils/cn";

import * as LucideIcons from "lucide-react";

type MenuOption = {
  id?: string;
  label: string;
  action?: () => void;
  shortcut?: string;
  divider?: boolean;
  danger?: boolean;
  disabled?: boolean;
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
                key={opt.id || i}
                disabled={opt.disabled}
                onClick={() => {
                  if (opt.disabled) return;
                  opt.action?.();
                  onClose();
                }}
                className={cn(
                  "w-full text-left px-4 py-1.5 text-[13px] flex justify-between items-center transition-colors group",
                  opt.disabled
                    ? "text-text-muted/40 cursor-not-allowed hover:bg-transparent hover:text-text-muted/40"
                    : opt.danger ? "text-danger-base hover:bg-danger-base/10" : "text-text-muted hover:bg-primary-base hover:text-white"
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

function AppBrand() {
  const getEffectiveBrandName = useAppStore((state) => state.getEffectiveBrandName);
  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);

  const brandName = typeof getEffectiveBrandName === 'function' ? getEffectiveBrandName() : 'Waypoint Tool';

  // Dynamic Lucide icon resolution
  let IconComponent: any = MousePointer2;
  if (isCustomUiMode && customUiConfig?.brand?.icon) {
    const iconKey = customUiConfig.brand.icon as keyof typeof LucideIcons;
    if (LucideIcons[iconKey]) {
      IconComponent = LucideIcons[iconKey];
    }
  }

  return (
    <div className="flex items-center gap-2 text-text-base font-bold tracking-wide pointer-events-none">
      {isCustomUiMode && customUiConfig?.brand?.logoUrl ? (
        <img src={customUiConfig.brand.logoUrl} alt="Logo" className="w-4 h-4 object-contain" />
      ) : (
        <IconComponent
          size={16}
          className="text-primary-base rotate-45 transform fill-primary-base"
        />
      )}
      <span className="text-[14px]">{brandName}</span>
    </div>
  );
}

function WindowControls({ onExit }: { onExit: () => void }) {
  return (
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
        onClick={onExit}
        className="p-1 hover:bg-danger-base hover:text-white text-text-muted transition-colors rounded-md"
      >
        <X size={16} />
      </button>
    </div>
  );
}

import { PathRouterMenu } from "./PathRouterMenu";

export function TopMenu() {
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const removeNodes = useAppStore((state) => state.removeNodes);

  const showPaths = useAppStore((state) => state.showPaths);
  const showGrid = useAppStore((state) => state.showGrid);
  const showFootprints = useAppStore((state) => state.showFootprints);
  const enableSnapping = useAppStore((state) => state.enableSnapping);
  
  const setShowPaths = (v: boolean) => useAppStore.setState({ showPaths: v });
  const setShowGrid = (v: boolean) => useAppStore.setState({ showGrid: v });
  const setShowFootprints = (v: boolean) => useAppStore.setState({ showFootprints: v });
  const setEnableSnapping = (v: boolean) => useAppStore.setState({ enableSnapping: v });

  const setSettingsModalOpen = useAppStore((state) => state.setSettingsModalOpen);
  const setExportModalOpen = useAppStore((state) => state.setExportModalOpen);
  const setImportModalOpen = useAppStore((state) => state.setImportModalOpen);
  const setExportMapsModalOpen = useAppStore((state) => state.setExportMapsModalOpen);
  const setShortcutsModalOpen = useAppStore((state) => state.setShortcutsModalOpen);
  const setWelcomeModalOpen = useAppStore((state) => state.setWelcomeModalOpen);
  const setIsInitialLaunch = useAppStore((state) => state.setIsInitialLaunch);
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
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const canUndo = useAppStore((state) => state.historyPast.length > 0);
  const canRedo = useAppStore((state) => state.historyFuture.length > 0);

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

  const confirmDiscardChanges = async (): Promise<boolean> => {
    if (!useAppStore.getState().isDirty) return true;
    return await DialogAPI.ask(
      "未保存の変更があります。破棄して続行しますか？",
      {
        title: "未保存の変更の確認",
        kind: "warning",
      }
    );
  };

  const handleNewProject = async () => {
    const ok = await confirmDiscardChanges();
    if (!ok) return;
    useAppStore.getState().resetProject();
  };

  const handleOpenProject = async () => {
    const ok = await confirmDiscardChanges();
    if (!ok) return;
    await loadProject();
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
    invoke("force_exit");
  };

  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
  const toggleCustomUiMode = useAppStore((state) => state.toggleCustomUiMode);

  const menuSections = useMemo(() => {
    const sections: { label: string; options: MenuOption[] }[] = [
      {
        label: "File",
        options: [
          {
            id: "file_welcome",
            label: "Welcome Screen...",
            action: () => {
              setIsInitialLaunch(false);
              setWelcomeModalOpen(true);
            },
          },
          { divider: true, label: "" },
          { id: "file_new", label: "New Project...", action: handleNewProject, shortcut: "Ctrl+N" },
          { id: "file_open", label: "Open Project...", action: handleOpenProject, shortcut: "Ctrl+O" },
          { id: "file_save", label: "Save Project", action: saveProject, shortcut: "Ctrl+S" },
          { divider: true, label: "" },
          { id: "file_export_waypoints", label: "Export Waypoints...", action: () => setExportModalOpen(true), shortcut: "Ctrl+E" },
          { id: "file_import_waypoints", label: "Import Waypoints...", action: () => setImportModalOpen(true) },
          { id: "file_export_maps", label: "Export Maps...", action: () => setExportMapsModalOpen(true) },
          { id: "file_settings", label: "Settings...", action: () => setSettingsModalOpen(true, "general") },
          { divider: true, label: "" },
          { id: "file_exit", label: "Exit", action: handleExit, danger: true, shortcut: "Alt+F4" },
        ],
      },
      {
        label: "Edit",
        options: [
          { id: "edit_undo", label: "Undo", action: undo, shortcut: "Ctrl+Z", disabled: !canUndo },
          { id: "edit_redo", label: "Redo", action: redo, shortcut: "Ctrl+Y", disabled: !canRedo },
          { divider: true, label: "" },
          { id: "edit_select_all", label: "Select All", action: selectAllNodes, shortcut: "Ctrl+A" },
          { id: "edit_deselect_all", label: "Deselect All", action: () => useAppStore.setState({ selectedNodeIds: [] }) },
          { divider: true, label: "" },
          {
            id: "edit_delete_selected",
            label: "Delete Selected",
            action: () => {
              if (selectedNodeIds.length > 0) removeNodes(selectedNodeIds);
            },
            shortcut: "Del / Backspace",
          },
        ],
      },
      {
        label: "View",
        options: [
          { id: "view_show_properties", label: `${showProperties ? "✓ " : "  "}Show Properties`, action: () => setShowProperties(!showProperties) },
          { divider: true, label: "" },
          { id: "view_show_paths", label: `${showPaths ? "✓ " : "  "}Show Paths`, action: () => setShowPaths(!showPaths) },
          { id: "view_show_grid", label: `${showGrid ? "✓ " : "  "}Show Grid (Axes)`, action: () => setShowGrid(!showGrid) },
          { id: "view_show_footprints", label: `${showFootprints ? "✓ " : "  "}Show Robot Footprints`, action: () => setShowFootprints(!showFootprints) },
          {
            id: "view_show_occupancy",
            label: `${useAppStore.getState().showOccupancyHighlight ? "✓ " : "  "}Show Occupancy Highlight`,
            action: () => useAppStore.getState().setShowOccupancyHighlight(!useAppStore.getState().showOccupancyHighlight),
            shortcut: "Ctrl+H",
          },
          { id: "view_snap_waypoint", label: `${enableSnapping ? "✓ " : "  "}Snap to Previous Waypoint`, action: () => setEnableSnapping(!enableSnapping) },
          { id: "view_fit_to_map", label: "Fit to Map", action: triggerFitToMaps, shortcut: "Mid D-Click" },
          { divider: true, label: "" },
          { id: "view_show_left_panel", label: `${isLeftPanelOpen ? "✓ " : "  "}Show Left Panel`, action: () => setLeftPanelOpen(!isLeftPanelOpen) },
          { id: "view_show_right_panel", label: `${isRightPanelOpen ? "✓ " : "  "}Show Right Panel`, action: () => setRightPanelOpen(!isRightPanelOpen) },
          { divider: true, label: "" },
          { id: "view_reset_layout", label: "Reset Window Layout", action: resetWindowLayout },
        ],
      },
      {
        label: "Help",
        options: [
          { id: "help_shortcuts", label: "Keyboard Shortcuts", action: () => setShortcutsModalOpen(true) },
          { id: "help_devtools", label: "Developer Tools", action: () => invoke("open_devtools") },
          ...(customUiConfig ? [
            { divider: true, label: "" },
            {
              id: "help_custom_ui_toggle",
              label: isCustomUiMode ? "✓ Custom UI Mode (Switch to Standard)" : "  Standard Mode (Switch to Custom UI)",
              action: () => toggleCustomUiMode(),
            }
          ] : []),
          { divider: true, label: "" },
          {
            id: "help_about",
            label: isCustomUiMode && customUiConfig?.brand?.about?.title ? `About ${customUiConfig.brand.about.title}` : "About Waypoint Tool",
            action: async () => {
              const version = await getVersion();
              if (isCustomUiMode && customUiConfig?.brand?.about) {
                const about = customUiConfig.brand.about;
                alert(`${about.title || 'Custom UI Tool'} ${about.version || `v${version}`}\n\n${about.description || ''}\n${about.company || ''}`);
              } else {
                alert(`Waypoint Tool v${version}`);
              }
            },
          },
        ],
      },
    ];

    if (!isCustomUiMode || !customUiConfig?.layout?.topMenu) {
      return sections;
    }

    const hiddenIds = customUiConfig.layout.topMenu.hiddenItemIds || [];
    const hiddenLabels = customUiConfig.layout.topMenu.hiddenMenuLabels || [];

    return sections
      .filter((section) => !hiddenLabels.includes(section.label))
      .map((section) => {
        const filteredOptions = section.options
          .filter((opt) => {
            if (!opt.id) return true;
            if (hiddenIds.includes(opt.id)) return false;
            if (hiddenLabels.includes(opt.label)) return false;
            return true;
          })
          .filter((opt, i, arr) => {
            if (!opt.divider) return true;
            if (i === 0 || i === arr.length - 1) return false;
            return !arr[i - 1]?.divider;
          });

        return {
          ...section,
          options: filteredOptions,
        };
      })
      .filter((section) => section.options.length > 0);
  }, [
    canUndo, canRedo, selectedNodeIds, showProperties, showPaths, showGrid,
    showFootprints, enableSnapping, isLeftPanelOpen, isRightPanelOpen,
    customUiConfig, isCustomUiMode, toggleCustomUiMode, undo, redo, selectAllNodes,
    removeNodes, setShowProperties, setShowPaths, setShowGrid, setShowFootprints,
    setEnableSnapping, triggerFitToMaps, setLeftPanelOpen, setRightPanelOpen,
    resetWindowLayout, setShortcutsModalOpen, setIsInitialLaunch, setWelcomeModalOpen,
    handleNewProject, handleOpenProject, saveProject, setExportModalOpen,
    setImportModalOpen, setExportMapsModalOpen, setSettingsModalOpen, handleExit
  ]);

  return (
    <div 
      className="h-9 bg-surface-base border-b border-border-base flex items-center px-4 shrink-0 text-text-muted z-50 relative select-none shadow-sm justify-between gap-2"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1" data-tauri-drag-region>
        <AppBrand />

        <div className="flex gap-0.5 sm:gap-1 items-center shrink-0">
          {menuSections.map((section) => (
            <DropdownMenu
              key={section.label}
              label={section.label}
              options={section.options}
              isOpen={activeMenu === section.label}
              onClick={() => toggleMenu(section.label)}
              onClose={closeMenu}
              onMouseEnter={() => handleMouseEnter(section.label)}
            />
          ))}
        </div>

        <div className="h-4 w-px bg-border-base/50 shrink-0 hidden sm:block" />

        <div className="shrink-0">
          <PathRouterMenu />
        </div>
      </div>

      <div className="shrink-0 ml-2">
        <WindowControls onExit={handleExit} />
      </div>
    </div>
  );
}
