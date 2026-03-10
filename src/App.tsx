import "./App.css";
import React, { useEffect, useCallback, useMemo } from "react";
import { ToolPanel } from "./components/ui/ToolPanel";
import { TopMenu } from "./components/ui/TopMenu";
import { WaypointTree } from "./components/ui/WaypointTree";
import { PropertiesPanel } from "./components/ui/PropertiesPanel";
import { LayerPanel } from "./components/ui/LayerPanel";
import { PluginParamsPanel } from "./components/ui/PluginParamsPanel";
import { PluginListPanel } from "./components/ui/PluginListPanel";
import { PanelContainer, PanelTab } from "./components/ui/PanelContainer";
import { MapCanvas } from "./components/canvas/MapCanvas";
import { SettingsModal } from "./components/ui/SettingsModal";
import { KeyboardShortcutsModal } from "./components/ui/KeyboardShortcutsModal";
import { ShortcutManager } from "./components/common/ShortcutManager";
import { useAppStore } from "./stores/appStore";
import { 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Box, 
  Puzzle, 
  Settings2 
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { DialogAPI, BackendAPI } from "./api";
import { Button } from "./components/ui/common/Button";

const isTauri = () => '__TAURI_INTERNALS__' in window;

import { PluginInstance } from "./types/store";

function App() {
  const activeTool = useAppStore((state) => state.activeTool);

  // Sidebar States from Store
  const leftPanelActiveTab = useAppStore((state) => state.leftPanelActiveTab);
  const rightPanelActiveTab = useAppStore((state) => state.rightPanelActiveTab);
  const leftPanelViewMode = useAppStore((state) => state.leftPanelViewMode);
  const rightPanelViewMode = useAppStore((state) => state.rightPanelViewMode);
  const isLeftPanelOpen = useAppStore((state) => state.isLeftPanelOpen);
  const isRightPanelOpen = useAppStore((state) => state.isRightPanelOpen);

  const setLeftPanelActiveTab = useAppStore((state) => state.setLeftPanelActiveTab);
  const setRightPanelActiveTab = useAppStore((state) => state.setRightPanelActiveTab);
  const setLeftPanelViewMode = useAppStore((state) => state.setLeftPanelViewMode);
  const setRightPanelViewMode = useAppStore((state) => state.setRightPanelViewMode);
  const setLeftPanelOpen = useAppStore((state) => state.setLeftPanelOpen);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);

  const isSettingsModalOpen = useAppStore((state) => state.isSettingsModalOpen);
  const setSettingsModalOpen = useAppStore((state) => state.setSettingsModalOpen);
  
  const isShortcutsModalOpen = useAppStore((state) => state.isShortcutsModalOpen);
  const setShortcutsModalOpen = useAppStore((state) => state.setShortcutsModalOpen);

  const leftWidth = useAppStore((state) => state.leftPanelWidth);
  const rightWidth = useAppStore((state) => state.rightPanelWidth);
  const setLeftWidth = useAppStore((state) => state.setLeftPanelWidth);
  const setRightWidth = useAppStore((state) => state.setRightPanelWidth);

  useEffect(() => {
    const initApp = async () => {
      try {
        const installedPlugins = await BackendAPI.fetchInstalledPlugins();
        const pluginMap: Record<string, PluginInstance> = {};

        const storeSettings = useAppStore.getState().pluginSettings;
        const newSettings = [...storeSettings];
        let settingsChanged = false;

        // Register scanned plugins (both bundled and user-directory plugins)
        installedPlugins.forEach((p) => {
          pluginMap[p.id] = p;

          // Auto-add to settings if not exists
          if (!newSettings.find((s) => s.id === p.id)) {
            newSettings.push({
              id: p.id,
              enabled: true,
              order: newSettings.length,
              isBuiltin: p.is_builtin,
              path: p.is_builtin ? undefined : p.folder_path,
            });
            settingsChanged = true;
          }
        });

        // Load custom plugins from settings
        for (const setting of storeSettings) {
          if (!setting.isBuiltin && setting.path && setting.enabled !== false) {
            try {
              const customPlugin = await BackendAPI.scanCustomPlugin(
                setting.path,
              );
              pluginMap[customPlugin.id] = customPlugin;
              // If ID changed or wasn't set somehow, fix it up
              if (setting.id !== customPlugin.id) {
                setting.id = customPlugin.id;
                settingsChanged = true;
              }
            } catch (err) {
              console.warn(
                `Failed to load custom plugin from ${setting.path}:`,
                err,
              );
            }
          }
        }

        useAppStore.getState().setPlugins(pluginMap);

        // Clean up stale settings entries that don't match any known plugin
        const validSettings = newSettings.filter((s) => {
          if (pluginMap[s.id]) return true;
          // Keep non-builtin custom plugins that have a path (might load next time)
          if (!s.isBuiltin && s.path) return true;
          console.warn(`Removing stale plugin setting: ${s.id}`);
          return false;
        });
        if (validSettings.length !== newSettings.length) settingsChanged = true;

        // Final deduplication by ID and cleanup
        const uniqueSettings: typeof validSettings = [];
        const seenIds = new Set<string>();
        for (const s of validSettings) {
          if (!seenIds.has(s.id)) {
            uniqueSettings.push(s);
            seenIds.add(s.id);
          } else {
            settingsChanged = true;
          }
        }

        if (settingsChanged) {
          useAppStore.getState().setPluginSettings(uniqueSettings);
        }
      } catch (e) {
        console.error("Failed to load plugins:", e);
      }
    };
    initApp();
  }, []);

  // Initialization moved to ShortcutManager for shortcuts, 
  // though basic initialization remains in App for now.

  useEffect(() => {
    if (!isTauri()) return;
    const unlistenPromise = getCurrentWindow().onCloseRequested(async (event) => {
      // Completely intercept the closing event to bypass tauri-plugin-window-state race conditions
      event.preventDefault();

      if (useAppStore.getState().isDirty) {
        const confirmed = await DialogAPI.ask(
          "未保存の変更があります。保存せずに終了してもよろしいですか？",
          {
            title: "終了の確認",
            kind: "warning",
          },
        );

        if (!confirmed) {
          return; // Abort close
        }
      }

      // Approved to close.
      useAppStore.getState().setIsDirty(false);
      try {
        // Explicitly trigger window state saving before we force destroy
        const { saveWindowState, StateFlags } =
          await import("@tauri-apps/plugin-window-state");
        await saveWindowState(StateFlags.ALL);
      } catch (err) {
        console.error("Failed to save window state", err);
      }

      setTimeout(() => {
        invoke("force_exit");
      }, 50);
    });

    return () => {
      unlistenPromise.then((f) => f());
    };
  }, []);

  const handleLeftDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = leftWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);
        setLeftWidth(Math.max(150, Math.min(newWidth, 600)));
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "default";
      };
      document.body.style.cursor = "col-resize";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [leftWidth],
  );

  const handleRightDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = rightWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = startWidth - (moveEvent.clientX - startX);
        setRightWidth(Math.max(200, Math.min(newWidth, 800)));
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "default";
      };
      document.body.style.cursor = "col-resize";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [rightWidth],
  );

  const leftPanels: PanelTab[] = useMemo(() => [
    {
      id: "project",
      title: "Waypoints",
      icon: <Box size={14} />,
      component: <WaypointTree />
    },
    {
      id: "plugins",
      title: "Plugins",
      icon: <Puzzle size={14} />,
      component: <PluginListPanel />
    }
  ], []);

  const rightPanels: PanelTab[] = useMemo(() => [
    {
      id: "layers",
      title: "Layers",
      icon: <Layers size={14} />,
      component: <LayerPanel />
    },
    {
      id: "inspector",
      title: "Inspector",
      icon: <Settings2 size={14} />,
      component: activeTool === "add_generator" ? <PluginParamsPanel /> : <PropertiesPanel />
    }
  ], [activeTool]);

  return (
    <div className="flex flex-col h-screen w-screen bg-surface-base text-text-base overflow-hidden font-sans">
      <ShortcutManager />
      <TopMenu />

      <div className="flex flex-1 overflow-hidden w-full relative">
        <ToolPanel />

        {/* Left Panel */}
        {isLeftPanelOpen && (
          <>
            <div
              style={{ width: leftWidth }}
              className="bg-surface-panel border-r border-border-base flex flex-col z-0 shadow-lg relative flex-shrink-0"
            >
              <PanelContainer
                panels={leftPanels}
                activeTabId={leftPanelActiveTab}
                onTabChange={setLeftPanelActiveTab}
                viewMode={leftPanelViewMode}
                onViewModeChange={setLeftPanelViewMode}
                onClose={() => setLeftPanelOpen(false)}
                closeIcon={<ChevronLeft size={16} />}
              />
            </div>
            {/* Dragger */}
            <div
              className="w-1 cursor-col-resize hover:bg-primary-base/50 active:bg-primary-base z-10 transition-colors"
              onMouseDown={handleLeftDrag}
            />
          </>
        )}

        {/* Main Center Area */}
        <div className="flex-1 bg-surface-base relative overflow-hidden flex flex-col">
          {/* Top Floating Bar for restoring panels if closed */}
          <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
            {!isLeftPanelOpen ? (
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setLeftPanelOpen(true)}
                className="pointer-events-auto h-10 w-10 bg-surface-panel/80 backdrop-blur shadow-lg border-border-base"
              >
                <ChevronRight size={20} />
              </Button>
            ) : (
              <div />
            )}

            {!isRightPanelOpen ? (
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setRightPanelOpen(true)}
                className="pointer-events-auto h-10 w-10 bg-surface-panel/80 backdrop-blur shadow-lg border-border-base"
              >
                <ChevronLeft size={20} />
              </Button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex-1 relative w-full h-full flex items-center justify-center">
            <MapCanvas />
          </div>
        </div>

        {/* Right Panel */}
        {isRightPanelOpen && (
          <>
            {/* Dragger */}
            <div
              className="w-1 cursor-col-resize hover:bg-primary-base/50 active:bg-primary-base z-10 transition-colors"
              onMouseDown={handleRightDrag}
            />
            <div
              style={{ width: rightWidth }}
              className="bg-surface-panel border-l border-border-base flex flex-col z-0 shadow-lg relative flex-shrink-0"
            >
              <PanelContainer
                panels={rightPanels}
                activeTabId={rightPanelActiveTab}
                onTabChange={setRightPanelActiveTab}
                viewMode={rightPanelViewMode}
                onViewModeChange={setRightPanelViewMode}
                onClose={() => setRightPanelOpen(false)}
                closeIcon={<ChevronRight size={16} />}
              />
            </div>
          </>
        )}
      </div>
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
}

export default App;
