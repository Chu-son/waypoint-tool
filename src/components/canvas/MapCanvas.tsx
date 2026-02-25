import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, extend } from '@pixi/react';
import { Container, Sprite, Graphics, Texture, Text, TextStyle } from 'pixi.js';
import { useAppStore } from '../../stores/appStore';
import { v4 as uuidv4 } from 'uuid';
import { ProjectMapLayer } from '../../types/store';

extend({
  Container,
  Sprite,
  Graphics,
  Text,
});

function MapLayerSprite({ layer }: { layer: ProjectMapLayer }) {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    if (layer.image_base64) {
      const img = new Image();
      img.onload = () => {
        setTexture(Texture.from(img));
      };
      img.src = layer.image_base64;
    }
  }, [layer.image_base64]);

  if (!texture || !layer.visible) return null;
  
  // Extract metadata (with safe fallbacks)
  const { resolution = 0.05, origin = [0, 0, 0] } = layer.info || {};
  const [ox, oy, oyaw] = origin;

  // Render the map aligned to ROS origin
  // Anchor [0, 1] means the bottom-left of the image maps to the exact (ox, oy).
  // Y scale is inverted so that the image draws right-side up inside the Y-inverted Pixi Container.
  return (
    <pixiSprite 
      texture={texture} 
      anchor={{ x: 0, y: 1 }} 
      x={ox} 
      y={oy} 
      rotation={oyaw}
      scale={{ x: resolution, y: -resolution }}
      alpha={layer.opacity} 
      zIndex={layer.z_index}
    />
  );
}

