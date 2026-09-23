import { useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { confirmDiscardChanges } from '../../utils/projectGuard';

export function ShortcutManager() {
  const {
    selectedNodeIds = [],
    activeTool,
    removeNodes,
    selectAllNodes,
    selectNodes,
    setExportModalOpen,
    loadProject,
    saveProject,
    saveProjectAs,
    resetProject,
    setRightPanelActiveTab,
    undo,
    redo,
    selectedEditObjectId,
    activeCustomLayerId,
    setActiveCustomLayerId,
    removeEditObject,
    setSelectedEditObjectId,
    pushHistorySnapshot,
    selectedAnnotationIds = [],
    removeAnnotationObjects,
    clearAnnotationSelection,
    setAnnotationEditMode,
    setActiveTool,
    setActivePlugin,
    clearPluginInteractionData,
    setMapEditMode,
    showOccupancyHighlight,
    setShowOccupancyHighlight,
    handleGlobalEscape,
    copySelectedMapElements,
    cutSelectedMapElements,
    pasteMapElements,
    duplicateSelectedMapElements,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when user is typing in input fields (except Escape)
      if (
        (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable) &&
        e.key !== 'Escape'
      ) {
        return;
      }

      // Axis 1: モーダル表示中は Escape 以外のショートカットを遮断（裏の要素の誤操作・誤ペースト等を防止）
      const currentState = (useAppStore as any).getState?.() || {};
      const isModalActuallyOpen = (modal: string): boolean => {
        switch (modal) {
          case 'settings':
            return !!currentState.isSettingsModalOpen;
          case 'export':
            return !!currentState.isExportModalOpen;
          case 'import':
            return !!currentState.isImportModalOpen;
          case 'export_maps':
            return !!currentState.isExportMapsModalOpen;
          case 'shortcuts':
            return !!currentState.isShortcutsModalOpen;
          case 'welcome':
            return !!currentState.isWelcomeModalOpen;
          case 'plugin_data':
            return !!currentState.pluginDataModalState?.isOpen;
          default:
            return false;
        }
      };

      const isAnyModalOpen =
        (currentState.modalStack || []).some(isModalActuallyOpen) ||
        !!currentState.isSettingsModalOpen ||
        !!currentState.isExportModalOpen ||
        !!currentState.isImportModalOpen ||
        !!currentState.isExportMapsModalOpen ||
        !!currentState.isShortcutsModalOpen ||
        !!currentState.isWelcomeModalOpen ||
        !!currentState.pluginDataModalState?.isOpen;

      if (isAnyModalOpen && e.key !== 'Escape') {
        return;
      }

      // Basic Actions
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEditObjectId && activeCustomLayerId) {
          removeEditObject?.(activeCustomLayerId, selectedEditObjectId);
          if (setSelectedEditObjectId) setSelectedEditObjectId(null);
          if (pushHistorySnapshot) pushHistorySnapshot();
        } else if (selectedAnnotationIds.length > 0) {
          removeAnnotationObjects?.(selectedAnnotationIds);
        } else if (selectedNodeIds.length > 0) {
          removeNodes?.(selectedNodeIds);
        }
      }

      if (e.key === 'Escape') {
        handleGlobalEscape();
        return;
      }

      // Tool Selection
      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey) {
        setActiveTool('select');
      }
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey) {
        setActiveTool('add_point');
      }
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        setActiveTool(activeTool === 'measure' ? 'select' : 'measure');
      }

      // Modifier-based Shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'a':
            e.preventDefault();
            selectAllNodes();
            break;
          case 'e':
            e.preventDefault();
            setExportModalOpen(true);
            break;
          case 's':
            e.preventDefault();
            if (e.shiftKey) {
              saveProjectAs();
            } else {
              saveProject();
            }
            break;
          case 'o':
            e.preventDefault();
            void (async () => {
              const ok = await confirmDiscardChanges();
              if (ok) {
                await loadProject();
              }
            })();
            break;
          case 'n':
            e.preventDefault();
            void (async () => {
              const ok = await confirmDiscardChanges();
              if (ok) {
                resetProject();
              }
            })();
            break;
          case 'z':
            e.preventDefault();
            undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'c':
            e.preventDefault();
            void copySelectedMapElements?.();
            break;
          case 'x':
            e.preventDefault();
            void cutSelectedMapElements?.();
            break;
          case 'v':
            e.preventDefault();
            void pasteMapElements?.({ asGroup: e.shiftKey });
            break;
          case 'd':
            e.preventDefault();
            duplicateSelectedMapElements?.();
            break;
          case 'h':
            e.preventDefault();
            setShowOccupancyHighlight(!showOccupancyHighlight);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeIds,
    activeTool,
    removeNodes,
    selectAllNodes,
    selectNodes,
    setExportModalOpen,
    loadProject,
    saveProject,
    saveProjectAs,
    resetProject,
    setRightPanelActiveTab,
    undo,
    redo,
    selectedEditObjectId,
    activeCustomLayerId,
    setActiveCustomLayerId,
    removeEditObject,
    setSelectedEditObjectId,
    pushHistorySnapshot,
    selectedAnnotationIds,
    removeAnnotationObjects,
    clearAnnotationSelection,
    setAnnotationEditMode,
    setActiveTool,
    setActivePlugin,
    clearPluginInteractionData,
    setMapEditMode,
    showOccupancyHighlight,
    setShowOccupancyHighlight,
    handleGlobalEscape,
    copySelectedMapElements,
    cutSelectedMapElements,
    pasteMapElements,
    duplicateSelectedMapElements,
  ]);

  return null;
}
