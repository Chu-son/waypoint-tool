import { CustomLayer, ManualCustomLayer, EditObject, MapLayerClip } from '../types/store';
import { LayerStack, orderedMapLayers, baseMapResolution, stackZIndexes } from '../utils/layerStack';

/**
 * Converts world coordinates (meters) to pixel coordinates on the map.
 * ROS origin is [originX, originY, yaw]. ROS map Y axis points upwards, while canvas Y points downwards.
 */
export function worldToPixel(
  wx: number,
  wy: number,
  info: { resolution: number; origin: number[]; width?: number; height: number },
): { px: number; py: number } {
  const resolution = info.resolution || 0.05;
  const originX = info.origin?.[0] ?? 0;
  const originY = info.origin?.[1] ?? 0;
  const height = info.height || 1000;

  const px = (wx - originX) / resolution;
  const py = height - (wy - originY) / resolution;
  return { px, py };
}

/**
 * Converts world radius (meters) to pixel radius.
 */
export function worldRadiusToPixel(radius: number, resolution: number): number {
  return radius / (resolution || 0.05);
}

/**
 * Draws a single EditObject onto an HTML2D Canvas context.
 */
function drawEditObjectToCanvas(
  ctx: CanvasRenderingContext2D,
  obj: EditObject,
  info: Parameters<typeof worldToPixel>[2],
) {
  const resolution = info.resolution || 0.05;
  const v = Math.min(255, Math.max(0, Math.round(obj.fillValue)));
  ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
  ctx.strokeStyle = `rgb(${v}, ${v}, ${v})`;

  if (obj.type === 'rect') {
    const { px, py } = worldToPixel(obj.cx, obj.cy, info);
    const wPx = obj.width / resolution;
    const hPx = obj.height / resolution;

    ctx.save();
    ctx.translate(px, py);
    // Invert angle for canvas Y axis
    ctx.rotate(-obj.angle);
    ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
    ctx.restore();
  } else if (obj.type === 'circle') {
    const { px, py } = worldToPixel(obj.cx, obj.cy, info);
    const rPx = worldRadiusToPixel(obj.radius, resolution);

    ctx.beginPath();
    ctx.arc(px, py, rPx, 0, Math.PI * 2);
    ctx.fill();
  } else if (obj.type === 'freehand') {
    if (obj.points.length === 0) return;
    const rPx = worldRadiusToPixel(obj.brushRadius, resolution);
    const strokeWidth = rPx * 2;

    ctx.save();
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    const firstPixel = worldToPixel(obj.points[0].x, obj.points[0].y, info);
    ctx.moveTo(firstPixel.px, firstPixel.py);

    for (let i = 1; i < obj.points.length; i++) {
      const ptPixel = worldToPixel(obj.points[i].x, obj.points[i].y, info);
      ctx.lineTo(ptPixel.px, ptPixel.py);
    }

    if (obj.points.length === 1) {
      ctx.arc(firstPixel.px, firstPixel.py, rPx, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.stroke();
    }
    ctx.restore();
  } else if (obj.type === 'line') {
    const p1 = worldToPixel(obj.x1, obj.y1, info);
    const p2 = worldToPixel(obj.x2, obj.y2, info);
    const strokeWidth = obj.lineWidth ? obj.lineWidth / resolution : Math.max(1, 2);

    ctx.save();
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Calculates the bounding box in world coordinates for all objects in a ManualCustomLayer.
 */
export function getEditLayerBoundingBox(
  editLayer: ManualCustomLayer,
  resolution = 0.05,
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  widthPx: number;
  heightPx: number;
} {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const obj of editLayer.editObjects) {
    if (obj.type === 'rect') {
      const halfDiag = Math.hypot(obj.width, obj.height) / 2;
      minX = Math.min(minX, obj.cx - halfDiag);
      maxX = Math.max(maxX, obj.cx + halfDiag);
      minY = Math.min(minY, obj.cy - halfDiag);
      maxY = Math.max(maxY, obj.cy + halfDiag);
    } else if (obj.type === 'circle') {
      minX = Math.min(minX, obj.cx - obj.radius);
      maxX = Math.max(maxX, obj.cx + obj.radius);
      minY = Math.min(minY, obj.cy - obj.radius);
      maxY = Math.max(maxY, obj.cy + obj.radius);
    } else if (obj.type === 'freehand') {
      for (const p of obj.points) {
        minX = Math.min(minX, p.x - obj.brushRadius);
        maxX = Math.max(maxX, p.x + obj.brushRadius);
        minY = Math.min(minY, p.y - obj.brushRadius);
        maxY = Math.max(maxY, p.y + obj.brushRadius);
      }
    } else if (obj.type === 'line') {
      const padding = (obj.lineWidth || 0.1) / 2;
      minX = Math.min(minX, obj.x1 - padding, obj.x2 - padding);
      maxX = Math.max(maxX, obj.x1 + padding, obj.x2 + padding);
      minY = Math.min(minY, obj.y1 - padding, obj.y2 - padding);
      maxY = Math.max(maxY, obj.y1 + padding, obj.y2 + padding);
    }
  }

  if (minX === Infinity) {
    minX = -10;
    maxX = 10;
    minY = -10;
    maxY = 10;
  }

  minX = Math.floor(minX - 1);
  minY = Math.floor(minY - 1);
  maxX = Math.ceil(maxX + 1);
  maxY = Math.ceil(maxY + 1);

  const widthPx = Math.max(10, Math.ceil((maxX - minX) / resolution));
  const heightPx = Math.max(10, Math.ceil((maxY - minY) / resolution));

  return { minX, maxX, minY, maxY, widthPx, heightPx };
}

/**
 * Rasterizes a manual CustomLayer into an independent ExportLayer with a transparent background.
 */
export async function rasterizeManualCustomLayerToExportLayer(
  customLayer: ManualCustomLayer,
  targetResolution?: number,
): Promise<Omit<PreparedExportLayer, 'z_index' | 'visible'> | null> {
  if (!customLayer.visible || customLayer.editObjects.length === 0) {
    return null;
  }

  const resolution = targetResolution || 0.05;
  const bbox = getEditLayerBoundingBox(customLayer, resolution);

  const canvas = document.createElement('canvas');
  canvas.width = bbox.widthPx;
  canvas.height = bbox.heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fully transparent background
  ctx.clearRect(0, 0, bbox.widthPx, bbox.heightPx);
  ctx.globalAlpha = 1.0;

  const info = {
    resolution,
    origin: [bbox.minX, bbox.minY, 0],
    width: bbox.widthPx,
    height: bbox.heightPx,
  };

  for (const obj of customLayer.editObjects) {
    drawEditObjectToCanvas(ctx, obj, info);
  }

  const dataUrl = canvas.toDataURL('image/png');

  return {
    id: customLayer.id,
    name: customLayer.name,
    image_base64: dataUrl,
    info: {
      image: `${customLayer.name.replace(/\s+/g, '_').toLowerCase()}.png`,
      resolution,
      origin: [bbox.minX, bbox.minY, 0],
      negate: 0,
      occupied_thresh: 0.65,
      free_thresh: 0.196,
    },
    opacity: 1.0,
    blend_mode: customLayer.blend_mode || 'overwrite',
  };
}

/**
 * Prepares a CustomLayer for plugin execution by resolving its metadata and rasterized image/info if available.
 */
export async function prepareCustomLayerPayload(customLayer: CustomLayer, targetResolution?: number): Promise<any> {
  const resolution = targetResolution || 0.05;
  if (customLayer.type === 'manual') {
    let imageBase64: string | undefined;
    let info: any = undefined;

    if (customLayer.editObjects && customLayer.editObjects.length > 0) {
      const bbox = getEditLayerBoundingBox(customLayer, resolution);
      const canvas = document.createElement('canvas');
      canvas.width = bbox.widthPx;
      canvas.height = bbox.heightPx;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, bbox.widthPx, bbox.heightPx);
        ctx.globalAlpha = 1.0;
        info = {
          image: `${customLayer.name.replace(/\s+/g, '_').toLowerCase()}.png`,
          resolution,
          origin: [bbox.minX, bbox.minY, 0],
          width: bbox.widthPx,
          height: bbox.heightPx,
          negate: 0,
          occupied_thresh: 0.65,
          free_thresh: 0.196,
        };
        for (const obj of customLayer.editObjects) {
          drawEditObjectToCanvas(ctx, obj, info);
        }
        imageBase64 = canvas.toDataURL('image/png');
      }
    }

    return {
      id: customLayer.id,
      name: customLayer.name,
      type: 'manual',
      opacity: customLayer.opacity ?? 1.0,
      blend_mode: customLayer.blend_mode || 'overwrite',
      is_reference: customLayer.is_reference ?? false,
      edit_objects: customLayer.editObjects,
      image_base64: imageBase64,
      info,
    };
  } else {
    // Plugin custom layer
    return {
      id: customLayer.id,
      name: customLayer.name,
      type: 'plugin',
      opacity: customLayer.opacity ?? 1.0,
      blend_mode: customLayer.blend_mode || 'overwrite',
      is_reference: customLayer.is_reference ?? false,
      plugin_id: customLayer.plugin_id,
      params: customLayer.params,
      image_base64: customLayer.image_base64,
      info: customLayer.info,
      plugin_data: (customLayer as any).plugin_data,
      source_execution_id: (customLayer as any).source_execution_id,
    };
  }
}

