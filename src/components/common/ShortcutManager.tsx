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
        if (selectedNodeIds.length > 0) {
          removeNodes(selectedNodeIds);
        }
      }

      if (e.key === "Escape") {
        if (selectedNodeIds.length > 0) {
          useAppStore.setState({ selectedNodeIds: [] });
        }
        if (activeTool !== "select") {
          useAppStore.setState({ activeTool: "select" });
        }
        useAppStore.setState({ pluginInteractionData: {} });
        
        // Return to Layers panel on Escape
        setRightPanelActiveTab("layers");
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
  ]);

  return null;
}
