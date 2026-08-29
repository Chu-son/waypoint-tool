import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { v4 as uuidv4 } from 'uuid';
import { getFlattenedWaypointIds } from '../../../utils/treeUtils';

interface UseSnappingProps {
  scale: number;
  enableSnapping: boolean;
}

export function useSnapping({ scale, enableSnapping }: UseSnappingProps) {
  const [snapInput, setSnapInput] = useState<string>('');
  const [snapState, setSnapState] = useState<{
    isSnapped: boolean;
    axis: 'X' | 'Y' | null;
    origin: { x: number, y: number, yaw: number } | null;
    snappedWorldPos: { x: number, y: number } | null;
    lockedWaypointId: string | null;
    forcedAxis: 'X' | 'Y' | null;
    forcedSign: 1 | -1 | null;
  }>({ isSnapped: false, axis: null, origin: null, snappedWorldPos: null, lockedWaypointId: null, forcedAxis: null, forcedSign: null });

  const activeTool = useAppStore(state => state.activeTool);
  const nodes = useAppStore(state => state.nodes);

  const addNode = useAppStore(state => state.addNode);
  const updateNode = useAppStore(state => state.updateNode);
  const selectNodes = useAppStore(state => state.selectNodes);

  const getRenderableNodesList = useCallback(() => {
    const currentState = useAppStore.getState();
    const currentNodes = currentState.nodes;
    const currentRootIds = currentState.rootNodeIds;
    
    const renderableNodes: { id: string, node: typeof currentNodes[string]; parentIsGenerator: boolean; globalIndex: number }[] = [];
    let globalIdx = 0;
    const flatIds = getFlattenedWaypointIds(currentRootIds, currentNodes);
    flatIds.forEach(id => {
      const node = currentNodes[id];
      if (node && node.transform) {
        renderableNodes.push({ id, node, parentIsGenerator: false, globalIndex: globalIdx++ });
      }
    });

    // Also include visible annotation objects as snap targets
    const annos = currentState.annotationObjects || {};
    const annoOrder = currentState.annotationOrder || [];
    annoOrder.forEach((annoId) => {
      const a = annos[annoId];
      if (!a || !a.visible) return;
      if (a.type === 'point') {
        renderableNodes.push({
          id: `anno_${a.id}`,
          node: { id: a.id, type: 'manual', transform: { x: a.x, y: a.y, qx: 0, qy: 0, qz: 0, qw: 1 } },
          parentIsGenerator: false,
          globalIndex: globalIdx++,
        });
      } else if (a.type === 'oriented_point') {
        const yaw = a.yaw || 0;
        renderableNodes.push({
          id: `anno_${a.id}`,
          node: {
            id: a.id,
            type: 'manual',
            transform: { x: a.x, y: a.y, qx: 0, qy: 0, qz: Math.sin(yaw / 2), qw: Math.cos(yaw / 2) },
          },
          parentIsGenerator: false,
          globalIndex: globalIdx++,
        });
      } else if (a.type === 'line') {
        renderableNodes.push({
          id: `anno_${a.id}_start`,
          node: { id: `${a.id}_start`, type: 'manual', transform: { x: a.x1, y: a.y1, qx: 0, qy: 0, qz: 0, qw: 1 } },
          parentIsGenerator: false,
          globalIndex: globalIdx++,
        });
        renderableNodes.push({
          id: `anno_${a.id}_end`,
          node: { id: `${a.id}_end`, type: 'manual', transform: { x: a.x2, y: a.y2, qx: 0, qy: 0, qz: 0, qw: 1 } },
          parentIsGenerator: false,
          globalIndex: globalIdx++,
        });
      } else if (a.type === 'rect' || a.type === 'circle') {
        renderableNodes.push({
          id: `anno_${a.id}_center`,
          node: { id: `${a.id}_center`, type: 'manual', transform: { x: a.cx, y: a.cy, qx: 0, qy: 0, qz: 0, qw: 1 } },
          parentIsGenerator: false,
          globalIndex: globalIdx++,
        });
      }
    });

    return renderableNodes;
  }, []);

  const applySnapping = useCallback((worldX: number, worldY: number, prevTransform: import('../../../types/store').Transform | null, lockedId: string | null) => {
    if (!enableSnapping || !prevTransform) {
      if (snapState.isSnapped) {
        setSnapState(prev => ({ ...prev, isSnapped: false, axis: null, origin: null, snappedWorldPos: null }));
      }
      return { x: worldX, y: worldY };
    }

    const { x: ox, y: oy, qx, qy, qz, qw } = prevTransform;
    let yaw = Math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz));
    if (!isFinite(yaw)) yaw = 0;

    const dx = worldX - ox;
    const dy = worldY - oy;
    
    const localX = dx * Math.cos(-yaw) - dy * Math.sin(-yaw);
    const localY = dx * Math.sin(-yaw) + dy * Math.cos(-yaw);

    const snapThresholdWorld = 20 / scale;
    
    let snapped = false;
    let axis: 'X' | 'Y' | null = null;
    let newLocalX = localX;
    let newLocalY = localY;

    if (snapState.forcedAxis) {
      snapped = true;
      axis = snapState.forcedAxis;
      if (axis === 'X') {
        newLocalY = 0;
        if (snapInput) {
          const val = parseFloat(snapInput);
          if (!isNaN(val)) newLocalX = val * (snapState.forcedSign || 1);
        }
      } else {
        newLocalX = 0;
        if (snapInput) {
          const val = parseFloat(snapInput);
          if (!isNaN(val)) newLocalY = val * (snapState.forcedSign || 1);
        }
      }
    } else if (Math.abs(localY) < snapThresholdWorld) {
      // Snap to local X axis (forward/back)
      snapped = true;
      axis = 'X';
      newLocalY = 0;
      if (snapInput) {
        const val = parseFloat(snapInput);
        if (!isNaN(val)) newLocalX = val;
      }
    } else if (Math.abs(localX) < snapThresholdWorld) {
      // Snap to local Y axis (left/right)
      snapped = true;
      axis = 'Y';
      newLocalX = 0;
      if (snapInput) {
        const val = parseFloat(snapInput);
        if (!isNaN(val)) newLocalY = val;
      }
    }

    let finalX = ox + newLocalX * Math.cos(yaw) - newLocalY * Math.sin(yaw);
    let finalY = oy + newLocalX * Math.sin(yaw) + newLocalY * Math.cos(yaw);
    
    if (snapped) {
      const newWorldX = ox + (newLocalX * Math.cos(yaw) - newLocalY * Math.sin(yaw));
      const newWorldY = oy + (newLocalX * Math.sin(yaw) + newLocalY * Math.cos(yaw));
      
      setSnapState(prev => ({
        ...prev,
        isSnapped: true,
        axis,
        origin: { x: ox, y: oy, yaw },
        snappedWorldPos: { x: newWorldX, y: newWorldY },
        lockedWaypointId: lockedId
      }));
      return { x: newWorldX, y: newWorldY };
    } else {
      if (snapState.isSnapped || snapState.lockedWaypointId !== lockedId) {
        setSnapState(prev => ({ ...prev, isSnapped: false, axis: null, origin: { x: ox, y: oy, yaw }, snappedWorldPos: null, lockedWaypointId: lockedId }));
      }
      return { x: finalX, y: finalY };
    }
  }, [enableSnapping, scale, snapState.isSnapped, snapState.axis, snapState.snappedWorldPos?.x, snapState.snappedWorldPos?.y, snapState.forcedAxis, snapState.lockedWaypointId]);

  // Expose an effect for keyboard events that needs MapCanvas refs
  const useSnappingKeyboardEvents = (
    interactionMode: React.MutableRefObject<string>,
    activeNodeId: React.MutableRefObject<string | null>
  ) => {
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const isTab = e.key === 'Tab' || e.code === 'Tab';
        const isRelevantKey = e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Escape' || isTab || e.key.startsWith('Arrow') || /^[0-9.\-]$/.test(e.key);

        if (isTab) {
          if (activeTool === 'add_point' && interactionMode.current === 'none') {
             e.stopPropagation();
             e.preventDefault();
             
             const list = getRenderableNodesList();
             if (list.length > 0) {
               let curIdx = list.findIndex(r => r.id === snapState.lockedWaypointId);
               if (curIdx === -1) curIdx = list.length - 1;

               if (e.shiftKey) {
                 curIdx = (curIdx + 1) % list.length;
               } else {
                 curIdx = (curIdx - 1 + list.length) % list.length;
               }
               
               const newLockedId = list[curIdx].id;
               const prev = list[curIdx].node.transform || null;
               
               if (prev) {
                 const { x: ox, y: oy, qx, qy, qz, qw } = prev;
                 let yaw = Math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz));
                 if (!isFinite(yaw)) yaw = 0;
                 setSnapState(s => ({ ...s, lockedWaypointId: newLockedId, origin: { x: ox, y: oy, yaw }, forcedAxis: null, forcedSign: null, isSnapped: false, axis: null }));
               }
             }
             return;
          }
        }

        if (!snapState.isSnapped && !snapState.lockedWaypointId) {
          if (snapInput !== '') setSnapInput('');
          return;
        }
        
        if (isRelevantKey) {
          e.stopPropagation();
          if (e.key === 'Backspace' || e.key === 'Tab' || e.key.startsWith('Arrow')) {
            e.preventDefault();
          }
        } else {
          return;
        }

        if (e.key.startsWith('Arrow') && snapInput !== '') {
          if (e.key === 'ArrowUp') setSnapState(prev => ({ ...prev, forcedAxis: 'X', forcedSign: 1 }));
          else if (e.key === 'ArrowDown') setSnapState(prev => ({ ...prev, forcedAxis: 'X', forcedSign: -1 }));
          else if (e.key === 'ArrowRight') setSnapState(prev => ({ ...prev, forcedAxis: 'Y', forcedSign: -1 }));
          else if (e.key === 'ArrowLeft') setSnapState(prev => ({ ...prev, forcedAxis: 'Y', forcedSign: 1 }));
          return;
        }
        
        if (e.key === 'Enter') {
          if (snapInput === '') return;
          
          const { origin, axis } = snapState;
          const effectiveAxis = snapState.forcedAxis || axis;
          
          if (!origin || !effectiveAxis) return;
          
          let finalWorldX = snapState.snappedWorldPos?.x ?? origin.x;
          let finalWorldY = snapState.snappedWorldPos?.y ?? origin.y;
          
          const val = parseFloat(snapInput);
          const effectiveSign = snapState.forcedSign || 1;

          if (!isNaN(val)) {
            if (effectiveAxis === 'X') {
              finalWorldX = origin.x + val * effectiveSign * Math.cos(origin.yaw);
              finalWorldY = origin.y + val * effectiveSign * Math.sin(origin.yaw);
            } else if (effectiveAxis === 'Y') {
              finalWorldX = origin.x - val * effectiveSign * Math.sin(origin.yaw);
              finalWorldY = origin.y + val * effectiveSign * Math.cos(origin.yaw);
            }
          }

          if (activeTool === 'add_point' && interactionMode.current === 'none') {
            const id = uuidv4();
            addNode({
              id,
              type: 'manual',
              transform: { 
                x: finalWorldX, 
                y: finalWorldY, 
                qx: 0, qy: 0, 
                qz: Math.sin(origin.yaw / 2), 
                qw: Math.cos(origin.yaw / 2) 
              },
              options: {}
            });
            selectNodes([id]);
            setSnapInput('');
            setSnapState(prev => ({ ...prev, isSnapped: false, axis: null, origin: { x: finalWorldX, y: finalWorldY, yaw: origin.yaw }, snappedWorldPos: null, lockedWaypointId: id, forcedAxis: null, forcedSign: null }));
          } else if (interactionMode.current === 'drag_node' && activeNodeId.current) {
            updateNode(activeNodeId.current, {
              transform: {
                ...nodes[activeNodeId.current]?.transform,
                x: finalWorldX,
                y: finalWorldY,
                qx: nodes[activeNodeId.current]?.transform?.qx ?? 0,
                qy: nodes[activeNodeId.current]?.transform?.qy ?? 0,
                qz: nodes[activeNodeId.current]?.transform?.qz ?? 0,
                qw: nodes[activeNodeId.current]?.transform?.qw ?? 1,
              } as any
            });
            setSnapInput('');
            interactionMode.current = 'none';
            activeNodeId.current = null;
            if (document.activeElement instanceof HTMLElement) {
               document.activeElement.blur();
            }
          }
        } else if (e.key === 'Backspace') {
          setSnapInput(prev => prev.slice(0, -1));
        } else if (e.key === 'Escape') {
          setSnapInput('');
          setSnapState(prev => ({ ...prev, forcedAxis: null, forcedSign: null }));
        } else if (/^[0-9.\-]$/.test(e.key)) {
          setSnapInput(prev => prev + e.key);
        }
      };

      window.addEventListener('keydown', handleKeyDown, { capture: true });
      return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [snapState, snapInput, activeTool, addNode, selectNodes, updateNode, nodes, getRenderableNodesList, interactionMode, activeNodeId]);
  };

  return {
    snapInput,
    setSnapInput,
    snapState,
    setSnapState,
    applySnapping,
    getRenderableNodesList,
    useSnappingKeyboardEvents
  };
}
