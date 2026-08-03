import { useEffect } from "react";
import { useAppStore } from "../../stores/appStore";

export function ShortcutManager() {
  const {
    selectedNodeIds,
    activeTool,
    removeNodes,
    selectAllNodes,
    setExportModalOpen,
    loadProject,
    saveProject,
    resetProject,
    setRightPanelActiveTab,
    undo,
    redo,
    selectedEditObjectId,
    activeEditLayerId,
    removeEditObject,
    setSelectedEditObjectId,
    pushHistorySnapshot,
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
        if (selectedEditObjectId && activeEditLayerId) {
          removeEditObject(activeEditLayerId, selectedEditObjectId);
          if (setSelectedEditObjectId) setSelectedEditObjectId(null);
          if (pushHistorySnapshot) pushHistorySnapshot();
        } else if (selectedNodeIds.length > 0) {
          removeNodes(selectedNodeIds);
        }
      }

      if (e.key === "Escape") {
        if (selectedEditObjectId && setSelectedEditObjectId) {
          setSelectedEditObjectId(null);
        }
        if (selectedNodeIds.length > 0) {
          useAppStore.setState?.({ selectedNodeIds: [] });
        }
        if (activeTool !== "select") {
          useAppStore.setState?.({ activeTool: "select" });
        }
        useAppStore.setState?.({ pluginInteractionData: {} });
        
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
            saveProject();
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
    resetProject,
    setRightPanelActiveTab,
    undo,
    redo,
  ]);

  return null;
}
