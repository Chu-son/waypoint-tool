import './App.css';
import { useEffect, useMemo } from 'react';
import { ToolPanel } from './components/ui/shell/ToolPanel';
import { TopMenu } from './components/ui/shell/TopMenu';
import { DockSide } from './components/ui/shell/DockSide';
import { MapCanvas } from './components/canvas/MapCanvas';
import { SettingsModal } from './components/ui/modals/SettingsModal';
import { ExportModal } from './components/ui/modals/ExportModal';
import { ImportHubModal } from './components/ui/modals/import/ImportHubModal';
import { KeyboardShortcutsModal } from './components/ui/modals/KeyboardShortcutsModal';
import { ExportMapsModal } from './components/ui/modals/ExportMapsModal';
import { WelcomeModal } from './components/ui/modals/WelcomeModal';
import { PluginDataModal } from './components/ui/modals/PluginDataModal';
import { StatusBar } from './components/ui/shell/StatusBar';
import { ElementCopyOverlay } from './components/ui/overlays/ElementCopyOverlay';
import { MapEditOverlay } from './components/ui/overlays/MapEditOverlay';
import { AnnotationEditOverlay } from './components/ui/overlays/AnnotationEditOverlay';
import { MeasureOverlay } from './components/ui/overlays/MeasureOverlay';
import { LoadingOverlay } from './components/ui/common/LoadingOverlay';
import { BackgroundLoadingBadge } from './components/ui/common/BackgroundLoadingBadge';
import { ShortcutManager } from './components/common/ShortcutManager';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ThemeInjector } from './components/ui/shell/ThemeInjector';
import {
  resolvePanelTabs,
  resolveBuiltinPanelTab,
  useInspectorPanelComponent,
} from './components/ui/shell/PanelRegistry';
import { useAppStore } from './stores/appStore';
import { flushSettings } from './stores/persistence/settingsStorage';
import { AppAPI, DialogAPI, BackendAPI } from './api';
import { extractProjectName, formatWindowTitle } from './utils/projectUtils';
import { ALL_BUILTIN_PANEL_TAB_IDS } from './utils/dockLayout';

import { PluginInstance } from './types/store';
import type { DockState, PanelTab } from './types/ui';

