import { useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { confirmDiscardChanges } from "../../utils/projectGuard";

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
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when user is typing in input fields (except Escape)
      if (
        (document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA" ||
          (document.activeElement as HTMLElement)?.isContentEditable) &&
        e.key !== "Escape"
      ) {
        return;
      }

      // Basic Actions
      if (e.key === "Delete" || e.key === "Backspace") {
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

      if (e.key === "Escape") {
        if (typeof handleGlobalEscape === 'function') {
          handleGlobalEscape();
        } else if (typeof (useAppStore as any).getState?.()?.handleGlobalEscape === 'function') {
          (useAppStore as any).getState().handleGlobalEscape();
        } else {
          // Fallback if handleGlobalEscape is not in store (e.g. mocked store in legacy unit tests)
          if (selectedEditObjectId && setSelectedEditObjectId) {
            setSelectedEditObjectId(null);
          }
          if (selectedNodeIds.length > 0) {
            selectNodes?.([]);
          }
          if (activeCustomLayerId) {
            setActiveCustomLayerId?.(null);
          }
          if (selectedAnnotationIds.length > 0) {
            clearAnnotationSelection?.();
          }
          setAnnotationEditMode?.(false);
          setMapEditMode?.(false);
          setActiveTool?.("select");
          setActivePlugin?.(null);
          clearPluginInteractionData?.();
          setRightPanelActiveTab?.("layers");
        }
        return;
      }

      // Tool Selection
      if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.metaKey) {
        setActiveTool("select");
      }
      if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.metaKey) {
        setActiveTool("add_point");
      }
      if (e.key.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey) {
        setActiveTool(activeTool === "measure" ? "select" : "measure");
      }

      // Modifier-based Shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "a":
            e.preventDefault();
            selectAllNodes();
            break;
          case "e":
            e.preventDefault();
            setExportModalOpen(true);
            break;
          case "s":
            e.preventDefault();
            if (e.shiftKey) {
              saveProjectAs();
            } else {
              saveProject();
            }
            break;
          case "o":
            e.preventDefault();
            void (async () => {
              const ok = await confirmDiscardChanges();
              if (ok) {
                await loadProject();
              }
            })();
            break;
          case "n":
            e.preventDefault();
            void (async () => {
              const ok = await confirmDiscardChanges();
              if (ok) {
                resetProject();
              }
            })();
            break;
          case "z":
            e.preventDefault();
            undo();
            break;
          case "y":
            e.preventDefault();
            redo();
            break;
          case "h":
            e.preventDefault();
            setShowOccupancyHighlight(!showOccupancyHighlight);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
  ]);

  return null;
}
