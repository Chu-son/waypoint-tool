import './App.css';
import { useEffect, useCallback, useMemo } from 'react';
import { ToolPanel } from './components/ui/shell/ToolPanel';
import { TopMenu } from './components/ui/shell/TopMenu';
import { PanelContainer, PanelTab } from './components/ui/shell/PanelContainer';
import { MapCanvas } from './components/canvas/MapCanvas';
import { SettingsModal } from './components/ui/modals/SettingsModal';
import { ExportModal } from './components/ui/modals/ExportModal';
import { ImportModal } from './components/ui/modals/ImportModal';
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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppAPI, DialogAPI, BackendAPI } from './api';
import { Button } from './components/ui/common/Button';
import { extractProjectName, formatWindowTitle } from './utils/projectUtils';

import { PluginInstance } from './types/store';

function App() {
  // Sidebar States from Store
  const panelLayout = useAppStore((state) => state.panelLayout);
  const leftPanelActiveTab = useAppStore((state) => state.leftPanelActiveTab);
  const rightPanelActiveTab = useAppStore((state) => state.rightPanelActiveTab);
  const leftPanelViewMode = useAppStore((state) => state.leftPanelViewMode);
  const rightPanelViewMode = useAppStore((state) => state.rightPanelViewMode);
  const isLeftPanelOpen = useAppStore((state) => state.isLeftPanelOpen);
  const isRightPanelOpen = useAppStore((state) => state.isRightPanelOpen);

  const moveTabToPanel = useAppStore((state) => state.moveTabToPanel);
  const reorderTab = useAppStore((state) => state.reorderTab);
  const resetPanelLayout = useAppStore((state) => state.resetPanelLayout);
  const setLeftPanelActiveTab = useAppStore((state) => state.setLeftPanelActiveTab);
  const setRightPanelActiveTab = useAppStore((state) => state.setRightPanelActiveTab);
  const setLeftPanelViewMode = useAppStore((state) => state.setLeftPanelViewMode);
  const setRightPanelViewMode = useAppStore((state) => state.setRightPanelViewMode);
  const setLeftPanelOpen = useAppStore((state) => state.setLeftPanelOpen);
  const setRightPanelOpen = useAppStore((state) => state.setRightPanelOpen);

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

  const leftWidth = useAppStore((state) => state.leftPanelWidth);
  const rightWidth = useAppStore((state) => state.rightPanelWidth);
  const setLeftWidth = useAppStore((state) => state.setLeftPanelWidth);
  const setRightWidth = useAppStore((state) => state.setRightPanelWidth);

  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
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

  const handleLeftDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = leftWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);
        setLeftWidth(Math.max(180, Math.min(newWidth, 600)));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'default';
      };
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
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
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'default';
      };
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [rightWidth],
  );

  const inspectorComponent = useInspectorPanelComponent();

  const defaultLeftPanels: PanelTab[] = useMemo(() => {
    return (panelLayout?.leftTabs || [])
      .map((id) => resolveBuiltinPanelTab(id, undefined, undefined, inspectorComponent))
      .filter((tab): tab is PanelTab => tab !== null);
  }, [panelLayout?.leftTabs, inspectorComponent]);

  const defaultRightPanels: PanelTab[] = useMemo(() => {
    return (panelLayout?.rightTabs || [])
      .map((id) => resolveBuiltinPanelTab(id, undefined, undefined, inspectorComponent))
      .filter((tab): tab is PanelTab => tab !== null);
  }, [panelLayout?.rightTabs, inspectorComponent]);

  const leftPanels = useMemo(() => {
    if (isCustomUiMode && customUiConfig?.layout?.leftPanel?.tabs) {
      return resolvePanelTabs(customUiConfig.layout.leftPanel.tabs, defaultLeftPanels, inspectorComponent);
    }
    return defaultLeftPanels;
  }, [isCustomUiMode, customUiConfig, defaultLeftPanels, inspectorComponent]);

  const rightPanels = useMemo(() => {
    if (isCustomUiMode && customUiConfig?.layout?.rightPanel?.tabs) {
      return resolvePanelTabs(customUiConfig.layout.rightPanel.tabs, defaultRightPanels, inspectorComponent);
    }
    return defaultRightPanels;
  }, [isCustomUiMode, customUiConfig, defaultRightPanels, inspectorComponent]);

  return (
    <div className="flex flex-col h-screen w-screen bg-surface-base text-text-base overflow-hidden font-sans">
      <ThemeInjector />
      <ShortcutManager />
      <TopMenu />

      <div className="flex flex-1 overflow-hidden w-full relative">
        <ToolPanel />

        {/* Left Panel */}
        {isLeftPanelOpen && leftPanels.length > 0 && (
          <>
            <div
              style={{ width: leftWidth }}
              className="bg-surface-panel border-r border-border-base flex flex-col z-20 shadow-lg relative flex-shrink-0"
            >
              <ErrorBoundary fallbackTitle="左サイドバーの表示中にエラーが発生しました">
                <PanelContainer
                  panels={leftPanels}
                  activeTabId={leftPanelActiveTab}
                  onTabChange={setLeftPanelActiveTab}
                  viewMode={leftPanelViewMode}
                  onViewModeChange={setLeftPanelViewMode}
                  onClose={() => setLeftPanelOpen(false)}
                  closeIcon={<ChevronLeft size={16} />}
                  side="left"
                  onMoveTabToPanel={moveTabToPanel}
                  onReorderTab={reorderTab}
                  onResetLayout={resetPanelLayout}
                />
              </ErrorBoundary>
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
          <ElementCopyOverlay />
          <MapEditOverlay />
          <AnnotationEditOverlay />
          <MeasureOverlay />
          <BackgroundLoadingBadge />
          {/* Top Floating Bar for restoring panels if closed */}
          <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
            {!isLeftPanelOpen && leftPanels.length > 0 ? (
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setLeftPanelOpen(true)}
                className="pointer-events-auto bg-surface-panel/80 backdrop-blur shadow-lg border-border-base"
                title="Open Left Panel"
              >
                <ChevronRight size={16} />
              </Button>
            ) : (
              <div />
            )}

            {!isRightPanelOpen && rightPanels.length > 0 ? (
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setRightPanelOpen(true)}
                className="pointer-events-auto bg-surface-panel/80 backdrop-blur shadow-lg border-border-base"
                title="Open Right Panel"
              >
                <ChevronLeft size={16} />
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
        {isRightPanelOpen && rightPanels.length > 0 && (
          <>
            {/* Dragger */}
            <div
              className="w-1 cursor-col-resize hover:bg-primary-base/50 active:bg-primary-base z-10 transition-colors"
              onMouseDown={handleRightDrag}
            />
            <div
              style={{ width: rightWidth }}
              className="bg-surface-panel border-l border-border-base flex flex-col z-20 shadow-lg relative flex-shrink-0"
            >
              <ErrorBoundary fallbackTitle="右サイドバーの表示中にエラーが発生しました">
                <PanelContainer
                  panels={rightPanels}
                  activeTabId={rightPanelActiveTab}
                  onTabChange={setRightPanelActiveTab}
                  viewMode={rightPanelViewMode}
                  onViewModeChange={setRightPanelViewMode}
                  onClose={() => setRightPanelOpen(false)}
                  closeIcon={<ChevronRight size={16} />}
                  side="right"
                  onMoveTabToPanel={moveTabToPanel}
                  onReorderTab={reorderTab}
                  onResetLayout={resetPanelLayout}
                />
              </ErrorBoundary>
            </div>
          </>
        )}
      </div>
      <StatusBar />
      <ErrorBoundary fallbackTitle="設定画面の表示中にエラーが発生しました">
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      </ErrorBoundary>
      <ErrorBoundary fallbackTitle="エクスポート画面の表示中にエラーが発生しました">
        <ExportModal isOpen={isExportModalOpen} onClose={() => setExportModalOpen(false)} />
      </ErrorBoundary>
      <ErrorBoundary fallbackTitle="インポート画面の表示中にエラーが発生しました">
        <ImportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} />
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
