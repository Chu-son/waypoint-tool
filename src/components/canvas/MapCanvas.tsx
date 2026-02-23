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
  
  const mapLayers = useAppStore(state => state.mapLayers);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const interactionMode = useRef<'none' | 'pan_map' | 'drag_node' | 'set_yaw'>('none');
  const activeNodeId = useRef<string | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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
    const lineWidth = Math.max(0.5, 2 / scale); // Keep line width consistent

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

          {/* Render Path (Lines connecting root nodes in order) */}
          {showPaths && (
            <pixiGraphics
              draw={(g) => {
                g.clear();
                g.strokeStyle = { width: 2 / scale, color: 0x94a3b8, alpha: 0.6 }; // Slate 400
                
                let isFirst = true;
                rootNodeIds.forEach(id => {
                  const node = nodes[id];
                  if (node && node.transform) {
                    if (isFirst) {
                      g.moveTo(node.transform.x, node.transform.y);
                      isFirst = false;
                    } else {
                      g.lineTo(node.transform.x, node.transform.y);
                    }
                  }
                });
                g.stroke();
              }}
            />
          )}

          {/* Render Waypoints */}
          {rootNodeIds.map(id => {
            const node = nodes[id];
            if (!node || node.type !== 'manual' || !node.transform) return null;
            
            const isSelected = selectedNodeIds.includes(node.id);
            const transform = node.transform; // Ensure type safety
            
            // Convert quaternion to yaw
            const qx = transform.qx;
            const qy = transform.qy;
            const qz = transform.qz;
            const qw = transform.qw;
            const yaw = Math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz));
            
            return (
              <pixiGraphics 
                key={node.id}
                x={transform.x}
                y={transform.y}
                rotation={yaw}
                eventMode="dynamic"
                cursor={activeTool === 'select' ? 'pointer' : 'default'}
                onPointerDown={(e: import('pixi.js').FederatedPointerEvent) => {
                  if (activeTool === 'select') {
                    // Start dragging the waypoint
                    e.stopPropagation(); // Avoid triggering pan_map on canvas background
                    selectNodes([node.id], e.shiftKey || e.metaKey);
                    interactionMode.current = 'drag_node';
                    activeNodeId.current = node.id;
                    
                    // Capture pointer on the main wrapper div
                    if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
                       containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
                    }
                  }
                }}
                draw={(g) => {
                  g.clear();
                  // Draw direction indicator (arrow)
                  g.strokeStyle = { width: 2 / scale, color: isSelected ? 0x3b82f6 : 0xffa500 };
                  g.fillStyle = { color: isSelected ? 0x60a5fa : 0xffd700, alpha: 0.8 };
                  g.moveTo(10 / scale, 0);
                  g.lineTo(-5 / scale, 5 / scale);
                  g.lineTo(-5 / scale, -5 / scale);
                  g.lineTo(10 / scale, 0);
                  g.fill();
                  g.stroke();
                  
                  // Central circle
                  g.circle(0, 0, 3 / scale);
                  g.fill();
                }}
              >
                {/* Text Label Container. Un-rotate so text stays readable but un-invert scale so it's not upside down */}
                {visibleAttributes.length > 0 && (
                  <pixiContainer rotation={-yaw} scale={{ x: 1 / scale, y: -1 / scale }} x={15 / scale} y={-15 / scale}>
                    {(() => {
                      const lines: string[] = [];
                      const nodeIndex = rootNodeIds.indexOf(node.id);
                      
                      if (visibleAttributes.includes('index')) {
                        lines.push(`Index: [${nodeIndex >= 0 ? nodeIndex + indexStartIndex : '?'}]`);
                      }
                      if (visibleAttributes.includes('transform')) {
                        lines.push(`Transform: (${transform.x.toFixed(2)}, ${transform.y.toFixed(2)}, ${yaw.toFixed(2)})`);
                      }
                      
                      // Handle custom options
                      const optionKeys = visibleAttributes.filter(attr => attr.startsWith('options.'));
                      optionKeys.forEach(attr => {
                        const key = attr.split('.')[1];
                        const optDef = optionsSchema?.options?.find(o => o.name === key);
                        let val = node.options?.[key];
                        
                        // Fallback to default if undefined
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
          })}
        </pixiContainer>
      </Application>
    </div>
  );
}
