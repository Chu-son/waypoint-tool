import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import { GeneratorNodePanel } from "./properties/GeneratorNodePanel";
import { IndexGroup } from "./properties/IndexGroup";
import { TransformGroup } from "./properties/TransformGroup";
import { RelativeTransformGroup } from "./properties/RelativeTransformGroup";
import { AnchorTransformGroup } from "./properties/AnchorTransformGroup";
import { CustomOptionsGroup } from "./properties/CustomOptionsGroup";
import { ElementCopyContextMenu } from "./properties/ElementCopyContextMenu";
import { ElementCopyField } from "../../stores/slices/uiSlice";
import { EmptyState } from "./common/EmptyState";
import { quaternionToYaw, yawToQuaternion, calculateAnchorRelativeTransform } from "../../utils/transformUtils";
import { WaypointNode } from "../../types/store";

export function PropertiesPanel() {
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const updateNode = useAppStore((state) => state.updateNode);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const anchorNodeId = useAppStore((state) => state.anchorNodeId);
  const elementCopyState = useAppStore((state) => state.elementCopyState);

  const [copyMenuState, setCopyMenuState] = useState<{
    field: ElementCopyField;
    position: { x: number; y: number };
  } | null>(null);

  const isMultiSelection = selectedNodeIds.length > 1;
  const rawNode = isMultiSelection ? null : nodes[selectedNodeIds[0]];
  const anchorNode = anchorNodeId ? nodes[anchorNodeId] : null;

  // プレビュー状態のノードを計算（Element Copy Preview 中）
  const node = useMemo(() => {
    const isTarget = elementCopyState && (elementCopyState.previewNodeId || selectedNodeIds[0]) === rawNode?.id;
    if (!rawNode || !elementCopyState || !isTarget || !rawNode.transform) {
      return rawNode;
    }
    const copyNode: WaypointNode = JSON.parse(JSON.stringify(rawNode));
    const tf = copyNode.transform!;

    if (elementCopyState.coordSystem === "world") {
      switch (elementCopyState.field) {
        case "x": tf.x = elementCopyState.value; break;
        case "y": tf.y = elementCopyState.value; break;
        case "z": tf.z = elementCopyState.value; break;
        case "yaw": {
          const q = yawToQuaternion(elementCopyState.value);
          tf.qx = q.qx; tf.qy = q.qy; tf.qz = q.qz; tf.qw = q.qw;
          break;
        }
      }
    } else if (anchorNode && anchorNode.transform) {
      const ax = anchorNode.transform.x ?? 0;
      const ay = anchorNode.transform.y ?? 0;
      const az = anchorNode.transform.z ?? 0;
      const aYaw = quaternionToYaw(anchorNode.transform);
      const cx = tf.x ?? 0;
      const cy = tf.y ?? 0;

      switch (elementCopyState.field) {
        case "x": {
          const dx = cx - ax, dy = cy - ay;
          const curRelY = -dx * Math.sin(aYaw) + dy * Math.cos(aYaw);
          tf.x = ax + (elementCopyState.value * Math.cos(aYaw) - curRelY * Math.sin(aYaw));
          tf.y = ay + (elementCopyState.value * Math.sin(aYaw) + curRelY * Math.cos(aYaw));
          break;
        }
        case "y": {
          const dx = cx - ax, dy = cy - ay;
          const curRelX = dx * Math.cos(aYaw) + dy * Math.sin(aYaw);
          tf.x = ax + (curRelX * Math.cos(aYaw) - elementCopyState.value * Math.sin(aYaw));
          tf.y = ay + (curRelX * Math.sin(aYaw) + elementCopyState.value * Math.cos(aYaw));
          break;
        }
        case "z": {
          tf.z = az + elementCopyState.value;
          break;
        }
        case "yaw": {
          const newYaw = aYaw + elementCopyState.value;
          const q = yawToQuaternion(newYaw);
          tf.qx = q.qx; tf.qy = q.qy; tf.qz = q.qz; tf.qw = q.qw;
          break;
        }
      }
    }

    return copyNode;
  }, [rawNode, elementCopyState, anchorNode]);

  useEffect(() => {
    if (isMultiSelection || node?.type !== "generator") {
      useAppStore.getState().clearPluginInteractionData();
    }
  }, [node?.id, isMultiSelection]);

  if (selectedNodeIds.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4">
        <EmptyState message="No item selected." />
      </div>
    );
  }

  const handleUpdate = (id: string, updates: any) => {
    updateNode(id, updates);
  };

  if (!isMultiSelection && !node) return null;

  const nodeIndex = node ? rootNodeIds.indexOf(node.id) : -1;

  const handleContextMenuLabel = (field: ElementCopyField, e: React.MouseEvent) => {
    setCopyMenuState({
      field,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  // コピー中の値計算
  let worldValForContextMenu = 0;
  let anchorRelValForContextMenu: number | undefined = undefined;

  if (copyMenuState && rawNode && rawNode.transform) {
    const tf = rawNode.transform;
    if (copyMenuState.field === "x") worldValForContextMenu = tf.x ?? 0;
    if (copyMenuState.field === "y") worldValForContextMenu = tf.y ?? 0;
    if (copyMenuState.field === "z") worldValForContextMenu = tf.z ?? 0;
    if (copyMenuState.field === "yaw") worldValForContextMenu = quaternionToYaw(tf);

    if (anchorNode && anchorNode.transform) {
      const rel = calculateAnchorRelativeTransform(tf, anchorNode.transform);
      if (copyMenuState.field === "x") anchorRelValForContextMenu = rel.relX;
      else if (copyMenuState.field === "y") anchorRelValForContextMenu = rel.relY;
      else if (copyMenuState.field === "z") anchorRelValForContextMenu = rel.relZ;
      else if (copyMenuState.field === "yaw") anchorRelValForContextMenu = rel.relYaw;
    }
  }

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
          <p className="text-xs text-text-muted font-mono break-all flex items-center gap-1">
            {node?.id}
            {anchorNodeId === node?.id && (
              <span className="text-amber-400 font-sans text-xs bg-amber-950/40 border border-amber-500/40 px-1.5 py-0.5 rounded">
                ⚓ Anchor
              </span>
            )}
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
          onContextMenuLabel={handleContextMenuLabel}
          isCopyingField={(field) => elementCopyState?.field === field && elementCopyState.coordSystem === "world"}
        />

        {!isMultiSelection && anchorNode && anchorNode.id !== node?.id && node && (
          <AnchorTransformGroup
            node={node}
            anchorNode={anchorNode}
            handleUpdate={handleUpdate}
            onContextMenuLabel={handleContextMenuLabel}
            isCopyingField={(field) => elementCopyState?.field === field && elementCopyState.coordSystem === "anchor"}
          />
        )}
        
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

      {copyMenuState && (
        <ElementCopyContextMenu
          field={copyMenuState.field}
          worldValue={worldValForContextMenu}
          anchorRelValue={anchorRelValForContextMenu}
          anchorAvailable={!!anchorNode && anchorNode.id !== node?.id}
          position={copyMenuState.position}
          onClose={() => setCopyMenuState(null)}
        />
      )}
    </div>
  );
}