/**
 * Traverses plugin inputs and enriches any 'custom_layer' and 'annotation' interaction data entries with resolved payloads.
 */
export async function enrichInteractionDataWithCustomLayers(
  inputs: any[] | undefined,
  interactionData: Record<string, any>,
  customLayers: CustomLayer[],
  baseResolution?: number,
  annotationObjects?: Record<string, any>,
): Promise<Record<string, any>> {
  if (!inputs || !interactionData) return interactionData;
  const enriched = { ...interactionData };

  for (const input of inputs) {
    const key = input.name || input.id;
    const rawVal = interactionData[key];
    if (rawVal === undefined || rawVal === null) continue;

    if (input.type === 'custom_layer') {
      if (Array.isArray(rawVal)) {
        enriched[key] = await Promise.all(
          rawVal.map(async (item) => {
            const id = typeof item === 'string' ? item : item?.id;
            const found = customLayers.find((l) => l.id === id) || (typeof item === 'object' ? item : null);
            return found ? await prepareCustomLayerPayload(found, baseResolution) : item;
          }),
        );
      } else {
        const id = typeof rawVal === 'string' ? rawVal : rawVal?.id;
        const found = customLayers.find((l) => l.id === id) || (typeof rawVal === 'object' ? rawVal : null);
        enriched[key] = found ? await prepareCustomLayerPayload(found, baseResolution) : rawVal;
      }
    } else if (input.type === 'annotation' && annotationObjects) {
      if (Array.isArray(rawVal)) {
        enriched[key] = rawVal.map((item) => {
          const id = typeof item === 'string' ? item : item?.id;
          return id && annotationObjects[id] ? annotationObjects[id] : item;
        });
      } else {
        const id = typeof rawVal === 'string' ? rawVal : rawVal?.id;
        enriched[key] = id && annotationObjects[id] ? annotationObjects[id] : rawVal;
      }
    }
  }

  return enriched;
}