export function MapCanvas() {
  const activeTool = useAppStore(state => state.activeTool);
  const addNode = useAppStore(state => state.addNode);
  const selectNodes = useAppStore(state => state.selectNodes);
  const nodes = useAppStore(state => state.nodes);
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const updateNode = useAppStore(state => state.updateNode);
  const visibleAttributes = useAppStore(state => state.visibleAttributes);
  const indexStartIndex = useAppStore(state => state.indexStartIndex);
  const optionsSchema = useAppStore(state => state.optionsSchema);
  const showPaths = useAppStore(state => state.showPaths);
  const showGrid = useAppStore(state => state.showGrid);
  const shouldFitToMaps = useAppStore(state => state.shouldFitToMaps);
  const pluginInteractionData = useAppStore(state => state.pluginInteractionData);
  const activePluginId = useAppStore(state => state.activePluginId);
  const plugins = useAppStore(state => state.plugins);
  const activeInputIndex = useAppStore(state => state.activeInputIndex);
  
  const mapLayers = useAppStore(state => state.mapLayers);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const interactionMode = useRef<'none' | 'pan_map' | 'drag_node' | 'set_yaw' | 'set_yaw_plugin' | 'draw_rect' | 'drag_rect_corner' | 'set_rect_rotation'>('none');
  const activeNodeId = useRef<string | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const rectInputKey = useRef<string>('');  // The input ID being drawn (e.g. 'sweep_rect')
  const rectDragCorner = useRef<'min' | 'max' | 'topRight' | 'bottomLeft'>('max');

  // Fallback grid texture if no maps are loaded
  const fallbackTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.strokeStyle = '#334155';
      for (let i = 0; i < 100; i += 50) {
        ctx.beginPath(); ctx.moveTo(i * 10, 0); ctx.lineTo(i * 10, 1000); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * 10); ctx.lineTo(1000, i * 10); ctx.stroke();
      }
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px Arial';
      ctx.fillText('No Map Loaded. Use Load Map button.', 50, 50);
    }
    return Texture.from(canvas);
  }, []);

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    let worldX = (screenX - (position.x + 400)) / scale;
    // container Y is inverted: screenY = -worldY * scale + position.y + 400
    // => worldY = ((position.y + 400) - screenY) / scale
    let worldY = ((position.y + 400) - screenY) / scale;
    return { x: worldX, y: worldY };
  }, [position, scale]);

  const fitToMaps = useCallback(() => {
    if (!containerRef.current) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;
    
    mapLayers.forEach(layer => {
      // Fallback to width/height if info is not provided
      const width = layer.info?.width || layer.width;
      const height = layer.info?.height || layer.height;
      const resolution = layer.info?.resolution || 0.05;
      const originX = layer.info?.origin?.[0] || 0;
      const originY = layer.info?.origin?.[1] || 0;
      
      const w = (width || 1000) * resolution;
      const h = (height || 1000) * resolution;
      
      // Rough bounding box ignoring yaw for simplicity
      minX = Math.min(minX, originX);
      minY = Math.min(minY, originY);
      maxX = Math.max(maxX, originX + w);
      maxY = Math.max(maxY, originY + h);
      hasContent = true;
    });

    // Also include waypoints to ensure they are never cut off
    rootNodeIds.forEach(id => {
      const node = nodes[id];
      if (node && node.transform) {
         minX = Math.min(minX, node.transform.x);
         minY = Math.min(minY, node.transform.y);
         maxX = Math.max(maxX, node.transform.x);
         maxY = Math.max(maxY, node.transform.y);
         hasContent = true;
      }
    });
    
    if (!hasContent || minX === Infinity || maxX === -Infinity) return;
    
    // Add 10% padding
    const paddingX = Math.max((maxX - minX) * 0.1, 1.0);
    const paddingY = Math.max((maxY - minY) * 0.1, 1.0);
    minX -= paddingX;
    maxX += paddingX;
    minY -= paddingY;
    maxY += paddingY;
    
    const rect = containerRef.current.getBoundingClientRect();
    const screenW = rect.width || window.innerWidth;
    const screenH = rect.height || window.innerHeight;
    
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    
    if (worldW <= 0 || worldH <= 0) return;
    
    const scaleX = (screenW * 0.9) / worldW;
    const scaleY = (screenH * 0.9) / worldH;
    const newScale = Math.min(scaleX, scaleY);
    
    const clampedScale = Math.max(0.01, Math.min(500, newScale));
    
    const worldCenterX = (minX + maxX) / 2;
    const worldCenterY = (minY + maxY) / 2;
    
    const newPosX = (screenW / 2) - worldCenterX * clampedScale - 400;
    const newPosY = (screenH / 2) + worldCenterY * clampedScale - 400;
    
    setScale(clampedScale);
    setPosition({ x: newPosX, y: newPosY });
  }, [mapLayers]);

  const prevMapCount = useRef(0);
  useEffect(() => {
    if (prevMapCount.current === 0 && mapLayers.length > 0) {
      // Small delay to ensure container has dimensions
      setTimeout(fitToMaps, 50);
    }
    prevMapCount.current = mapLayers.length;
  }, [mapLayers.length, fitToMaps]);

  useEffect(() => {
    if (shouldFitToMaps > 0) {
      fitToMaps();
    }
  }, [shouldFitToMaps, fitToMaps]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    // Middle click or (Left click + Select Mode + Not hovering over node) -> Pan Map
    if (e.button === 1 || (e.button === 0 && activeTool === 'select' && interactionMode.current === 'none')) {
      interactionMode.current = 'pan_map';
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    } 
    // Left click + Add Point Tool -> Create Node and start setting Yaw
    else if (e.button === 0 && activeTool === 'add_point') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);

      const id = uuidv4();
      addNode({
        id,
        type: 'manual',
        transform: { x: worldX, y: worldY, qx: 0, qy: 0, qz: 0, qw: 1 },
        options: {}
      });
      selectNodes([id]);
      
      interactionMode.current = 'set_yaw';
      activeNodeId.current = id;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Left click + Add Generator Tool -> Define interaction input based on active plugin type
    else if (e.button === 0 && activeTool === 'add_generator') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);

      const activePlugin = activePluginId ? plugins[activePluginId] : null;
      const allInputs = activePlugin?.manifest?.inputs || [];
      const hitRadius = 12 / scale;

      // FIRST: Check ALL existing rectangles in pluginInteractionData for handle hits
      //        This works regardless of which activeInputIndex is currently set.
      for (const inp of allInputs) {
        if (inp.type !== 'rectangle') continue;
        const rKey = inp.name || inp.id;
        if (!rKey) continue;
        const existing = useAppStore.getState().pluginInteractionData[rKey];
        if (!existing?.center) continue;

        const { center, width, height, yaw = 0 } = existing;
        const halfW = width / 2;
        const halfH = height / 2;

        // Convert mouse world coordinates to rectangle local space
        const dx = worldX - center.x;
        const dy = worldY - center.y;
        
        // Inverse rotation (by -yaw)
        const localX = dx * Math.cos(-yaw) - dy * Math.sin(-yaw);
        const localY = dx * Math.sin(-yaw) + dy * Math.cos(-yaw);

        // Check rotation handle (above top-center in local space. Y is inverted, so top is -halfH)
        const rotHandleLocalY = -halfH - 20 / scale;
        const rotDx = localX - 0;
        const rotDy = localY - rotHandleLocalY;
        if (Math.sqrt(rotDx * rotDx + rotDy * rotDy) < hitRadius) {
          rectInputKey.current = rKey;
          interactionMode.current = 'set_rect_rotation';
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }

        // Check corners in local space
        const cornersMap: Array<{ cx: number; cy: number; corner: 'min' | 'max' | 'topRight' | 'bottomLeft' }> = [
          { cx: -halfW, cy: -halfH, corner: 'min' },        // top-left in screen space, local -x, -y
          { cx: halfW, cy: halfH, corner: 'max' },          // bottom-right
          { cx: halfW, cy: -halfH, corner: 'topRight' },    // top-right
          { cx: -halfW, cy: halfH, corner: 'bottomLeft' },  // bottom-left
        ];
        
        for (const c of cornersMap) {
          const cdx = localX - c.cx;
          const cdy = localY - c.cy;
          if (Math.sqrt(cdx * cdx + cdy * cdy) < hitRadius) {
            rectInputKey.current = rKey;
            rectDragCorner.current = c.corner;
            interactionMode.current = 'drag_rect_corner';
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      // THEN: Process the current activeInputIndex input for new interactions
      const currentInput = allInputs[activeInputIndex];
      const inputKey = currentInput?.name || currentInput?.id || 'start_point';
      const inputType = currentInput?.type || 'point';

      if (inputType === 'rectangle') {
        // Draw a new rectangle (store the initial click as 'origin' temporarily)
        rectInputKey.current = inputKey;
        useAppStore.getState().updatePluginInteractionData(inputKey, {
          origin: { x: worldX, y: worldY },
          center: { x: worldX, y: worldY },
          width: 0,
          height: 0,
          yaw: 0,
        });
        interactionMode.current = 'draw_rect';
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        // Point input (existing behavior)
        useAppStore.getState().updatePluginInteractionData(inputKey, {
           x: worldX, y: worldY, qx: 0, qy: 0, qz: 0, qw: 1
        });
        interactionMode.current = 'set_yaw_plugin';
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    if (interactionMode.current === 'pan_map') {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } 
    else if (interactionMode.current === 'drag_node' && activeNodeId.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
      
      const node = nodes[activeNodeId.current];
      if (node) {
        updateNode(activeNodeId.current, {
          transform: { 
             x: worldX, 
             y: worldY, 
             z: node.transform?.z, 
             qx: node.transform?.qx || 0, 
             qy: node.transform?.qy || 0, 
             qz: node.transform?.qz || 0, 
             qw: node.transform?.qw ?? 1 
          }
        });
      }
    }
    else if (interactionMode.current === 'set_yaw' && activeNodeId.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
      
      const node = nodes[activeNodeId.current];
      if (node && node.transform) {
        // Calculate angle from node center to mouse cursor
        const dx = worldX - node.transform.x;
        const dy = worldY - node.transform.y;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          const yaw = Math.atan2(dy, dx);
          const halfYaw = yaw / 2.0;
          updateNode(activeNodeId.current, {
            transform: { 
              ...node.transform, 
              qx: 0, 
              qy: 0, 
              qz: Math.sin(halfYaw), 
              qw: Math.cos(halfYaw) 
            }
          });
        }
      }
    }
    else if (interactionMode.current === 'set_yaw_plugin') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
      
      // Find the active point input key
      const activePlugin = activePluginId ? plugins[activePluginId] : null;
      const firstInput = activePlugin?.manifest?.inputs?.[activeInputIndex];
      const inputKey = firstInput?.name || firstInput?.id || 'start_point';
      
      const pData = useAppStore.getState().pluginInteractionData[inputKey];
      if (pData) {
        const dx = worldX - pData.x;
        const dy = worldY - pData.y;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          const yaw = Math.atan2(dy, dx);
          const halfYaw = yaw / 2.0;
          useAppStore.getState().updatePluginInteractionData(inputKey, {
             ...pData,
             qx: 0, qy: 0, qz: Math.sin(halfYaw), qw: Math.cos(halfYaw)
          });
        }
      }
    }
    else if (interactionMode.current === 'draw_rect') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
      
      const key = rectInputKey.current;
      const current = useAppStore.getState().pluginInteractionData[key];
      if (current && current.origin) {
        const ox = current.origin.x;
        const oy = current.origin.y;
        useAppStore.getState().updatePluginInteractionData(key, {
          ...current,
          center: { x: (ox + worldX) / 2, y: (oy + worldY) / 2 },
          width: Math.abs(worldX - ox),
          height: Math.abs(worldY - oy),
          // Yaw stays 0 during initial draw
        });
      }
    }
    else if (interactionMode.current === 'drag_rect_corner') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
      
      const key = rectInputKey.current;
      const current = useAppStore.getState().pluginInteractionData[key];
      if (current && current.center) {
        const corner = rectDragCorner.current;
        const { center, width, height, yaw = 0 } = current;
        const halfW = width / 2;
        const halfH = height / 2;

        // Current corner coordinates in local space BEFORE drag
        let origLocalCx = 0, origLocalCy = 0;
        if (corner === 'min') { origLocalCx = -halfW; origLocalCy = -halfH; }
        else if (corner === 'max') { origLocalCx = halfW; origLocalCy = halfH; }
        else if (corner === 'topRight') { origLocalCx = halfW; origLocalCy = -halfH; }
        else if (corner === 'bottomLeft') { origLocalCx = -halfW; origLocalCy = halfH; }

        // The *opposite* corner remains perfectly fixed during this drag.
        const oppLocalX = -origLocalCx;
        const oppLocalY = -origLocalCy;
        const oppWorldX = center.x + (oppLocalX * Math.cos(yaw) - oppLocalY * Math.sin(yaw));
        const oppWorldY = center.y + (oppLocalX * Math.sin(yaw) + oppLocalY * Math.cos(yaw));

        // Let's project the NEW mouse position into a local space defined relative to the OPPOSITE corner
        const dx = worldX - oppWorldX;
        const dy = worldY - oppWorldY;
        const mouseLocalFromOppX = dx * Math.cos(-yaw) - dy * Math.sin(-yaw);
        const mouseLocalFromOppY = dx * Math.sin(-yaw) + dy * Math.cos(-yaw);

        // The new width and height are just the absolute distance from the opposite corner
        const newWidth = Math.abs(mouseLocalFromOppX);
        const newHeight = Math.abs(mouseLocalFromOppY);

        // The new local center is halfway between the opposite corner and the new mouse position
        const newCenterLocalFromOppX = mouseLocalFromOppX / 2;
        const newCenterLocalFromOppY = mouseLocalFromOppY / 2;

        // Convert the new center back to world coordinates
        const newWorldCx = oppWorldX + (newCenterLocalFromOppX * Math.cos(yaw) - newCenterLocalFromOppY * Math.sin(yaw));
        const newWorldCy = oppWorldY + (newCenterLocalFromOppX * Math.sin(yaw) + newCenterLocalFromOppY * Math.cos(yaw));

        useAppStore.getState().updatePluginInteractionData(key, {
          ...current,
          center: { x: newWorldCx, y: newWorldCy },
          width: newWidth,
          height: newHeight,
        });
      }
    }
    else if (interactionMode.current === 'set_rect_rotation') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
      
      const key = rectInputKey.current;
      const current = useAppStore.getState().pluginInteractionData[key];
      if (current && current.center) {
        const cx = current.center.x;
        const cy = current.center.y;
        const dx = worldX - cx;
        const dy = worldY - cy;
        // Require a tiny bit of drag radius to avoid snapping to 0/0 error
        if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
          // MS Office handle is pointing UP (negative Y in local).
          // We want dragging straight up (dy = -R, dx = 0) to result in yaw = 0.
          // Math.atan2(dy, dx) for straight up is -PI/2.
          // So we offset the angle by PI/2.
          let yaw = Math.atan2(dy, dx) + Math.PI / 2;
          
          useAppStore.getState().updatePluginInteractionData(key, {
            ...current,
            yaw,
          });
        }
      }
    }

  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (interactionMode.current !== 'none') {
      e.currentTarget.releasePointerCapture(e.pointerId);
      interactionMode.current = 'none';
      activeNodeId.current = null;
    } else {
      // If we weren't doing anything else, clicking empty space clears selection
      if (activeTool === 'select') {
        selectNodes([]);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    // Determine cursor position in screen space
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Determine current world coordinates under the cursor
    const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);

    const zoomFactor = -e.deltaY * 0.001;
    // Increase max zoom limit significantly (e.g. from 10 to 500)
    const newScale = Math.max(0.01, Math.min(500, scale * (1 + zoomFactor)));

    // Calculate new position so that the world coordinates stay at the same screen coordinates
    // screenX = worldX * newScale + newPosition.x + 400
    const newPosX = mouseX - worldX * newScale - 400;
    
    // container Y is inverted: screenY = -worldY * newScale + newPosition.y + 400
    // newPosition.y = screenY + worldY * newScale - 400
    const newPosY = mouseY + worldY * newScale - 400;

    setScale(newScale);
    setPosition({ x: newPosX, y: newPosY });
  };

  // Draw coordinate axes
  const drawAxes = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    const axisLength = 50 / scale; // Keep length consistent on screen
    const lineWidth = Math.max(0.5, 2 / scale); // Keep line width consistent on screen

    // X axis (Red)
    g.strokeStyle = { width: lineWidth, color: 0xef4444 };
    g.moveTo(0, 0);
    g.lineTo(axisLength, 0);
    g.stroke();
    // Y axis (Green, moving Y-up in ROS matches Positive Y in inverted container)
    g.strokeStyle = { width: lineWidth, color: 0x22c55e };
    g.moveTo(0, 0);
    g.lineTo(0, axisLength);
    g.stroke();
  }, [scale]);

  const textStyle = useMemo(() => new TextStyle({
    fill: '#ffffff',
    fontSize: 14,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    stroke: { color: '#000000', width: 3 },
    dropShadow: {
      color: '#000000',
      blur: 2,
      distance: 1,
      angle: Math.PI / 4,
      alpha: 1,
    }
  }), []);

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 w-full h-full ${activeTool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { 
        interactionMode.current = 'none';
        activeNodeId.current = null;
      }}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Application preserveDrawingBuffer={true} background="#0f172a" resolution={1} resizeTo={window}>
        {/* Container is explicitly Y-inverted to exactly match ROS coordinates (X right, Y up) */}
        <pixiContainer x={position.x + 400} y={position.y + 400} scale={{ x: scale, y: -scale }}>
          {mapLayers.length > 0 ? (
            mapLayers.map(layer => <MapLayerSprite key={layer.id} layer={layer} />)
          ) : (
            <pixiSprite texture={fallbackTexture} anchor={0.5} scale={{ x: 1, y: -1 }} />
          )}
          {showGrid && <pixiGraphics draw={drawAxes} />}

          {/* Render Path (Lines connecting all waypoints in sequential order, continuous across groups) */}
          {showPaths && (
            <pixiGraphics
              draw={(g) => {
                g.clear();
                
                // Flatten all renderable waypoints in order with their type info
                type PathPoint = { x: number; y: number; isGenerated: boolean };
                const allPoints: PathPoint[] = [];
                
                rootNodeIds.forEach(id => {
                  const node = nodes[id];
                  if (!node) return;
                  if (node.type === 'manual' && node.transform) {
                    allPoints.push({ x: node.transform.x, y: node.transform.y, isGenerated: false });
                  } else if (node.type === 'generator' && node.children_ids) {
                    node.children_ids.forEach(childId => {
                      const child = nodes[childId];
                      if (child && child.transform) {
                        allPoints.push({ x: child.transform.x, y: child.transform.y, isGenerated: true });
                      }
                    });
                  }
                });

                // Draw continuous path with color changes at segment boundaries
                for (let i = 1; i < allPoints.length; i++) {
                  const prev = allPoints[i - 1];
                  const curr = allPoints[i];
                  const segIsGenerated = prev.isGenerated || curr.isGenerated;
                  
                  g.strokeStyle = {
                    width: 2 / scale,
                    color: segIsGenerated ? 0x22c55e : 0x94a3b8,
                    alpha: segIsGenerated ? 0.5 : 0.6
                  };
                  g.moveTo(prev.x, prev.y);
                  g.lineTo(curr.x, curr.y);
                  g.stroke();
                }
              }}
            />
          )}

          {/* Render Waypoints (manual root nodes and children of generator nodes) */}
          {(() => {
            // Collect all renderable waypoint nodes: root manuals + generator children
            const renderableNodes: { node: typeof nodes[string]; parentIsGenerator: boolean; globalIndex: number }[] = [];
            let globalIdx = 0;
            rootNodeIds.forEach(id => {
              const node = nodes[id];
              if (!node) return;
              if (node.type === 'manual' && node.transform) {
                renderableNodes.push({ node, parentIsGenerator: false, globalIndex: globalIdx++ });
              } else if (node.type === 'generator' && node.children_ids) {
                node.children_ids.forEach(childId => {
                  const child = nodes[childId];
                  if (child && child.transform) {
                    renderableNodes.push({ node: child, parentIsGenerator: true, globalIndex: globalIdx++ });
                  }
                });
              }
            });

            return renderableNodes.map(({ node, parentIsGenerator, globalIndex }) => {
              const isSelected = selectedNodeIds.includes(node.id);
              const transform = node.transform!;
              const qx = transform.qx ?? 0;
              const qy = transform.qy ?? 0;
              const qz = transform.qz ?? 0;
              const qw = transform.qw ?? 1;
              let yaw = Math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz));
              if (!isFinite(yaw)) yaw = 0;
              const px = isFinite(transform.x) ? transform.x : 0;
              const py = isFinite(transform.y) ? transform.y : 0;
              const safeScale = Math.max(scale, 0.001);

              // Color: generated children use green, manual uses orange/blue
              const normalColor = parentIsGenerator ? 0x22c55e : 0xffa500;
              const selectedColor = 0x3b82f6;
              const normalFill = parentIsGenerator ? 0x4ade80 : 0xffd700;
              const selectedFill = 0x60a5fa;

              return (
                <pixiGraphics
                  key={node.id}
                  x={px}
                  y={py}
                  rotation={yaw}
                  eventMode="dynamic"
                  cursor={activeTool === 'select' ? 'pointer' : 'default'}
                  onPointerDown={(e: import('pixi.js').FederatedPointerEvent) => {
                    if (activeTool === 'select') {
                      e.stopPropagation();
                      selectNodes([node.id], e.shiftKey || e.metaKey);
                      interactionMode.current = 'drag_node';
                      activeNodeId.current = node.id;
                      if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
                        containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
                      }
                    }
                  }}
                  draw={(g) => {
                    g.clear();
                    g.strokeStyle = { width: 2 / safeScale, color: isSelected ? selectedColor : normalColor };
                    g.fillStyle = { color: isSelected ? selectedFill : normalFill, alpha: 0.8 };
                    g.moveTo(10 / safeScale, 0);
                    g.lineTo(-5 / safeScale, 5 / safeScale);
                    g.lineTo(-5 / safeScale, -5 / safeScale);
                    g.lineTo(10 / safeScale, 0);
                    g.fill();
                    g.stroke();
                    g.circle(0, 0, 3 / safeScale);
                    g.fill();
                  }}
                >
                  {visibleAttributes.length > 0 && (
                    <pixiContainer rotation={-yaw} scale={{ x: 1 / safeScale, y: -1 / safeScale }} x={15 / safeScale} y={-15 / safeScale}>
                      {(() => {
                        const lines: string[] = [];
                        if (visibleAttributes.includes('index')) {
                          lines.push(`Index: [${globalIndex + indexStartIndex}]`);
                        }
                        if (visibleAttributes.includes('transform')) {
                          lines.push(`Transform: (${transform.x.toFixed(2)}, ${transform.y.toFixed(2)}, ${yaw.toFixed(2)})`);
                        }
                        const optionKeys = visibleAttributes.filter(attr => attr.startsWith('options.'));
                        optionKeys.forEach(attr => {
                          const key = attr.split('.')[1];
                          const optDef = optionsSchema?.options?.find(o => o.name === key);
                          let val = node.options?.[key];
                          if (val === undefined && optDef && optDef.default !== undefined) {
                            val = optDef.default;
                          }
                          if (val !== undefined && val !== '') {
                            const displayLabel = optDef?.label || key;
                            lines.push(`${displayLabel}: ${Array.isArray(val) ? `[${val.join(', ')}]` : val}`);
                          }
                        });
                        if (lines.length === 0) return null;
                        return <pixiText text={lines.join('\n')} style={textStyle} anchor={{ x: 0, y: 1 }} />;
                      })()}
                    </pixiContainer>
                  )}
                </pixiGraphics>
              );
            });
          })()}

          {/* Render Active Plugin Interaction Previews (Points + Rectangles) */}
          {(activeTool === 'add_generator' || (selectedNodeIds.length === 1 && nodes[selectedNodeIds[0]]?.type === 'generator')) && Object.entries(pluginInteractionData).map(([key, data]) => {
             if (!data) return null;
             const safeScale = Math.max(scale, 0.001);

             // Rectangle data: uses center, width, height, yaw
             if (data.center && typeof data.width === 'number') {
               const { center, width, height, yaw = 0 } = data;
               if (!isFinite(center.x) || !isFinite(center.y) || !isFinite(width) || !isFinite(height)) return null;
               
               const halfW = width / 2;
               const halfH = height / 2;
               const cornerSize = 6 / safeScale;
               
               const corners = [
                 { cx: -halfW, cy: -halfH, corner: 'min' as const },
                 { cx: halfW, cy: halfH, corner: 'max' as const },
                 { cx: halfW, cy: -halfH, corner: 'topRight' as const },
                 { cx: -halfW, cy: halfH, corner: 'bottomLeft' as const },
               ];
               
               return (
                 <pixiContainer key={`rect-${key}`} x={center.x} y={center.y} rotation={yaw}>
                   {/* Rectangle outline + fill */}
                   <pixiGraphics
                     draw={(g) => {
                       g.clear();
                       // Semi-transparent fill
                       g.fillStyle = { color: 0xec4899, alpha: 0.1 };
                       g.rect(-halfW, -halfH, width, height);
                       g.fill();
                       // Dashed outline via segments
                       g.strokeStyle = { width: 2 / safeScale, color: 0xec4899 };
                       const dashLen = 8 / safeScale;
                       const sides = [
                         [-halfW, -halfH, halfW, -halfH], [halfW, -halfH, halfW, halfH],
                         [halfW, halfH, -halfW, halfH], [-halfW, halfH, -halfW, -halfH],
                       ];
                       sides.forEach(([sx, sy, ex, ey]) => {
                         const dx = ex - sx, dy = ey - sy;
                         const len = Math.sqrt(dx * dx + dy * dy);
                         const nx = dx / len, ny = dy / len;
                         let d = 0;
                         let draw = true;
                         while (d < len) {
                           const segEnd = Math.min(d + dashLen, len);
                           if (draw) {
                             g.moveTo(sx + nx * d, sy + ny * d);
                             g.lineTo(sx + nx * segEnd, sy + ny * segEnd);
                           }
                           d = segEnd;
                           draw = !draw;
                         }
                       });
                       g.stroke();
                     }}
                   />
                   {/* Corner handles */}
                    {corners.map(({ cx, cy, corner }) => (
                     <pixiGraphics
                       key={`corner-${corner}`}
                       x={cx}
                       y={cy}
                       eventMode="dynamic"
                       cursor="grab"
                       onPointerDown={(e: import('pixi.js').FederatedPointerEvent) => {
                         e.stopPropagation();
                         rectInputKey.current = key;
                         rectDragCorner.current = corner;
                         interactionMode.current = 'drag_rect_corner';
                         if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
                           containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
                         }
                       }}
                       draw={(g) => {
                         g.clear();
                         g.fillStyle = { color: 0xffffff, alpha: 0.9 };
                         g.strokeStyle = { width: 1.5 / safeScale, color: 0xec4899 };
                         g.rect(-cornerSize / 2, -cornerSize / 2, cornerSize, cornerSize);
                         g.fill();
                         g.stroke();
                       }}
                     />
                   ))}
                   {/* Rotation handle (MS Office style) - above top-center */}
                   {(() => {
                     const stemLen = 20 / safeScale;
                     const rotHandleY = -halfH - stemLen;
                     const handleR = 5 / safeScale;
                     return (
                       <pixiGraphics
                         x={0}
                         y={rotHandleY}
                         eventMode="dynamic"
                         cursor="grab"
                         onPointerDown={(e: import('pixi.js').FederatedPointerEvent) => {
                           e.stopPropagation();
                           rectInputKey.current = key;
                           interactionMode.current = 'set_rect_rotation';
                           if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
                             containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
                           }
                         }}
                         draw={(g) => {
                           g.clear();
                           // Stem line from rect top-center to handle
                           g.strokeStyle = { width: 1.5 / safeScale, color: 0xec4899 };
                           g.moveTo(0, -stemLen);
                           g.lineTo(0, 0);
                           g.stroke();
                           // Handle circle
                           g.fillStyle = { color: 0xffffff, alpha: 0.9 };
                           g.strokeStyle = { width: 1.5 / safeScale, color: 0xec4899 };
                           g.circle(0, 0, handleR);
                           g.fill();
                           g.stroke();
                           // Circular arrow arc inside handle
                           g.strokeStyle = { width: 1.2 / safeScale, color: 0xec4899 };
                           const arcR = handleR * 0.55;
                           const arcSteps = 10;
                           for (let i = 0; i < arcSteps; i++) {
                             const a1 = -0.3 + (i / arcSteps) * 4.8;
                             const a2 = -0.3 + ((i + 1) / arcSteps) * 4.8;
                             if (i === 0) g.moveTo(Math.cos(a1) * arcR, Math.sin(a1) * arcR);
                             g.lineTo(Math.cos(a2) * arcR, Math.sin(a2) * arcR);
                           }
                           g.stroke();
                           // Arrowhead at end of arc
                           const lastAngle = -0.3 + 4.8;
                           const tipX = Math.cos(lastAngle) * arcR;
                           const tipY = Math.sin(lastAngle) * arcR;
                           const aSize = 2 / safeScale;
                           g.fillStyle = { color: 0xec4899, alpha: 1 };
                           g.moveTo(tipX, tipY);
                           g.lineTo(tipX + aSize, tipY - aSize * 0.5);
                           g.lineTo(tipX - aSize * 0.3, tipY - aSize);
                           g.lineTo(tipX, tipY);
                           g.fill();
                         }}
                       />
                     );
                   })()}
                 </pixiContainer>
               );
             }

             // Point data: has x, y directly
             if (typeof data.x !== 'number' || !isFinite(data.x) || !isFinite(data.y)) return null;
             const pqw = data.qw ?? 1, pqz = data.qz ?? 0, pqx = data.qx ?? 0, pqy = data.qy ?? 0;
             let yaw = Math.atan2(2.0 * (pqw * pqz + pqx * pqy), 1.0 - 2.0 * (pqy * pqy + pqz * pqz));
             if (!isFinite(yaw)) yaw = 0;
             return (
              <pixiGraphics 
                key={key}
                x={data.x}
                y={data.y}
                rotation={yaw}
                draw={(g) => {
                  g.clear();
                  g.strokeStyle = { width: 2 / safeScale, color: 0xec4899 };
                  g.fillStyle = { color: 0xf472b6, alpha: 0.8 };
                  g.moveTo(10 / safeScale, 0);
                  g.lineTo(-5 / safeScale, 5 / safeScale);
                  g.lineTo(-5 / safeScale, -5 / safeScale);
                  g.lineTo(10 / safeScale, 0);
                  g.fill();
                  g.stroke();
                  g.circle(0, 0, 3 / safeScale);
                  g.fill();
                }}
              />
             );
          })}

        </pixiContainer>
      </Application>
    </div>
  );
}
