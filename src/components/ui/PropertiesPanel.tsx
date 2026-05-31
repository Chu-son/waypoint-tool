import { useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { GeneratorNodePanel } from "./properties/GeneratorNodePanel";
import { IndexGroup } from "./properties/IndexGroup";
import { TransformGroup } from "./properties/TransformGroup";
import { RelativeTransformGroup } from "./properties/RelativeTransformGroup";
import { CustomOptionsGroup } from "./properties/CustomOptionsGroup";

export function PropertiesPanel() {
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const updateNode = useAppStore((state) => state.updateNode);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);

  const isMultiSelection = selectedNodeIds.length > 1;
  const node = isMultiSelection ? null : nodes[selectedNodeIds[0]];

  useEffect(() => {
    if (isMultiSelection || node?.type !== "generator") {
      // Clear global preview when not editing a generator
      useAppStore.getState().clearPluginInteractionData();
    }
  }, [node?.id, isMultiSelection]);

  if (selectedNodeIds.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4">
        <div className="text-sm text-text-muted italic mb-4">
          No item selected.
        </div>
      </div>
    );
  }

  const handleUpdate = (id: string, updates: any) => {
    updateNode(id, updates);
  };

  if (!isMultiSelection && !node) return null;

  const nodeIndex = node ? rootNodeIds.indexOf(node.id) : -1;

  // --------------------------------------------------------------------------
  // GENERATOR NODE UI
  // --------------------------------------------------------------------------
  if (!isMultiSelection && node?.type === "generator") {
    return <GeneratorNodePanel node={node} handleUpdate={handleUpdate} />;
  }

  // --------------------------------------------------------------------------
  // MANUAL NODE UI
  // --------------------------------------------------------------------------
  return (
    <div className="flex-1 overflow-y-auto w-full p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-text-base mb-1">
          {isMultiSelection
            ? `Multiple Selected (${selectedNodeIds.length})`
            : `Waypoint [${nodeIndex >= 0 ? nodeIndex + indexStartIndex : "?"}]`}
        </h2>
        {!isMultiSelection && (
          <p className="text-xs text-text-muted font-mono break-all">
            {node?.id}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <IndexGroup 
          isMultiSelection={isMultiSelection} 
          nodeIndex={nodeIndex} 
        />
        
        <TransformGroup 
          isMultiSelection={isMultiSelection} 
          node={node} 
          handleUpdate={handleUpdate} 
        />
        
        {!isMultiSelection && nodeIndex > 0 && node && (
          <RelativeTransformGroup 
            node={node} 
            nodeIndex={nodeIndex} 
            handleUpdate={handleUpdate} 
          />
        )}
        
        <CustomOptionsGroup 
          isMultiSelection={isMultiSelection} 
          node={node} 
          handleUpdate={handleUpdate} 
        />
      </div>
    </div>
  );
}