export type PreparedExportLayer = {
  id: string;
  name: string;
  image_base64?: string;
  info?: any;
  opacity: number;
  blend_mode: string;
  /** Compositing order: 0 is the bottom of the layer stack. */
  z_index: number;
  visible: boolean;
  /** Part of the layer that takes part in blending (world meters). Absent or null means all of it. */
  clip?: MapLayerClip | null;
};

/**
 * Prepares the visible map instances and custom layers (manual & plugin) of the layer stack for
 * export or preview. `z_index` follows the stack order, bottom first, so blending honours the order
 * the user arranged across map and custom layers alike.
 *
 * With `includeHidden`, hidden layers are prepared as well, for callers that decide per export which
 * layers to draw (see `layerVisibility` of an export region). Reference layers are never included.
 */
export async function prepareLayersForExport(
  stack: LayerStack,
  options: { includeHidden?: boolean } = {},
): Promise<PreparedExportLayer[]> {
  const { customLayers, layerOrder } = stack;
  const includeHidden = options.includeHidden === true;
  const zIndexes = stackZIndexes(layerOrder);
  const zOf = (id: string) => zIndexes.get(id) ?? 0;

  const mappedMapLayers: PreparedExportLayer[] = orderedMapLayers(stack)
    .filter((l) => includeHidden || l.visible)
    .map((l) => ({
      id: l.id,
      name: l.name,
      image_base64: l.image_base64,
      info: l.info,
      opacity: 1.0,
      blend_mode: l.blend_mode,
      z_index: zOf(l.id),
      visible: true,
      clip: l.clip,
    }));

  const baseResolution = baseMapResolution(stack);

  const customLayerExports = await Promise.all(
    customLayers
      .filter((l) => (includeHidden || l.visible) && !l.is_reference)
      .map(async (cl): Promise<PreparedExportLayer | null> => {
        const zIndex = zOf(cl.id);

        if (cl.type === 'manual') {
          const exportLayer = await rasterizeManualCustomLayerToExportLayer(cl, baseResolution);
          if (!exportLayer) return null;
          return {
            ...exportLayer,
            z_index: zIndex,
            visible: true,
          };
        } else {
          // Plugin generated raster layer
          if (!cl.image_base64) return null;
          return {
            id: cl.id,
            name: cl.name,
            image_base64: cl.image_base64,
            info: cl.info,
            opacity: cl.opacity ?? 1.0,
            blend_mode: cl.blend_mode || 'overwrite',
            z_index: zIndex,
            visible: true,
          };
        }
      }),
  );

  const validCustomLayers = customLayerExports.filter((l): l is PreparedExportLayer => l !== null);

  return [...mappedMapLayers, ...validCustomLayers].sort((a, b) => a.z_index - b.z_index);
}
