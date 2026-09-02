import { useEffect } from "react";
import { useAppStore } from "../../stores/appStore";

export function ShortcutManager() {
  const {
    selectedNodeIds = [],
    activeTool,
    removeNodes,
    selectAllNodes,
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
    removeEditObject,
    setSelectedEditObjectId,
    pushHistorySnapshot,
    selectedAnnotationIds = [],
    removeAnnotationObjects,
    clearAnnotationSelection,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when user is typing in input fields
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
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
        if (selectedEditObjectId && setSelectedEditObjectId) {
          setSelectedEditObjectId(null);
        }
        if (selectedNodeIds.length > 0) {
          useAppStore.setState?.({ selectedNodeIds: [] });
        }
        if (activeCustomLayerId) {
          useAppStore.setState?.({ activeCustomLayerId: null });
        }
        if (selectedAnnotationIds.length > 0) {
          clearAnnotationSelection?.();
        }
        useAppStore.setState?.({
          isMapEditMode: false,
          isAnnotationEditMode: false,
          activeTool: "select",
          activePluginId: null,
          pluginInteractionData: {},
        });
        
        // Return to Layers panel on Escape
        setRightPanelActiveTab("layers");
      }

      // Tool Selection
      if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.metaKey) {
        useAppStore.setState({ activeTool: "select" });
      }
      if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.metaKey) {
        useAppStore.setState({ activeTool: "add_point" });
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
            loadProject();
            break;
          case "n":
            e.preventDefault();
            resetProject();
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
            useAppStore.setState((s) => ({ showOccupancyHighlight: !s.showOccupancyHighlight }));
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
    setExportModalOpen,
    loadProject,
    saveProject,
    saveProjectAs,
    resetProject,
    setRightPanelActiveTab,
    undo,
    redo,
  ]);

  return null;
}
