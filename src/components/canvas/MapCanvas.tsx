import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, extend } from '@pixi/react';
import { Container, Sprite, Graphics, Texture, Text, TextStyle } from 'pixi.js';
import { useAppStore } from '../../stores/appStore';
import { BackendAPI } from '../../api';
import { v4 as uuidv4 } from 'uuid';
import { ProjectMapLayer, ManualCustomLayer, PluginCustomLayer, EditObject, WaypointNode } from '../../types/store';
import { GridLayer } from './layers/GridLayer';
import { PathLayer } from './layers/PathLayer';
import { FootprintLayer } from './layers/FootprintLayer';
import { WaypointLayer } from './layers/WaypointLayer';
import { PluginLayer } from './layers/PluginLayer';
import { SnappingGuideLayer } from './layers/SnappingGuideLayer';
import { ExportRegionLayer } from './layers/ExportRegionLayer';
import { MapEditSingleLayer, MapEditToolOverlay } from './layers/MapEditLayer';
import { AnnotationLayer } from './layers/AnnotationLayer';
import { useSnapping } from './hooks/useSnapping';
import { useMapEditRect } from './hooks/useMapEditRect';
import { useMapEditCircle } from './hooks/useMapEditCircle';
import { useMapEditFreehand } from './hooks/useMapEditFreehand';
import { useMapEditLine } from './hooks/useMapEditLine';
import { useAnnotationEdit } from './hooks/useAnnotationEdit';
import { prepareLayersForExport } from '../../utils/mapRasterize';
import { computePointsBoundingBox } from '../../utils/geometry';
import { resolveThemeVariables } from '../../utils/themePresets';
import { hexStringToNumber, hexStringToVec3 } from '../../utils/colorUtils';
import { getPrecedingManualWaypoint } from '../../utils/treeUtils';

import { OccupancyHighlightFilter } from './filters/OccupancyHighlightFilter';

extend({
  Container,
  Sprite,
  Graphics,
  Text,
});