function App() {
  // Sidebar States from Store
  const dockLayout = useAppStore((state) => state.dockLayout);
  const customPanelLayout = useAppStore((state) => state.customPanelLayout);
  const isLeftPanelOpen = useAppStore((state) => state.isLeftPanelOpen);
  const isRightPanelOpen = useAppStore((state) => state.isRightPanelOpen);

  const clickPanelTab = useAppStore((state) => state.clickPanelTab);
  const setPanelGroupWidth = useAppStore((state) => state.setPanelGroupWidth);

  const isSettingsModalOpen = useAppStore((state) => state.isSettingsModalOpen);
  const setSettingsModalOpen = useAppStore((state) => state.setSettingsModalOpen);

  const isExportModalOpen = useAppStore((state) => state.isExportModalOpen);
  const setExportModalOpen = useAppStore((state) => state.setExportModalOpen);

  const isImportModalOpen = useAppStore((state) => state.isImportModalOpen);
  const setImportModalOpen = useAppStore((state) => state.setImportModalOpen);

  const isShortcutsModalOpen = useAppStore((state) => state.isShortcutsModalOpen);
  const setShortcutsModalOpen = useAppStore((state) => state.setShortcutsModalOpen);

  const isWelcomeModalOpen = useAppStore((state) => state.isWelcomeModalOpen);
  const setWelcomeModalOpen = useAppStore((state) => state.setWelcomeModalOpen);

  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
  const dock: DockState = useMemo(
    () => ({
      layout: isCustomUiMode && customPanelLayout ? customPanelLayout : dockLayout,
      open: { left: isLeftPanelOpen, right: isRightPanelOpen },
    }),
    [isCustomUiMode, customPanelLayout, dockLayout, isLeftPanelOpen, isRightPanelOpen],
  );
  const currentProjectPath = useAppStore((state) => state.currentProjectPath);
  const isDirty = useAppStore((state) => state.isDirty);
  const getEffectiveBrandName = useAppStore((state) => state.getEffectiveBrandName);

  useEffect(() => {
    const initApp = async () => {
      // 1. Load Custom UI configuration and check preset
      await useAppStore.getState().loadCustomUiConfig();
      await useAppStore.getState().checkCustomUiPreset();

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
              const customPlugin = await BackendAPI.scanCustomPlugin(setting.path);
              pluginMap[customPlugin.id] = customPlugin;
              // If ID changed or wasn't set somehow, fix it up
              if (setting.id !== customPlugin.id) {
                setting.id = customPlugin.id;
                settingsChanged = true;
              }
            } catch (err) {
              console.warn(`Failed to load custom plugin from ${setting.path}:`, err);
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
        console.error('Failed to load plugins:', e);
      }
    };
    initApp();
  }, []);

  // Update window title based on project name, dirty state, and brand
  useEffect(() => {
    const brandName =
      isCustomUiMode && customUiConfig?.brand?.windowTitle
        ? customUiConfig.brand.windowTitle
        : typeof getEffectiveBrandName === 'function'
          ? getEffectiveBrandName()
          : 'Waypoint Tool';
    const projectName = extractProjectName(currentProjectPath);
    const title = formatWindowTitle(projectName, isDirty, brandName);
    AppAPI.setWindowTitle(title).catch(() => {});
  }, [isCustomUiMode, customUiConfig, currentProjectPath, isDirty, getEffectiveBrandName]);

  // Initialization moved to ShortcutManager for shortcuts,
  // though basic initialization remains in App for now.

  useEffect(() => {
    const unlistenPromise = AppAPI.onCloseRequested(async () => {
      if (useAppStore.getState().isDirty) {
        const confirmed = await DialogAPI.ask('未保存の変更があります。保存せずに終了してもよろしいですか？', {
          title: '終了の確認',
          kind: 'warning',
        });

        if (!confirmed) {
          return; // Abort close
        }
      }

      // Approved to close.
      useAppStore.getState().setIsDirty(false);
      try {
        // Settings are written asynchronously; make sure the latest ones reach the file first.
        await flushSettings();
      } catch (err) {
        console.error('Failed to save settings', err);
      }
      try {
        // Explicitly trigger window state saving before we force destroy
        await AppAPI.saveWindowState();
      } catch (err) {
        console.error('Failed to save window state', err);
      }

      setTimeout(() => {
        void AppAPI.forceExit();
      }, 50);
    });

    return () => {
      unlistenPromise.then((f) => f());
    };
  }, []);

  const inspectorComponent = useInspectorPanelComponent();

  // Every tab that can be docked, by id. A Custom UI's own tabs (titles, icons, HTML panels) replace the built-ins.
  const panelTabs = useMemo(() => {
    const tabs = new Map<string, PanelTab>();
    for (const id of ALL_BUILTIN_PANEL_TAB_IDS) {
      const tab = resolveBuiltinPanelTab(id, undefined, undefined, inspectorComponent);
      if (tab) tabs.set(id, tab);
    }
    if (isCustomUiMode) {
      for (const defs of [customUiConfig?.layout?.leftPanel?.tabs, customUiConfig?.layout?.rightPanel?.tabs]) {
        for (const tab of resolvePanelTabs(defs, [], inspectorComponent)) tabs.set(tab.id, tab);
      }
    }
    return tabs;
  }, [isCustomUiMode, customUiConfig, inspectorComponent]);

  return (
    <div className="flex flex-col h-screen w-screen bg-surface-base text-text-base overflow-hidden font-sans">
      <ThemeInjector />
      <ShortcutManager />
      <TopMenu />

      <div className="flex flex-1 overflow-hidden w-full relative">
        <ToolPanel />

        {/* Left Panel */}
        <DockSide
          side="left"
          dock={dock}
          tabs={panelTabs}
          onTabClick={clickPanelTab}
          onWidthChange={(group, width) => setPanelGroupWidth('left', group, width)}
        />

        {/* Main Center Area */}
        <div className="flex-1 min-w-[320px] bg-surface-base relative overflow-hidden flex flex-col">
          <ElementCopyOverlay />
          <MapEditOverlay />
          <AnnotationEditOverlay />
          <MeasureOverlay />
          <BackgroundLoadingBadge />
          <div className="flex-1 relative w-full h-full flex items-center justify-center">
            <MapCanvas />
          </div>
        </div>

        <DockSide
          side="right"
          dock={dock}
          tabs={panelTabs}
          onTabClick={clickPanelTab}
          onWidthChange={(group, width) => setPanelGroupWidth('right', group, width)}
        />
      </div>
      <StatusBar />
      <ErrorBoundary fallbackTitle="設定画面の表示中にエラーが発生しました">
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      </ErrorBoundary>
      <ErrorBoundary fallbackTitle="エクスポート画面の表示中にエラーが発生しました">
        <ExportModal isOpen={isExportModalOpen} onClose={() => setExportModalOpen(false)} />
      </ErrorBoundary>
      <ErrorBoundary fallbackTitle="インポート画面の表示中にエラーが発生しました">
        <ImportHubModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} />
      </ErrorBoundary>
      <ExportMapsModal />
      <KeyboardShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} />
      <WelcomeModal isOpen={isWelcomeModalOpen} onClose={() => setWelcomeModalOpen(false)} />
      <PluginDataModal />
      <LoadingOverlay />
    </div>
  );
}

export default App;
