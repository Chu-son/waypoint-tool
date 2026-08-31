import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import {
  AnnotationObject,
  PointAnnotation,
  OrientedPointAnnotation,
  LineAnnotation,
  RectAnnotation,
  CircleAnnotation,
} from '../../../types/store';
import { getNextSequentialName } from '../../../utils/treeUtils';
import { DEFAULT_ANNOTATION_COLOR } from '../../../utils/colorPresets';
import { v4 as uuidv4 } from 'uuid';

export function useAnnotationEdit() {
  const addAnnotationObject = useAppStore((state) => state.addAnnotationObject);
  const updateAnnotationObject = useAppStore((state) => state.updateAnnotationObject);
  const selectAnnotationObjects = useAppStore((state) => state.selectAnnotationObjects);
  const activeAnnotationSubTool = useAppStore((state) => state.activeAnnotationSubTool);
  const defaultAnnotationColor = useAppStore((state) => state.defaultAnnotationColor);
  const beginHistoryTransaction = useAppStore((state) => state.beginHistoryTransaction);
  const endHistoryTransaction = useAppStore((state) => state.endHistoryTransaction);

  const [drawStartPos, setDrawStartPos] = useState<{ x: number; y: number } | null>(null);
  const [annotationPreview, setAnnotationPreview] = useState<AnnotationObject | null>(null);

  // Moving object state
  const movingAnnotation = useRef<{
    id: string;
    startMouseWorld: { x: number; y: number };
    initialObj: AnnotationObject;
  } | null>(null);

  // Transforming handle state
  const transformingHandle = useRef<{
    id: string;
    handleType: string;
    startMouseWorld: { x: number; y: number };
    initialObj: AnnotationObject;
  } | null>(null);

  // 1. Drawing Start
  const handleAnnotationDrawStart = useCallback(
    (worldPos: { x: number; y: number }) => {
      setDrawStartPos(worldPos);
      const color = defaultAnnotationColor || DEFAULT_ANNOTATION_COLOR;

      switch (activeAnnotationSubTool) {
        case 'point': {
          setAnnotationPreview({
            id: 'preview',
            name: 'Point',
            type: 'point',
            x: worldPos.x,
            y: worldPos.y,
            visible: true,
            labelVisible: true,
            color,
          } as PointAnnotation);
          break;
        }
        case 'oriented_point': {
          setAnnotationPreview({
            id: 'preview',
            name: 'Oriented Point',
            type: 'oriented_point',
            x: worldPos.x,
            y: worldPos.y,
            yaw: 0,
            visible: true,
            labelVisible: true,
            color,
          } as OrientedPointAnnotation);
          break;
        }
        case 'line': {
          setAnnotationPreview({
            id: 'preview',
            name: 'Line',
            type: 'line',
            x1: worldPos.x,
            y1: worldPos.y,
            x2: worldPos.x,
            y2: worldPos.y,
            visible: true,
            labelVisible: true,
            color,
          } as LineAnnotation);
          break;
        }
        case 'rect': {
          setAnnotationPreview({
            id: 'preview',
            name: 'Rectangle',
            type: 'rect',
            cx: worldPos.x,
            cy: worldPos.y,
            width: 0.01,
            height: 0.01,
            angle: 0,
            visible: true,
            labelVisible: true,
            color,
          } as RectAnnotation);
          break;
        }
        case 'circle': {
          setAnnotationPreview({
            id: 'preview',
            name: 'Circle',
            type: 'circle',
            cx: worldPos.x,
            cy: worldPos.y,
            radius: 0.01,
            visible: true,
            labelVisible: true,
            color,
          } as CircleAnnotation);
          break;
        }
      }
    },
    [activeAnnotationSubTool, defaultAnnotationColor]
  );

  // 2. Drawing Move
  const handleAnnotationDrawMove = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (!drawStartPos) return;

      const color = defaultAnnotationColor || DEFAULT_ANNOTATION_COLOR;

      switch (activeAnnotationSubTool) {
        case 'point': {
          setAnnotationPreview({
            id: 'preview',
            name: 'Point',
            type: 'point',
            x: worldPos.x,
            y: worldPos.y,
            visible: true,
            labelVisible: true,
            color,
          } as PointAnnotation);
          break;
        }
        case 'oriented_point': {
          const dx = worldPos.x - drawStartPos.x;
          const dy = worldPos.y - drawStartPos.y;
          const yaw = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 ? Math.atan2(dy, dx) : 0;
          setAnnotationPreview({
            id: 'preview',
            name: 'Oriented Point',
            type: 'oriented_point',
            x: drawStartPos.x,
            y: drawStartPos.y,
            yaw,
            visible: true,
            labelVisible: true,
            color,
          } as OrientedPointAnnotation);
          break;
        }
        case 'line': {
          setAnnotationPreview({
            id: 'preview',
            name: 'Line',
            type: 'line',
            x1: drawStartPos.x,
            y1: drawStartPos.y,
            x2: worldPos.x,
            y2: worldPos.y,
            visible: true,
            labelVisible: true,
            color,
          } as LineAnnotation);
          break;
        }
        case 'rect': {
          const width = Math.max(0.01, Math.abs(worldPos.x - drawStartPos.x));
          const height = Math.max(0.01, Math.abs(worldPos.y - drawStartPos.y));
          const cx = (drawStartPos.x + worldPos.x) / 2;
          const cy = (drawStartPos.y + worldPos.y) / 2;
          setAnnotationPreview({
            id: 'preview',
            name: 'Rectangle',
            type: 'rect',
            cx,
            cy,
            width,
            height,
            angle: 0,
            visible: true,
            labelVisible: true,
            color,
          } as RectAnnotation);
          break;
        }
        case 'circle': {
          const dx = worldPos.x - drawStartPos.x;
          const dy = worldPos.y - drawStartPos.y;
          const radius = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
          setAnnotationPreview({
            id: 'preview',
            name: 'Circle',
            type: 'circle',
            cx: drawStartPos.x,
            cy: drawStartPos.y,
            radius,
            visible: true,
            labelVisible: true,
            color,
          } as CircleAnnotation);
          break;
        }
      }
    },
    [drawStartPos, activeAnnotationSubTool, defaultAnnotationColor]
  );

  // 3. Drawing End
  const handleAnnotationDrawEnd = useCallback(
    (worldPos?: { x: number; y: number }) => {
      if (!drawStartPos && !annotationPreview) {
        setDrawStartPos(null);
        setAnnotationPreview(null);
        return;
      }

      const existingNames = Object.values(useAppStore.getState().annotationObjects || {}).map((o) => o.name);
      const color = defaultAnnotationColor || DEFAULT_ANNOTATION_COLOR;

      let newObj: AnnotationObject | null = null;

      const pt = worldPos || drawStartPos!;

      switch (activeAnnotationSubTool) {
        case 'point': {
          newObj = {
            id: uuidv4(),
            name: getNextSequentialName('Point', existingNames),
            type: 'point',
            x: pt.x,
            y: pt.y,
            visible: true,
            labelVisible: true,
            color,
          };
          break;
        }
        case 'oriented_point': {
          const op = annotationPreview as OrientedPointAnnotation;
          newObj = {
            id: uuidv4(),
            name: getNextSequentialName('Oriented Point', existingNames),
            type: 'oriented_point',
            x: drawStartPos?.x ?? pt.x,
            y: drawStartPos?.y ?? pt.y,
            yaw: op?.yaw ?? 0,
            visible: true,
            labelVisible: true,
            color,
          };
          break;
        }
        case 'line': {
          const ln = annotationPreview as LineAnnotation;
          const isDragged = ln && (Math.abs(ln.x2 - ln.x1) > 0.05 || Math.abs(ln.y2 - ln.y1) > 0.05);
          newObj = {
            id: uuidv4(),
            name: getNextSequentialName('Line', existingNames),
            type: 'line',
            x1: isDragged ? ln.x1 : pt.x - 1,
            y1: isDragged ? ln.y1 : pt.y,
            x2: isDragged ? ln.x2 : pt.x + 1,
            y2: isDragged ? ln.y2 : pt.y,
            visible: true,
            labelVisible: true,
            color,
          };
          break;
        }
        case 'rect': {
          const rect = annotationPreview as RectAnnotation;
          const isDragged = rect && (rect.width > 0.05 || rect.height > 0.05);
          newObj = {
            id: uuidv4(),
            name: getNextSequentialName('Rectangle', existingNames),
            type: 'rect',
            cx: isDragged ? rect.cx : pt.x,
            cy: isDragged ? rect.cy : pt.y,
            width: isDragged ? rect.width : 2.0,
            height: isDragged ? rect.height : 2.0,
            angle: isDragged ? (rect.angle || 0) : 0,
            visible: true,
            labelVisible: true,
            color,
          };
          break;
        }
        case 'circle': {
          const circle = annotationPreview as CircleAnnotation;
          const isDragged = circle && circle.radius > 0.05;
          newObj = {
            id: uuidv4(),
            name: getNextSequentialName('Circle', existingNames),
            type: 'circle',
            cx: isDragged ? circle.cx : pt.x,
            cy: isDragged ? circle.cy : pt.y,
            radius: isDragged ? circle.radius : 1.0,
            visible: true,
            labelVisible: true,
            color,
          };
          break;
        }
      }

      if (newObj) {
        addAnnotationObject(newObj);
        selectAnnotationObjects([newObj.id]);
      }

      setDrawStartPos(null);
      setAnnotationPreview(null);
    },
    [drawStartPos, annotationPreview, activeAnnotationSubTool, defaultAnnotationColor, addAnnotationObject, selectAnnotationObjects]
  );

  // 4. Moving and transforming existing objects
  const handleStartMoveAnnotation = useCallback((id: string, worldPos: { x: number; y: number }) => {
    const obj = useAppStore.getState().annotationObjects[id];
    if (!obj) return;
    beginHistoryTransaction();
    movingAnnotation.current = {
      id,
      startMouseWorld: worldPos,
      initialObj: structuredClone(obj),
    };
  }, [beginHistoryTransaction]);

  const handleMoveAnnotationMove = useCallback((worldPos: { x: number; y: number }) => {
    if (!movingAnnotation.current) return;
    const { id, startMouseWorld, initialObj } = movingAnnotation.current;
    const dx = worldPos.x - startMouseWorld.x;
    const dy = worldPos.y - startMouseWorld.y;

    switch (initialObj.type) {
      case 'point':
      case 'oriented_point': {
        updateAnnotationObject(id, {
          x: initialObj.x + dx,
          y: initialObj.y + dy,
        });
        break;
      }
      case 'line': {
        updateAnnotationObject(id, {
          x1: initialObj.x1 + dx,
          y1: initialObj.y1 + dy,
          x2: initialObj.x2 + dx,
          y2: initialObj.y2 + dy,
        });
        break;
      }
      case 'rect':
      case 'circle': {
        updateAnnotationObject(id, {
          cx: initialObj.cx + dx,
          cy: initialObj.cy + dy,
        });
        break;
      }
    }
  }, [updateAnnotationObject]);

  const handleMoveAnnotationEnd = useCallback(() => {
    if (movingAnnotation.current) {
      movingAnnotation.current = null;
      endHistoryTransaction();
    }
  }, [endHistoryTransaction]);

  const handleStartTransformAnnotation = useCallback(
    (id: string, handleType: string, worldPos: { x: number; y: number }) => {
      const obj = useAppStore.getState().annotationObjects[id];
      if (!obj) return;
      beginHistoryTransaction();
      transformingHandle.current = {
        id,
        handleType,
        startMouseWorld: worldPos,
        initialObj: structuredClone(obj),
      };
    },
    [beginHistoryTransaction]
  );

  const handleTransformAnnotationMove = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (!transformingHandle.current) return;
      const { id, handleType, startMouseWorld, initialObj } = transformingHandle.current;

      switch (initialObj.type) {
        case 'oriented_point': {
          if (handleType === 'yaw') {
            const dx = worldPos.x - initialObj.x;
            const dy = worldPos.y - initialObj.y;
            const yaw = Math.atan2(dy, dx);
            updateAnnotationObject(id, { yaw });
          }
          break;
        }

        case 'line': {
          if (handleType === 'start') {
            updateAnnotationObject(id, { x1: worldPos.x, y1: worldPos.y });
          } else if (handleType === 'end') {
            updateAnnotationObject(id, { x2: worldPos.x, y2: worldPos.y });
          } else if (handleType === 'midpoint') {
            const dx = worldPos.x - startMouseWorld.x;
            const dy = worldPos.y - startMouseWorld.y;
            updateAnnotationObject(id, {
              x1: initialObj.x1 + dx,
              y1: initialObj.y1 + dy,
              x2: initialObj.x2 + dx,
              y2: initialObj.y2 + dy,
            });
          }
          break;
        }

        case 'rect': {
          if (handleType === 'rotate') {
            const dx = worldPos.x - initialObj.cx;
            const dy = worldPos.y - initialObj.cy;
            const angle = Math.atan2(dy, dx);
            updateAnnotationObject(id, { angle });
          } else if (handleType.startsWith('corner_')) {
            const angle = initialObj.angle || 0;
            const dx = worldPos.x - initialObj.cx;
            const dy = worldPos.y - initialObj.cy;
            // Rotate delta into rect local frame
            const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
            const localY = dx * Math.sin(-angle) + dy * Math.cos(-angle);
            const width = Math.max(0.1, Math.abs(localX) * 2);
            const height = Math.max(0.1, Math.abs(localY) * 2);
            updateAnnotationObject(id, { width, height });
          } else if (handleType === 'center') {
            const dx = worldPos.x - startMouseWorld.x;
            const dy = worldPos.y - startMouseWorld.y;
            updateAnnotationObject(id, {
              cx: initialObj.cx + dx,
              cy: initialObj.cy + dy,
            });
          }
          break;
        }

        case 'circle': {
          if (handleType.startsWith('radius_')) {
            const dx = worldPos.x - initialObj.cx;
            const dy = worldPos.y - initialObj.cy;
            const radius = Math.max(0.05, Math.sqrt(dx * dx + dy * dy));
            updateAnnotationObject(id, { radius });
          } else if (handleType === 'center') {
            const dx = worldPos.x - startMouseWorld.x;
            const dy = worldPos.y - startMouseWorld.y;
            updateAnnotationObject(id, {
              cx: initialObj.cx + dx,
              cy: initialObj.cy + dy,
            });
          }
          break;
        }
      }
    },
    [updateAnnotationObject]
  );

  const handleTransformAnnotationEnd = useCallback(() => {
    if (transformingHandle.current) {
      transformingHandle.current = null;
      endHistoryTransaction();
    }
  }, [endHistoryTransaction]);

  return {
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
    isMovingOrTransforming: () => !!(movingAnnotation.current || transformingHandle.current),
  };
}
