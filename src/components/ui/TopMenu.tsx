import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { open, save as tauriSave, ask } from "@tauri-apps/plugin-dialog";
import { BackendAPI } from "../../api/backend";
import { invoke } from "@tauri-apps/api/core";
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state";
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
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const setLastDirectory = useAppStore((state) => state.setLastDirectory);
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const removeNodes = useAppStore((state) => state.removeNodes);

  const showPaths = useAppStore((state) => state.showPaths);
  const showGrid = useAppStore((state) => state.showGrid);
  const setShowPaths = useAppStore((state) => state.setShowPaths);
  const setShowGrid = useAppStore((state) => state.setShowGrid);

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

  const getDirName = (path: string) => {
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return lastSlash > -1 ? path.substring(0, lastSlash) : path;
  };

  const handleLoadProject = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [{ name: "Waypoint Project", extensions: ["wptroj"] }],
      });

      if (selectedPath) {
        const pathStr =
          typeof selectedPath === "string"
            ? selectedPath
            : (selectedPath as any).path;
        if (!pathStr) return;

        setLastDirectory(getDirName(pathStr));
        const projectData = await BackendAPI.loadProject(pathStr);

        useAppStore.setState({
          nodes: projectData.nodes,
          rootNodeIds: projectData.root_node_ids,
          selectedNodeIds: [],
        });

        if (projectData.map_layers && Array.isArray(projectData.map_layers)) {
          useAppStore.setState({ mapLayers: [] });
          projectData.map_layers.forEach((layer: any) => {
            useAppStore
              .getState()
              .addMapLayer(
                layer.name || "Restored Map",
                layer.info || {},
                layer.image_base64 || "",
                layer.width || 1000,
                layer.height || 1000,
              );
          });
        }

        useAppStore.getState().setIsDirty(false);
      }
    } catch (err) {
      console.error("Failed to load project:", err);
      alert(
        `プロジェクトの読み込みに失敗しました。\nエラー詳細: ${String(err)}`,
      );
    }
  };

  const handleSaveProject = async () => {
    try {
      const savePath = await tauriSave({
        defaultPath: lastDirectory || undefined,
        filters: [{ name: "Waypoint Project", extensions: ["wptroj"] }],
      });

      if (savePath) {
        let finalPath = savePath;
        if (!finalPath.toLowerCase().endsWith(".wptroj")) {
          finalPath += ".wptroj";
        }

        setLastDirectory(getDirName(finalPath));

        const currentMapLayers = useAppStore.getState().mapLayers;
        const mapLayersToSave = currentMapLayers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          info: layer.info,
          image_base64: layer.image_base64,
          width: layer.width,
          height: layer.height,
          visible: layer.visible,
          opacity: layer.opacity,
          z_index: layer.z_index,
        }));

        const projectData = {
          root_node_ids: rootNodeIds,
          nodes,
          map_layers: mapLayersToSave,
        };
        await BackendAPI.saveProject(finalPath, projectData);
        useAppStore.getState().setIsDirty(false);
        alert("プロジェクトを保存しました。");
      }
    } catch (err) {
      console.error("Failed to save project:", err);
      alert(`プロジェクトの保存に失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  const handleExit = async () => {
    if (useAppStore.getState().isDirty) {
      const confirmed = await ask(
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
      await saveWindowState(StateFlags.ALL);
    } catch (e) {}
    invoke("force_exit");
  };

  const fileOptions: MenuOption[] = [
    { label: "Open Project...", action: handleLoadProject },
    { label: "Save Project", action: handleSaveProject },
    { divider: true, label: "" },
    { label: "Exit", action: handleExit, danger: true, shortcut: "Alt+F4" },
  ];

  const editOptions: MenuOption[] = [
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
        <div className="flex gap-1 items-center" onMouseLeave={closeMenu}>
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
        </div>
      </div>
    </div>
  );
}