export function MapLayerSprite({ layer, scale, textStyle, overrideTexture }: { layer: ProjectMapLayer | PluginCustomLayer | any, scale: number, textStyle: TextStyle, overrideTexture?: Texture | null }) {
  const [texture, setTexture] = useState<Texture | null>(overrideTexture || null);
  const [imgSize, setImgSize] = useState({ w: overrideTexture ? overrideTexture.width : 0, h: overrideTexture ? overrideTexture.height : 0 });
  const showOccupancyHighlight = useAppStore((state) => state.showOccupancyHighlight);
  const occupancyHighlightAlpha = useAppStore((state) => state.occupancyHighlightAlpha);
  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);

  const occThresh = layer.info?.occupied_thresh ?? 0.65;
  const freeThresh = layer.info?.free_thresh ?? 0.25;
  const negate = layer.info?.negate ?? 0;

  const resolvedTheme = useMemo(() => {
    return resolveThemeVariables(isCustomUiMode && customUiConfig ? customUiConfig.theme : undefined);
  }, [isCustomUiMode, customUiConfig]);

  const freeColorVec = useMemo(() => hexStringToVec3(resolvedTheme.variables['--color-occupancy-free'], [0.0627, 0.7255, 0.5059]), [resolvedTheme]);
  const obstacleColorVec = useMemo(() => hexStringToVec3(resolvedTheme.variables['--color-occupancy-obstacle'], [0.9373, 0.2667, 0.2667]), [resolvedTheme]);
  const unknownColorVec = useMemo(() => hexStringToVec3(resolvedTheme.variables['--color-occupancy-unknown'], [0.6588, 0.3333, 0.9686]), [resolvedTheme]);

  const highlightFilter = useMemo(() => {
    if (!showOccupancyHighlight) return null;
    try {
      return new OccupancyHighlightFilter({
        occupiedThresh: occThresh,
        freeThresh: freeThresh,
        negate: negate,
        alpha: occupancyHighlightAlpha,
        freeColor: freeColorVec,
        obstacleColor: obstacleColorVec,
        unknownColor: unknownColorVec,
      });
    } catch {
      return null;
    }
  }, [showOccupancyHighlight, freeColorVec, obstacleColorVec, unknownColorVec]);

  useEffect(() => {
    if (highlightFilter) {
      highlightFilter.updateUniforms({
        occupiedThresh: occThresh,
        freeThresh: freeThresh,
        negate: negate,
        alpha: occupancyHighlightAlpha,
        freeColor: freeColorVec,
        obstacleColor: obstacleColorVec,
        unknownColor: unknownColorVec,
      });
    }
  }, [highlightFilter, occThresh, freeThresh, negate, occupancyHighlightAlpha, freeColorVec, obstacleColorVec, unknownColorVec]);

  useEffect(() => {
    return () => {
      if (highlightFilter && !highlightFilter.destroyed) {
        highlightFilter.destroy();
      }
    };
  }, [highlightFilter]);

  useEffect(() => {
    if (overrideTexture) {
      setTexture(overrideTexture);
      setImgSize({ w: overrideTexture.width, h: overrideTexture.height });
      return;
    }
    let cancelled = false;
    if (layer.image_base64) {
      const src = layer.image_base64.startsWith('data:')
        ? layer.image_base64
        : `data:image/png;base64,${layer.image_base64}`;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const newTexture = Texture.from(img);
        setTexture(newTexture);
        setImgSize({ w: img.width, h: img.height });
      };
      img.onerror = (err) => {
        console.error(`[MapLayerSprite] Failed to load image for layer "${layer.name}":`, err);
      };
      img.src = src;
    }
    return () => {
      cancelled = true;
    };
  }, [layer.image_base64, layer.name, overrideTexture]);

  // Clean up the previous texture safely without nulling shared TextureSource style
  useEffect(() => {
    return () => {
      if (texture && !texture.destroyed && !overrideTexture) {
        texture.destroy(false);
      }
    };
  }, [texture, overrideTexture]);

  if (
    !texture ||
    texture.destroyed ||
    !texture.source ||
    texture.source.destroyed ||
    !texture.source.style ||
    !layer.visible
  ) {
    return null;
  }
  
  // Extract metadata (with safe fallbacks)
  const { resolution = 0.05, origin = [0, 0, 0] } = layer.info || {};
  const [ox, oy, oyaw] = origin;
  const yaw = oyaw || 0;

  // Render the map aligned to ROS origin
  // Anchor [0, 1] means the bottom-left of the image maps to the exact (ox, oy).
  // Y scale is inverted so that the image draws right-side up inside the Y-inverted Pixi Container.
  // Top-left Y calculation: Origin is bottom-left, so we add height * resolution
  // We must also account for the map's yaw rotation (yaw).
  const h = imgSize.h || (texture ? texture.height : 0) || ('height' in layer ? layer.height : layer.info?.height) || 0;
  const H = h * resolution;
  const topLeftX = ox - H * Math.sin(yaw);
  const topLeftY = oy + H * Math.cos(yaw);

  return (
    <pixiContainer>
      <pixiSprite 
        key={texture.uid || layer.id}
        texture={texture} 
        anchor={{ x: 0, y: 1 }} 
        x={ox} 
        y={oy} 
        rotation={yaw}
        scale={{ x: resolution, y: -resolution }}
        alpha={layer.opacity} 
        filters={highlightFilter ? [highlightFilter] : undefined}
      />
      {/* Top-Left Map Layer Name */}
      <pixiContainer
        x={topLeftX}
        y={topLeftY}
        scale={{ x: 1 / scale, y: -1 / scale }}
      >
        <pixiText
          text={layer.name || 'Map Layer'}
          style={textStyle}
          anchor={{ x: 0, y: 1 }}
          x={4}
          y={-4}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export function MapCanvas() {
  const activeTool = useAppStore(state => state.activeTool);
  const addNode = useAppStore(state => state.addNode);
  const selectNodes = useAppStore(state => state.selectNodes);
  const nodes = useAppStore(state => state.nodes);
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const insertionTarget = useAppStore(state => state.insertionTarget);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const updateNode = useAppStore(state => state.updateNode);
  const updateNodes = useAppStore(state => state.updateNodes);

  const showPaths = useAppStore((state) => state.showPaths);
  const showGrid = useAppStore((state) => state.showGrid);

  const shouldFitToMaps = useAppStore(state => state.shouldFitToMaps);

  const activePluginId = useAppStore(state => state.activePluginId);
  const triggerFitToMaps = useAppStore(state => state.triggerFitToMaps);
  const plugins = useAppStore(state => state.plugins);

  const activeInputIndex = useAppStore(state => state.activeInputIndex);
  const setCursorPosition = useAppStore(state => state.setCursorPosition);
  const setMapScale = useAppStore(state => state.setMapScale);
  
  const mapLayers = useAppStore(state => state.mapLayers);
  const customLayers = useAppStore(state => state.customLayers) || [];
  const enableSnapping = useAppStore(state => state.enableSnapping);
  const isExportPreview = useAppStore(state => state.isExportPreview);

  const isMapEditMode = useAppStore(state => state.isMapEditMode);
  const mapEditSubTool = useAppStore(state => state.mapEditSubTool);
  const selectedEditObjectId = useAppStore(state => state.selectedEditObjectId);
  const setSelectedEditObjectId = useAppStore(state => state.setSelectedEditObjectId);
  const setActiveCustomLayerId = useAppStore(state => state.setActiveCustomLayerId);
  const updateEditObject = useAppStore(state => state.updateEditObject);

  const [previewTexture, setPreviewTexture] = useState<Texture | null>(null);
  const [previewInfo, setPreviewInfo] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    let worldX = (screenX - (position.x + 400)) / scale;
    let worldY = ((position.y + 400) - screenY) / scale;
    return { x: worldX, y: worldY };
  }, [position, scale]);

  const occupancySettings = useAppStore((state) => state.occupancySettings);
  const showOccupancyHighlight = useAppStore((state) => state.showOccupancyHighlight);
  const shouldShowBlendedPreview = isExportPreview || showOccupancyHighlight;

  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);

  const resolvedTheme = useMemo(() => {
    return resolveThemeVariables(isCustomUiMode && customUiConfig ? customUiConfig.theme : undefined);
  }, [isCustomUiMode, customUiConfig]);

  const canvasBackgroundColor = useMemo(() => {
    const surfaceBaseHex = resolvedTheme.variables['--color-surface-base'] || '#0f172a';
    return hexStringToNumber(surfaceBaseHex, 0x0f172a);
  }, [resolvedTheme]);

  // blend_mode, z_index, visible, image_base64, customLayers, occupancySettings の変更キーを生成
  const previewSyncKey = useMemo(() => {
    const mapKey = JSON.stringify(
      mapLayers.map(l => ({
        id: l.id,
        blend_mode: l.blend_mode || 'overwrite',
        z_index: l.z_index,
        visible: l.visible,
        hasImage: !!l.image_base64,
        info: l.info,
      }))
    );
    const customKey = JSON.stringify(
      customLayers.map(l => ({
        id: l.id,
        type: l.type,
        visible: l.visible,
        is_reference: l.is_reference || false,
        z_index: l.z_index,
        blend_mode: l.blend_mode || 'overwrite',
        objCount: l.type === 'manual' ? l.editObjects.length : 0,
        editObjects: l.type === 'manual' ? l.editObjects : undefined,
        hasImage: l.type === 'plugin' ? !!l.image_base64 : false,
      }))
    );
    const occKey = JSON.stringify(occupancySettings);
    return `${shouldShowBlendedPreview}::${mapKey}::${customKey}::${occKey}`;
  }, [shouldShowBlendedPreview, mapLayers, customLayers, occupancySettings]);

  const startLoading = useAppStore(state => state.startLoading);
  const stopLoading = useAppStore(state => state.stopLoading);

  useEffect(() => {
    if (!shouldShowBlendedPreview) {
      setPreviewTexture(null);
      stopLoading('blended-preview');
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    startLoading({
      id: 'blended-preview',
      message: isExportPreview ? 'エクスポートプレビューを生成中...' : '占有状態プレビューを生成中...',
      blocking: true,
    });
    setPreviewError(null);

    prepareLayersForExport(mapLayers, customLayers).then(layerInputs => {
      if (cancelled) return null;
      if (!layerInputs || layerInputs.length === 0) return null;
      return BackendAPI.blendMapPreview(layerInputs);
    }).then(result => {
      if (cancelled || !result) {
        stopLoading('blended-preview');
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const texture = Texture.from(img);
        setPreviewTexture(texture);
        setPreviewInfo({
          resolution: result.resolution,
          origin: result.origin,
          occupied_thresh: occupancySettings.defaultOccupiedThresh,
          free_thresh: occupancySettings.defaultFreeThresh,
          negate: occupancySettings.defaultNegate,
        });
        stopLoading('blended-preview');
      };
      img.onerror = () => {
        if (cancelled) return;
        setPreviewError('Failed to load image texture from base64.');
        stopLoading('blended-preview');
      };
      img.src = result.image_data_b64;
    }).catch(err => {
      if (cancelled) return;
      console.error('[Blend Preview] Blend Preview failed:', err);
      setPreviewError(String(err));
      stopLoading('blended-preview');
    });

    return () => {
      cancelled = true;
      stopLoading('blended-preview');
    };
  }, [shouldShowBlendedPreview, previewSyncKey, mapLayers, customLayers, occupancySettings, isExportPreview, startLoading, stopLoading]);

  useEffect(() => {
    return () => {
      if (previewTexture && !previewTexture.destroyed) {
        previewTexture.destroy(false);
      }
    };
  }, [previewTexture]);

  const interactionMode = useRef<'none' | 'pan_map' | 'drag_node' | 'set_yaw' | 'set_yaw_plugin' | 'draw_rect' | 'drag_rect_corner' | 'set_rect_rotation' | 'draw_export_region' | 'move_export_region' | 'resize_export_region' | 'drag_points_item' | 'set_yaw_points_item'>('none');
  const lastMiddleClickTime = useRef<number>(0);
  const activeNodeId = useRef<string | null>(null);
  const movingNodesState = useRef<{
    activeId: string;
    startWorldPos: { x: number; y: number };
    initialTransforms: Record<string, { x: number; y: number; z?: number; qx: number; qy: number; qz: number; qw: number }>;
  } | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const latestMousePos = useRef({ x: 0, y: 0 }); // Track screen mouse pos constantly
  const containerRef = useRef<HTMLDivElement>(null);
  const rectInputKey = useRef<string>('');  // The input ID being drawn (e.g. 'sweep_rect')
  const rectDragCorner = useRef<'min' | 'max' | 'topRight' | 'bottomLeft' | 'nw'|'ne'|'sw'|'se'|'n'|'s'|'e'|'w'>('max');
  const pointsInputKey = useRef<string>('');
  const pointsItemIndex = useRef<number>(-1);
  const regionDragOffset = useRef({ x: 0, y: 0 });

  const { snapInput, snapState, setSnapState, applySnapping, useSnappingKeyboardEvents, getRenderableNodesList } = useSnapping({ scale, enableSnapping });
  useSnappingKeyboardEvents(interactionMode, activeNodeId);

  // Map Edit hooks
  const {
    rectPreview,
    handleRectDrawStart,
    handleRectDrawMove,
    handleRectDrawEnd,
    handleRotateStart,
    handleRotateMove,
    handleRotateEnd,
  } = useMapEditRect();

  const {
    circlePreview,
    handleCircleDrawStart,
    handleCircleDrawMove,
    handleCircleDrawEnd,
  } = useMapEditCircle();

  const {
    freehandPreview,
    brushPreviewPos,
    brushRadiusWorld,
    setBrushPreviewPos,
    handleFreehandDrawStart,
    handleFreehandDrawMove,
    handleFreehandDrawEnd,
  } = useMapEditFreehand();

  const {
    linePreview,
    handleLineDrawStart,
    handleLineDrawMove,
    handleLineDrawEnd,
  } = useMapEditLine();

  // Annotation Edit hooks & state
  const isAnnotationEditMode = useAppStore((state) => state.isAnnotationEditMode);
  const activeAnnotationSubTool = useAppStore((state) => state.activeAnnotationSubTool);
  const selectAnnotationObjects = useAppStore((state) => state.selectAnnotationObjects);
  const clearAnnotationSelection = useAppStore((state) => state.clearAnnotationSelection);

  const {
    annotationPreview,
    handleAnnotationDrawStart,
    handleAnnotationDrawMove,
    handleAnnotationDrawEnd,
    handleStartMoveAnnotation,
    handleMoveAnnotationMove,
    handleMoveAnnotationEnd,
    handleStartTransformAnnotation,
    handleTransformAnnotationMove,
    handleTransformAnnotationEnd,
  } = useAnnotationEdit();

  const handleAnnotationPointerDown = useCallback(
    (e: import('pixi.js').FederatedPointerEvent, id: string) => {
      if (useAppStore.getState().isMapEditMode) return;
      e.stopPropagation();
      selectAnnotationObjects([id], (e.nativeEvent as any)?.shiftKey || (e.nativeEvent as any)?.metaKey);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && e.nativeEvent instanceof PointerEvent) {
        const mouseX = e.nativeEvent.clientX - rect.left;
        const mouseY = e.nativeEvent.clientY - rect.top;
        const worldPos = screenToWorld(mouseX, mouseY);
        handleStartMoveAnnotation(id, worldPos);
        interactionMode.current = 'move_annotation' as any;
        containerRef.current?.setPointerCapture(e.nativeEvent.pointerId);
      }
    },
    [selectAnnotationObjects, screenToWorld, handleStartMoveAnnotation]
  );

  const handleAnnotationHandlePointerDown = useCallback(
    (e: import('pixi.js').FederatedPointerEvent, id: string, handleType: string) => {
      if (useAppStore.getState().isMapEditMode) return;
      e.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && e.nativeEvent instanceof PointerEvent) {
        const mouseX = e.nativeEvent.clientX - rect.left;
        const mouseY = e.nativeEvent.clientY - rect.top;
        const worldPos = screenToWorld(mouseX, mouseY);
        handleStartTransformAnnotation(id, handleType, worldPos);
        interactionMode.current = 'transform_annotation' as any;
        containerRef.current?.setPointerCapture(e.nativeEvent.pointerId);
      }
    },
    [screenToWorld, handleStartTransformAnnotation]
  );

  const movingEditObject = useRef<{
    layerId: string;
    objId: string;
    startWorldPos: { x: number; y: number };
    initialCenterOrPoints: any;
  } | null>(null);

  const resizingEditObject = useRef<{
    layerId: string;
    objId: string;
    handle: string;
    initialObject: EditObject;
    startWorldPos: { x: number; y: number };
  } | null>(null);

  const handleEditObjectPointerDown = useCallback(
    (e: import('pixi.js').FederatedPointerEvent, layerId: string, objId: string) => {
      if (!useAppStore.getState().isMapEditMode) return;
      e.stopPropagation();
      setSelectedEditObjectId(objId);
      setActiveCustomLayerId(layerId);

      const targetLayer = useAppStore.getState().customLayers.find((l) => l.id === layerId && l.type === 'manual') as ManualCustomLayer | undefined;
      const targetObj = targetLayer?.editObjects.find((o) => o.id === objId);
      if (!targetObj) return;

      const screenX = e.nativeEvent.clientX;
      const screenY = e.nativeEvent.clientY;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldPos = screenToWorld(screenX - rect.left, screenY - rect.top);

      movingEditObject.current = {
        layerId,
        objId,
        startWorldPos: worldPos,
        initialCenterOrPoints: structuredClone(
          targetObj.type === 'freehand'
            ? targetObj.points
            : targetObj.type === 'line'
            ? { x1: targetObj.x1, y1: targetObj.y1, x2: targetObj.x2, y2: targetObj.y2 }
            : { cx: targetObj.cx, cy: targetObj.cy }
        ),
      };

      interactionMode.current = 'edit_map_move_object' as any;
      useAppStore.getState().beginHistoryTransaction();
      if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
        containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
      }
    },
    [setSelectedEditObjectId, setActiveCustomLayerId, screenToWorld]
  );

  const handleEditObjectHandlePointerDown = useCallback(
    (e: import('pixi.js').FederatedPointerEvent, layerId: string, objId: string) => {
      if (!useAppStore.getState().isMapEditMode) return;
      e.stopPropagation();
      const targetLayer = useAppStore.getState().customLayers.find((l) => l.id === layerId && l.type === 'manual') as ManualCustomLayer | undefined;
      const targetObj = targetLayer?.editObjects.find((o) => o.id === objId);
      if (!targetObj || targetObj.type !== 'rect') return;

      handleRotateStart(layerId, objId, { cx: targetObj.cx, cy: targetObj.cy });
      interactionMode.current = 'edit_map_set_rect_rotation' as any;
      if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
        containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
      }
    },
    [handleRotateStart]
  );

  const handleEditObjectResizeHandlePointerDown = useCallback(
    (e: import('pixi.js').FederatedPointerEvent, layerId: string, objId: string, handle: string) => {
      if (!useAppStore.getState().isMapEditMode) return;
      e.stopPropagation();
      const targetLayer = useAppStore.getState().customLayers.find((l) => l.id === layerId && l.type === 'manual') as ManualCustomLayer | undefined;
      const targetObj = targetLayer?.editObjects.find((o) => o.id === objId);
      if (!targetObj) return;

      const screenX = e.nativeEvent.clientX;
      const screenY = e.nativeEvent.clientY;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldPos = screenToWorld(screenX - rect.left, screenY - rect.top);

      resizingEditObject.current = {
        layerId,
        objId,
        handle,
        initialObject: structuredClone(targetObj),
        startWorldPos: worldPos,
      };

      interactionMode.current = 'edit_map_resize_object' as any;
      useAppStore.getState().beginHistoryTransaction();
      if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
        containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
      }
    },
    [screenToWorld]
  );

  // Fallback grid texture if no maps are loaded
  const fallbackTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const bg = resolvedTheme.variables['--color-surface-panel'] || '#1e293b';
      const grid = resolvedTheme.variables['--color-border-base'] || '#334155';
      const text = resolvedTheme.variables['--color-text-muted'] || '#94a3b8';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.strokeStyle = grid;
      for (let i = 0; i < 100; i += 50) {
        ctx.beginPath(); ctx.moveTo(i * 10, 0); ctx.lineTo(i * 10, 1000); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * 10); ctx.lineTo(1000, i * 10); ctx.stroke();
      }
      ctx.fillStyle = text;
      ctx.font = '24px Arial';
      ctx.fillText('No Map Loaded. Use Load Map button.', 50, 50);
    }
    return Texture.from(canvas);
  }, [resolvedTheme]);

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
    setMapScale(clampedScale);
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

    if (isMapEditMode) {
      if (e.button === 1) {
        // Middle click = Pan map
        interactionMode.current = 'pan_map';
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (e.button === 0 && interactionMode.current === 'none') {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = screenToWorld(mouseX, mouseY);

        if (mapEditSubTool === 'rect') {
          handleRectDrawStart(worldPos);
          interactionMode.current = 'edit_map_draw_rect' as any;
        } else if (mapEditSubTool === 'circle') {
          handleCircleDrawStart(worldPos);
          interactionMode.current = 'edit_map_draw_circle' as any;
        } else if (mapEditSubTool === 'freehand') {
          handleFreehandDrawStart(worldPos);
          interactionMode.current = 'edit_map_freehand' as any;
        } else if (mapEditSubTool === 'line') {
          handleLineDrawStart(worldPos);
          interactionMode.current = 'edit_map_draw_line' as any;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      return;
    }

    if (isAnnotationEditMode) {
      if (e.button === 1) {
        interactionMode.current = 'pan_map';
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (e.button === 0 && interactionMode.current === 'none') {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = screenToWorld(mouseX, mouseY);

        if (activeAnnotationSubTool !== 'select') {
          handleAnnotationDrawStart(worldPos);
          interactionMode.current = 'draw_annotation' as any;
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        } else {
          interactionMode.current = 'pan_map';
          lastMousePos.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
          clearAnnotationSelection();
          return;
        }
      }
      return;
    }
    
    // Left click + Select Tool + Generator node selected -> Check rectangle handle hits FIRST (before pan_map)
    if (e.button === 0 && activeTool === 'select' && selectedNodeIds.length === 1 && nodes[selectedNodeIds[0]]?.type === 'generator') {
      const selectedNode = nodes[selectedNodeIds[0]];
      const genPluginId = selectedNode.plugin_id || '';
      const genPlugin = plugins[genPluginId];
      const genInputs = genPlugin?.manifest?.inputs || [];
      
      if (genInputs.some((inp: any) => inp.type === 'rectangle')) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
        const hitRadius = 12 / scale;
        
        for (const inp of genInputs) {
          if (inp.type !== 'rectangle') continue;
          const rKey = inp.name || inp.id;
          if (!rKey) continue;
          const existing = useAppStore.getState().pluginInteractionData[rKey];
          if (!existing?.center) continue;
          
          const { center, width, height, yaw = 0 } = existing;
          const halfW = width / 2;
          const halfH = height / 2;
          
          const dx = worldX - center.x;
          const dy = worldY - center.y;
          const localX = dx * Math.cos(-yaw) - dy * Math.sin(-yaw);
          const localY = dx * Math.sin(-yaw) + dy * Math.cos(-yaw);
          
          // Check rotation handle
          const rotHandleLocalY = halfH + 20 / scale;
          const rotDx = localX;
          const rotDy = localY - rotHandleLocalY;
          if (Math.sqrt(rotDx * rotDx + rotDy * rotDy) < hitRadius) {
            rectInputKey.current = rKey;
            interactionMode.current = 'set_rect_rotation';
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          
          // Check corners
          const cornersMap: Array<{ cx: number; cy: number; corner: 'min' | 'max' | 'topRight' | 'bottomLeft' }> = [
            { cx: -halfW, cy: halfH, corner: 'min' },
            { cx: halfW, cy: -halfH, corner: 'max' },
            { cx: halfW, cy: halfH, corner: 'topRight' },
            { cx: -halfW, cy: -halfH, corner: 'bottomLeft' },
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
      }
    }

    // Double click on middle button (wheel) -> Fit to Maps
    if (e.button === 1) {
      const now = Date.now();
      if (now - lastMiddleClickTime.current < 300) {
        triggerFitToMaps();
        lastMiddleClickTime.current = 0;
        return;
      }
      lastMiddleClickTime.current = now;
    }

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
      useAppStore.getState().beginHistoryTransaction();
      addNode({
        id,
        type: 'manual',
        transform: { x: worldX, y: worldY, qx: 0, qy: 0, qz: 0, qw: 1 },
        options: {}
      }, undefined, { skipRecalculate: true });
      selectNodes([id]);
      
      interactionMode.current = 'set_yaw';
      activeNodeId.current = id;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Left click + Add Export Region Tool
    else if (e.button === 0 && activeTool === 'add_export_region' && interactionMode.current === 'none') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);

      const id = uuidv4();
      
      // Default select all visible map layers
      const layerVisibility: Record<string, boolean> = {};
      useAppStore.getState().mapLayers.forEach(layer => {
        if (layer.visible) {
          layerVisibility[layer.id] = true;
        }
      });

      useAppStore.getState().addExportRegion({
        id,
        name: `Region ${useAppStore.getState().exportRegions.length + 1}`,
        rect: { x: worldX, y: worldY, width: 0, height: 0 },
        visible: true,
        layerVisibility
      });

      interactionMode.current = 'draw_export_region';
      activeNodeId.current = id; // Store the ID we're currently drawing
      // We will need to store origin to compute proper width/height. We can use pluginInteractionData temporarily or another ref.
      useAppStore.getState().updatePluginInteractionData('__export_region_origin', { x: worldX, y: worldY });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Click (Left or Right) + Add Generator Tool -> Define interaction input based on active plugin type
    else if ((e.button === 0 || e.button === 2) && activeTool === 'add_generator') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);

      const activePlugin = activePluginId ? plugins[activePluginId] : null;
      const allInputs = activePlugin?.manifest?.inputs || [];
      const hitRadius = 12 / scale;

      // FIRST: Check ALL existing rectangles in pluginInteractionData for handle hits (Left-click only)
      if (e.button === 0) {
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

          // Check rotation handle (above top of rect on screen = +halfH in Y-up world)
          const rotHandleLocalY = halfH + 20 / scale;
          const rotDx = localX - 0;
          const rotDy = localY - rotHandleLocalY;
          if (Math.sqrt(rotDx * rotDx + rotDy * rotDy) < hitRadius) {
            rectInputKey.current = rKey;
            interactionMode.current = 'set_rect_rotation';
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }

          // Check corners in local space (Y-up: +Y = screen top)
          const cornersMap: Array<{ cx: number; cy: number; corner: 'min' | 'max' | 'topRight' | 'bottomLeft' }> = [
            { cx: -halfW, cy: halfH, corner: 'min' },         // top-left on screen
            { cx: halfW, cy: -halfH, corner: 'max' },         // bottom-right on screen
            { cx: halfW, cy: halfH, corner: 'topRight' },     // top-right on screen
            { cx: -halfW, cy: -halfH, corner: 'bottomLeft' }, // bottom-left on screen
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
      }

      // SECOND: Check ALL existing points in pluginInteractionData for point hits (Move on Left, Remove on Right)
      for (const inp of allInputs) {
        if (inp.type !== 'points' && inp.type !== 'point_list') continue;
        const pKey = inp.name || inp.id;
        if (!pKey) continue;
        const rawList = useAppStore.getState().pluginInteractionData[pKey];
        if (!Array.isArray(rawList)) continue;

        for (let i = 0; i < rawList.length; i++) {
          const pt = rawList[i];
          if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') continue;
          const dx = worldX - pt.x;
          const dy = worldY - pt.y;
          if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
            if (e.button === 2) {
              // Right click -> Remove this point
              e.preventDefault();
              const next = rawList.filter((_, idx) => idx !== i);
              useAppStore.getState().updatePluginInteractionData(pKey, next);
              return;
            } else if (e.button === 0) {
              // Left click -> Drag this point
              pointsInputKey.current = pKey;
              pointsItemIndex.current = i;
              interactionMode.current = 'drag_points_item';
              e.currentTarget.setPointerCapture(e.pointerId);
              return;
            }
          }
        }
      }

      if (e.button === 2) {
        // Right click not on any point: do nothing
        return;
      }

      // THEN: Process the current activeInputIndex input for new interactions (Left click only)
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
      } else if (inputType === 'points' || inputType === 'point_list') {
        // Add a new point to the points list
        const rawList = useAppStore.getState().pluginInteractionData[inputKey];
        const currentList = Array.isArray(rawList) ? [...rawList] : [];
        const maxPoints = currentInput.max_points ?? 50;

        if (currentList.length < maxPoints) {
          const newPoint = {
            id: uuidv4(),
            x: worldX,
            y: worldY,
            qx: 0,
            qy: 0,
            qz: 0,
            qw: 1,
          };
          currentList.push(newPoint);
          useAppStore.getState().updatePluginInteractionData(inputKey, currentList);

          pointsInputKey.current = inputKey;
          pointsItemIndex.current = currentList.length - 1;
          interactionMode.current = currentInput.allow_yaw ? 'set_yaw_points_item' : 'drag_points_item';
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } else {
        // Single Point input (existing behavior)
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

    // Track cursor position globally
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    latestMousePos.current = { x: mouseX, y: mouseY };
    let { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
    
    // Snapping logic
    const list = getRenderableNodesList();
    let currentLockedId = snapState.lockedWaypointId;

    if (activeTool === 'add_point' && !currentLockedId && interactionMode.current === 'none') {
       const precedingNode = getPrecedingManualWaypoint(rootNodeIds, nodes, insertionTarget);
       if (precedingNode) currentLockedId = precedingNode.id;
    }

    const hoverRadius = 30 / scale;
    let closestId = currentLockedId;
    let minDist = Infinity;
    
    for (const item of list) {
      if (!item.node.transform) continue;
      if (interactionMode.current === 'drag_node' && item.id === activeNodeId.current) continue;
      const dist = Math.hypot(item.node.transform.x - worldX, item.node.transform.y - worldY);
      if (dist < hoverRadius && dist < minDist) {
        minDist = dist;
        closestId = item.id;
      }
    }

    if (closestId !== currentLockedId) {
       currentLockedId = closestId;
    }

    const lockedNode = currentLockedId ? list.find(r => r.id === currentLockedId)?.node : null;
    const prev = lockedNode?.transform || null;

    if (activeTool === 'add_point' && interactionMode.current === 'none') {
       const snapped = applySnapping(worldX, worldY, prev, currentLockedId);
       worldX = snapped.x;
       worldY = snapped.y;
    } else if (interactionMode.current === 'drag_node') {
       const snapped = applySnapping(worldX, worldY, prev, currentLockedId);
       worldX = snapped.x;
       worldY = snapped.y;
    } else {
       if (snapState.isSnapped) {
          setSnapState(prev => ({ ...prev, isSnapped: false, axis: null, origin: null, snappedWorldPos: null }));
       }
    }

    setCursorPosition({ x: worldX, y: worldY });

    if (isMapEditMode) {
      setBrushPreviewPos({ x: worldX, y: worldY });
      if (interactionMode.current === 'pan_map') {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        return;
      }
      if (interactionMode.current === ('edit_map_draw_rect' as any)) {
        handleRectDrawMove({ x: worldX, y: worldY });
        return;
      }
      if (interactionMode.current === ('edit_map_set_rect_rotation' as any)) {
        handleRotateMove({ x: worldX, y: worldY });
        return;
      }
      if (interactionMode.current === ('edit_map_draw_circle' as any)) {
        handleCircleDrawMove({ x: worldX, y: worldY });
        return;
      }
      if (interactionMode.current === ('edit_map_freehand' as any)) {
        handleFreehandDrawMove({ x: worldX, y: worldY });
        return;
      }
      if (interactionMode.current === ('edit_map_draw_line' as any)) {
        handleLineDrawMove({ x: worldX, y: worldY });
        return;
      }
      if (interactionMode.current === ('edit_map_move_object' as any) && movingEditObject.current) {
        const { layerId, objId, startWorldPos, initialCenterOrPoints } = movingEditObject.current;
        const dx = worldX - startWorldPos.x;
        const dy = worldY - startWorldPos.y;

        if (Array.isArray(initialCenterOrPoints)) {
          const newPoints = initialCenterOrPoints.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
          updateEditObject(layerId, objId, { points: newPoints });
        } else if ('x1' in initialCenterOrPoints) {
          updateEditObject(layerId, objId, {
            x1: initialCenterOrPoints.x1 + dx,
            y1: initialCenterOrPoints.y1 + dy,
            x2: initialCenterOrPoints.x2 + dx,
            y2: initialCenterOrPoints.y2 + dy,
          });
        } else {
          updateEditObject(layerId, objId, {
            cx: initialCenterOrPoints.cx + dx,
            cy: initialCenterOrPoints.cy + dy,
          });
        }
        return;
      }
      if (interactionMode.current === ('edit_map_resize_object' as any) && resizingEditObject.current) {
        const { layerId, objId, handle, initialObject, startWorldPos } = resizingEditObject.current;
        const curWorldPos = { x: worldX, y: worldY };

        if (initialObject.type === 'rect') {
          const dx = curWorldPos.x - initialObject.cx;
          const dy = curWorldPos.y - initialObject.cy;

          const cos = Math.cos(-initialObject.angle);
          const sin = Math.sin(-initialObject.angle);
          const localDx = dx * cos - dy * sin;
          const localDy = dx * sin + dy * cos;

          const newWidth = Math.max(0.05, Math.abs(localDx) * 2);
          const newHeight = Math.max(0.05, Math.abs(localDy) * 2);

          updateEditObject(layerId, objId, {
            width: newWidth,
            height: newHeight,
          });
        } else if (initialObject.type === 'circle') {
          const dx = curWorldPos.x - initialObject.cx;
          const dy = curWorldPos.y - initialObject.cy;
          const newRadius = Math.max(0.05, Math.hypot(dx, dy));

          updateEditObject(layerId, objId, {
            radius: newRadius,
          });
        } else if (initialObject.type === 'line') {
          if (handle === 'start') {
            updateEditObject(layerId, objId, {
              x1: curWorldPos.x,
              y1: curWorldPos.y,
            });
          } else if (handle === 'end') {
            updateEditObject(layerId, objId, {
              x2: curWorldPos.x,
              y2: curWorldPos.y,
            });
          } else if (handle === 'midpoint') {
            const dx = curWorldPos.x - startWorldPos.x;
            const dy = curWorldPos.y - startWorldPos.y;
            updateEditObject(layerId, objId, {
              x1: initialObject.x1 + dx,
              y1: initialObject.y1 + dy,
              x2: initialObject.x2 + dx,
              y2: initialObject.y2 + dy,
            });
          }
        } else if (initialObject.type === 'freehand') {
          const bbox = computePointsBoundingBox(initialObject.points);
          const initialWidth = Math.max(0.01, bbox.width);
          const initialHeight = Math.max(0.01, bbox.height);
          const centerWorldX = bbox.cx;
          const centerWorldY = bbox.cy;

          const curDx = Math.abs(curWorldPos.x - centerWorldX);
          const curDy = Math.abs(curWorldPos.y - centerWorldY);
          const scaleX = Math.max(0.1, (curDx * 2) / initialWidth);
          const scaleY = Math.max(0.1, (curDy * 2) / initialHeight);

          const scaledPoints = initialObject.points.map((p: { x: number; y: number }) => ({
            x: centerWorldX + (p.x - centerWorldX) * scaleX,
            y: centerWorldY + (p.y - centerWorldY) * scaleY,
          }));

          updateEditObject(layerId, objId, {
            points: scaledPoints,
          });
        }
        return;
      }
      return;
    }

    if (interactionMode.current === ('draw_annotation' as any)) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const curWorldPos = screenToWorld(mouseX, mouseY);
      handleAnnotationDrawMove(curWorldPos);
      return;
    }
    if (interactionMode.current === ('move_annotation' as any)) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const curWorldPos = screenToWorld(mouseX, mouseY);
      handleMoveAnnotationMove(curWorldPos);
      return;
    }
    if (interactionMode.current === ('transform_annotation' as any)) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const curWorldPos = screenToWorld(mouseX, mouseY);
      handleTransformAnnotationMove(curWorldPos);
      return;
    }

    if (interactionMode.current === 'pan_map') {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } 
    else if (interactionMode.current === 'drag_node') {
      if (movingNodesState.current) {
        const { activeId, startWorldPos, initialTransforms } = movingNodesState.current;
        const activeInitial = initialTransforms[activeId];
        const dx = activeInitial ? worldX - activeInitial.x : worldX - startWorldPos.x;
        const dy = activeInitial ? worldY - activeInitial.y : worldY - startWorldPos.y;

        const updates: Record<string, Partial<WaypointNode>> = {};
        Object.entries(initialTransforms).forEach(([id, initTr]) => {
          updates[id] = {
            transform: {
              ...initTr,
              x: initTr.x + dx,
              y: initTr.y + dy,
            },
          };
        });

        updateNodes(updates, { skipRecalculate: true });
      } else if (activeNodeId.current) {
        const node = useAppStore.getState().nodes[activeNodeId.current];
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
          }, { skipRecalculate: true });
        }
      }
    }
    else if (interactionMode.current === 'set_yaw' && activeNodeId.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
      
      const node = useAppStore.getState().nodes[activeNodeId.current];
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
          }, { skipRecalculate: true });
        }
      }
    }
    else if (interactionMode.current === 'drag_points_item') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);

      const key = pointsInputKey.current;
      const idx = pointsItemIndex.current;
      const rawList = useAppStore.getState().pluginInteractionData[key];
      if (Array.isArray(rawList) && idx >= 0 && idx < rawList.length) {
        const next = [...rawList];
        next[idx] = { ...next[idx], x: worldX, y: worldY };
        useAppStore.getState().updatePluginInteractionData(key, next);
      }
    }
    else if (interactionMode.current === 'set_yaw_points_item') {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);

      const key = pointsInputKey.current;
      const idx = pointsItemIndex.current;
      const rawList = useAppStore.getState().pluginInteractionData[key];
      if (Array.isArray(rawList) && idx >= 0 && idx < rawList.length) {
        const pt = rawList[idx];
        const dx = worldX - pt.x;
        const dy = worldY - pt.y;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          const yaw = Math.atan2(dy, dx);
          const halfYaw = yaw / 2.0;
          const next = [...rawList];
          next[idx] = {
            ...pt,
            qx: 0,
            qy: 0,
            qz: Math.sin(halfYaw),
            qw: Math.cos(halfYaw),
          };
          useAppStore.getState().updatePluginInteractionData(key, next);
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
    else if (interactionMode.current === 'draw_export_region' && activeNodeId.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
      
      const current = useAppStore.getState().pluginInteractionData['__export_region_origin'];
      if (current && current.x !== undefined) {
        const ox = current.x;
        const oy = current.y;
        
        // Calculate min/max x and y to support drawing in any direction
        const minX = Math.min(ox, worldX);
        const minY = Math.min(oy, worldY);
        const maxX = Math.max(ox, worldX);
        const maxY = Math.max(oy, worldY);
        
        useAppStore.getState().updateExportRegion(activeNodeId.current, {
          rect: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          }
        });
      }
    }
    else if (interactionMode.current === 'move_export_region' && activeNodeId.current) {
      const region = useAppStore.getState().exportRegions.find(r => r.id === activeNodeId.current);
      if (region) {
        useAppStore.getState().updateExportRegion(region.id, {
          rect: {
            ...region.rect,
            x: worldX - regionDragOffset.current.x,
            y: worldY - regionDragOffset.current.y
          }
        });
      }
    }
    else if (interactionMode.current === 'resize_export_region' && activeNodeId.current) {
      const region = useAppStore.getState().exportRegions.find(r => r.id === activeNodeId.current);
      if (region) {
        let { x, y, width, height } = region.rect;
        const handle = rectDragCorner.current;
        
        const originalOppositeX = (handle.includes('w')) ? x + width : x;
        const originalOppositeY = (handle.includes('s')) ? y : y + height;
        
        let newX = x;
        let newY = y;
        let newWidth = width;
        let newHeight = height;

        if (handle === 'nw' || handle === 'sw' || handle === 'w') {
          newX = Math.min(worldX, originalOppositeX);
          newWidth = Math.abs(originalOppositeX - worldX);
        } else if (handle === 'ne' || handle === 'se' || handle === 'e') {
          newX = Math.min(worldX, originalOppositeX);
          newWidth = Math.abs(worldX - originalOppositeX);
        }

        if (handle === 'nw' || handle === 'ne' || handle === 'n') {
          newY = Math.min(worldY, originalOppositeY);
          newHeight = Math.abs(originalOppositeY - worldY);
        } else if (handle === 'sw' || handle === 'se' || handle === 's') {
          newY = Math.min(worldY, originalOppositeY);
          newHeight = Math.abs(worldY - originalOppositeY);
        }

        useAppStore.getState().updateExportRegion(region.id, {
          rect: { x: newX, y: newY, width: newWidth, height: newHeight }
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
        if (corner === 'min') { origLocalCx = -halfW; origLocalCy = halfH; }
        else if (corner === 'max') { origLocalCx = halfW; origLocalCy = -halfH; }
        else if (corner === 'topRight') { origLocalCx = halfW; origLocalCy = halfH; }
        else if (corner === 'bottomLeft') { origLocalCx = -halfW; origLocalCy = -halfH; }

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
          // Handle points UP on screen = +Y in world.
          // Dragging straight up: dy>0, dx=0 → atan2 = PI/2.
          // We want yaw=0 when handle points up, so offset by -PI/2.
          let yaw = Math.atan2(dy, dx) - Math.PI / 2;
          
          useAppStore.getState().updatePluginInteractionData(key, {
            ...current,
            yaw,
          });
        }
      }
    }

  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMapEditMode) {
      if (interactionMode.current === ('edit_map_draw_rect' as any)) {
        handleRectDrawEnd();
      } else if (interactionMode.current === ('edit_map_set_rect_rotation' as any)) {
        handleRotateEnd();
      } else if (interactionMode.current === ('edit_map_draw_circle' as any)) {
        handleCircleDrawEnd();
      } else if (interactionMode.current === ('edit_map_freehand' as any)) {
        handleFreehandDrawEnd();
      } else if (interactionMode.current === ('edit_map_draw_line' as any)) {
        handleLineDrawEnd();
      } else if (interactionMode.current === ('edit_map_move_object' as any) && movingEditObject.current) {
        movingEditObject.current = null;
        useAppStore.getState().endHistoryTransaction();
        useAppStore.getState().pushHistorySnapshot();
      } else if (interactionMode.current === ('edit_map_resize_object' as any) && resizingEditObject.current) {
        resizingEditObject.current = null;
        useAppStore.getState().endHistoryTransaction();
        useAppStore.getState().pushHistorySnapshot();
      }
      if (interactionMode.current !== 'none') {
        e.currentTarget.releasePointerCapture(e.pointerId);
        interactionMode.current = 'none';
      }
      return;
    }

    if (interactionMode.current === ('draw_annotation' as any)) {
      const rect = containerRef.current?.getBoundingClientRect();
      const mouseX = rect ? e.clientX - rect.left : e.clientX;
      const mouseY = rect ? e.clientY - rect.top : e.clientY;
      const worldPos = screenToWorld(mouseX, mouseY);
      handleAnnotationDrawEnd(worldPos);
      e.currentTarget.releasePointerCapture(e.pointerId);
      interactionMode.current = 'none';
      return;
    }

    if (interactionMode.current === ('move_annotation' as any)) {
      handleMoveAnnotationEnd();
      e.currentTarget.releasePointerCapture(e.pointerId);
      interactionMode.current = 'none';
      return;
    }

    if (interactionMode.current === ('transform_annotation' as any)) {
      handleTransformAnnotationEnd();
      e.currentTarget.releasePointerCapture(e.pointerId);
      interactionMode.current = 'none';
      return;
    }

    if (interactionMode.current !== 'none') {
      if (interactionMode.current === 'drag_node' || interactionMode.current === 'set_yaw') {
        useAppStore.getState().endHistoryTransaction();
        if (useAppStore.getState().autoRecalculatePath && useAppStore.getState().activePathCalculatorPluginId) {
          useAppStore.getState().recalculatePath({ immediate: true });
        }
      }
      if (interactionMode.current === 'set_yaw' && activeNodeId.current) {
        const node = useAppStore.getState().nodes[activeNodeId.current];
        if (node && node.transform) {
          const { x, y, qx, qy, qz, qw } = node.transform;
          let yaw = Math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz));
          if (!isFinite(yaw)) yaw = 0;
          setSnapState(prev => ({
            ...prev,
            isSnapped: false,
            axis: null,
            origin: { x, y, yaw },
            snappedWorldPos: null,
            lockedWaypointId: activeNodeId.current,
            forcedAxis: null,
            forcedSign: null
          }));
        }
      }
      e.currentTarget.releasePointerCapture(e.pointerId);
      interactionMode.current = 'none';
      activeNodeId.current = null;
      movingNodesState.current = null;
      pointsInputKey.current = '';
      pointsItemIndex.current = -1;
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
    setMapScale(newScale);
    setPosition({ x: newPosX, y: newPosY });
  };



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
      className={`absolute inset-0 w-full h-full ${
        (isAnnotationEditMode && activeAnnotationSubTool !== 'select') || isMapEditMode || activeTool !== 'select'
          ? 'cursor-crosshair'
          : 'cursor-grab active:cursor-grabbing'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { 
        if (interactionMode.current === 'drag_node' || interactionMode.current === 'set_yaw') {
          useAppStore.getState().endHistoryTransaction();
          if (useAppStore.getState().autoRecalculatePath && useAppStore.getState().activePathCalculatorPluginId) {
            useAppStore.getState().recalculatePath({ immediate: true });
          }
        }
        interactionMode.current = 'none';
        activeNodeId.current = null;
        movingNodesState.current = null;
        setCursorPosition(null);
      }}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Application preserveDrawingBuffer={true} background={canvasBackgroundColor} resolution={1} resizeTo={window}>
        {/* Container is explicitly Y-inverted to exactly match ROS coordinates (X right, Y up) */}
        <pixiContainer x={position.x + 400} y={position.y + 400} scale={{ x: scale, y: -scale }}>
          {/* 1. Base Map Layers Group */}
          <pixiContainer label="map-layers-group">
            {shouldShowBlendedPreview ? (
              <>
                {previewError && !previewTexture ? (
                  <pixiText text={`Error: ${previewError}`} x={0} y={0} style={textStyle} anchor={0.5} scale={{ x: 1 / scale, y: -1 / scale }} />
                ) : (previewTexture && !previewTexture.destroyed && previewTexture.source && !previewTexture.source.destroyed && previewTexture.source.style) ? (
                  <MapLayerSprite
                    layer={{
                      id: '__blended_preview__',
                      name: isExportPreview ? 'Export Preview' : 'Occupancy Highlight Preview',
                      visible: true,
                      opacity: 1,
                      image_base64: '',
                      info: {
                        ...previewInfo,
                        occupied_thresh: occupancySettings.defaultOccupiedThresh,
                        free_thresh: occupancySettings.defaultFreeThresh,
                        negate: occupancySettings.defaultNegate,
                      },
                      width: previewTexture.width,
                      height: previewTexture.height,
                      z_index: 0,
                      blend_mode: 'overwrite',
                    }}
                    overrideTexture={previewTexture}
                    scale={scale}
                    textStyle={textStyle}
                  />
                ) : null}
              </>
            ) : mapLayers.length > 0 ? (
              [...mapLayers].reverse().map(layer => (
                <MapLayerSprite key={layer.id} layer={layer} scale={scale} textStyle={textStyle} />
              ))
            ) : customLayers.length === 0 ? (
              <pixiSprite texture={fallbackTexture} anchor={0.5} scale={{ x: 1, y: -1 }} />
            ) : null}
          </pixiContainer>

          {/* 2. Custom Layers Group (Always rendered on top of Map Layers) */}
          <pixiContainer label="custom-layers-group">
            {shouldShowBlendedPreview ? (
              /* Overlay reference custom layers during blended preview */
              <>
                {customLayers
                  .filter((l) => l.visible && !!l.is_reference)
                  .slice()
                  .reverse()
                  .map((layer) => {
                    if (layer.type === 'plugin') {
                      return <MapLayerSprite key={layer.id} layer={layer} scale={scale} textStyle={textStyle} />;
                    } else {
                      return (
                        <MapEditSingleLayer
                          key={layer.id}
                          scale={scale}
                          layer={layer}
                          selectedEditObjectId={selectedEditObjectId}
                          isExportPreview={true}
                          onObjectPointerDown={handleEditObjectPointerDown}
                          onObjectHandlePointerDown={handleEditObjectHandlePointerDown}
                          onObjectResizeHandlePointerDown={handleEditObjectResizeHandlePointerDown}
                        />
                      );
                    }
                  })}
              </>
            ) : (
              /* Normal rendering: all custom layers in order from bottom (back) to top (front) */
              <>
                {[...customLayers].reverse().map((layer) => {
                  if (layer.type === 'plugin') {
                    return <MapLayerSprite key={layer.id} layer={layer} scale={scale} textStyle={textStyle} />;
                  } else {
                    return (
                      <MapEditSingleLayer
                        key={layer.id}
                        scale={scale}
                        layer={layer}
                        selectedEditObjectId={selectedEditObjectId}
                        isExportPreview={false}
                        onObjectPointerDown={handleEditObjectPointerDown}
                        onObjectHandlePointerDown={handleEditObjectHandlePointerDown}
                        onObjectResizeHandlePointerDown={handleEditObjectResizeHandlePointerDown}
                      />
                    );
                  }
                })}
              </>
            )}
            {/* Transient editing tool previews and brush cursor overlay */}
            <MapEditToolOverlay
              scale={scale}
              previewObject={rectPreview || circlePreview || freehandPreview || linePreview}
              brushPreviewPos={isMapEditMode && mapEditSubTool === 'freehand' ? brushPreviewPos : null}
              brushPreviewRadius={brushRadiusWorld}
              isExportPreview={shouldShowBlendedPreview}
            />
          </pixiContainer>
          {showGrid && <GridLayer scale={scale} />}

          {/* Render Path (Lines connecting all waypoints in sequential order, continuous across groups) */}
          {showPaths && <PathLayer scale={scale} />}

          {/* Render Robot Footprints (Selected waypoints always, all waypoints if toggled) */}
          <FootprintLayer scale={scale} />

          {/* Render Annotation Layer */}
          <AnnotationLayer
            scale={scale}
            textStyle={textStyle}
            previewObject={annotationPreview}
            onAnnotationPointerDown={handleAnnotationPointerDown}
            onAnnotationHandlePointerDown={handleAnnotationHandlePointerDown}
          />

          {/* Render Waypoints (manual root nodes and children of generator nodes) */}
          <WaypointLayer 
            scale={scale} 
            textStyle={textStyle} 
            lockedWaypointId={snapState.lockedWaypointId}
            onNodePointerDown={(e: import('pixi.js').FederatedPointerEvent, nodeId: string) => {
              if (isMapEditMode) return;
              if (activeTool === 'select') {
                e.stopPropagation();
                const isModifier = (e.nativeEvent as any)?.shiftKey || (e.nativeEvent as any)?.metaKey || (e.nativeEvent as any)?.ctrlKey;
                const currentSelected = useAppStore.getState().selectedNodeIds;
                let targetIds: string[];

                if (currentSelected.includes(nodeId)) {
                  if (isModifier) {
                    targetIds = currentSelected.filter((id) => id !== nodeId);
                    selectNodes(targetIds);
                  } else {
                    targetIds = currentSelected;
                  }
                } else {
                  if (isModifier) {
                    targetIds = [...currentSelected, nodeId];
                    selectNodes(targetIds);
                  } else {
                    targetIds = [nodeId];
                    selectNodes([nodeId]);
                  }
                }

                useAppStore.getState().beginHistoryTransaction();
                interactionMode.current = 'drag_node';
                activeNodeId.current = nodeId;

                const rect = containerRef.current?.getBoundingClientRect();
                const mouseX = rect ? e.nativeEvent.clientX - rect.left : e.nativeEvent.clientX;
                const mouseY = rect ? e.nativeEvent.clientY - rect.top : e.nativeEvent.clientY;
                const worldPos = screenToWorld(mouseX, mouseY);

                const initialTransforms: Record<string, any> = {};
                const allNodes = useAppStore.getState().nodes;
                const collectTransforms = (id: string) => {
                  const n = allNodes[id];
                  if (!n) return;
                  if (n.transform) {
                    initialTransforms[id] = { ...n.transform };
                  }
                  if (n.children_ids) {
                    n.children_ids.forEach(collectTransforms);
                  }
                };
                targetIds.forEach(collectTransforms);

                if (!initialTransforms[nodeId] && allNodes[nodeId]?.transform) {
                  initialTransforms[nodeId] = { ...allNodes[nodeId].transform };
                }

                movingNodesState.current = {
                  activeId: nodeId,
                  startWorldPos: worldPos,
                  initialTransforms,
                };

                if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
                  containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
                }
              }
            }}
            onNodeHandlePointerDown={(e: import('pixi.js').FederatedPointerEvent, nodeId: string) => {
              if (isMapEditMode) return;
              e.stopPropagation();
              useAppStore.getState().beginHistoryTransaction();
              interactionMode.current = 'set_yaw';
              activeNodeId.current = nodeId;
              if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
                containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
              }
            }}
          />

          {/* Render Active Plugin Interaction Previews (Points + Rectangles) */}
          <PluginLayer
            scale={scale}
            onRectDragCornerDown={(e: import('pixi.js').FederatedPointerEvent, key: string, corner: 'min'|'max'|'topRight'|'bottomLeft') => {
              e.stopPropagation();
              rectInputKey.current = key;
              rectDragCorner.current = corner;
              interactionMode.current = 'drag_rect_corner';
              if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
                containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
              }
            }}
            onRectRotationDown={(e: import('pixi.js').FederatedPointerEvent, key: string) => {
              e.stopPropagation();
              rectInputKey.current = key;
              interactionMode.current = 'set_rect_rotation';
              if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
                containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
              }
            }}
          />

          <ExportRegionLayer 
            scale={scale} 
            textStyle={textStyle}
            onRegionDragDown={(e, regionId) => {
              if (activeTool === 'add_export_region') {
                e.stopPropagation();
                if (e.nativeEvent && typeof (e.nativeEvent as any).stopPropagation === 'function') {
                  (e.nativeEvent as any).stopPropagation();
                }
                const region = useAppStore.getState().exportRegions.find(r => r.id === regionId);
                if (region) {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect && e.nativeEvent instanceof PointerEvent) {
                    const mouseX = e.nativeEvent.clientX - rect.left;
                    const mouseY = e.nativeEvent.clientY - rect.top;
                    const { x: worldX, y: worldY } = screenToWorld(mouseX, mouseY);
                    regionDragOffset.current = { x: worldX - region.rect.x, y: worldY - region.rect.y };
                    interactionMode.current = 'move_export_region';
                    activeNodeId.current = regionId;
                    containerRef.current?.setPointerCapture(e.nativeEvent.pointerId);
                  }
                }
              }
            }}
            onRegionResizeDown={(e, regionId, handle) => {
              if (activeTool === 'add_export_region') {
                e.stopPropagation();
                if (e.nativeEvent && typeof (e.nativeEvent as any).stopPropagation === 'function') {
                  (e.nativeEvent as any).stopPropagation();
                }
                interactionMode.current = 'resize_export_region';
                activeNodeId.current = regionId;
                rectDragCorner.current = handle;
                if (containerRef.current && e.nativeEvent instanceof PointerEvent) {
                  containerRef.current.setPointerCapture(e.nativeEvent.pointerId);
                }
              }
            }}
          />

          {/* Render Snapping Guide */}
          <SnappingGuideLayer scale={scale} snapState={snapState} snapInput={snapInput} />

        </pixiContainer>
      </Application>
    </div>
  );
}
