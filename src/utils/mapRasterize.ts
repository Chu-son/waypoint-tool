import { CustomLayer, ManualCustomLayer, EditObject, ProjectMapLayer } from '../types/store';

/**
 * Converts world coordinates (meters) to pixel coordinates on the map.
 * ROS origin is [originX, originY, yaw]. ROS map Y axis points upwards, while canvas Y points downwards.
 */
export function worldToPixel(
  wx: number,
  wy: number,
  info: { resolution: number; origin: number[]; width?: number; height: number }
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
  info: ProjectMapLayer['info']
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
  }
}

/**
 * Renders a ManualCustomLayer onto a target ProjectMapLayer using Canvas 2D API,
 * returning a new Base64-encoded PNG data URL.
 */
export async function compositeManualCustomLayerOntoMap(
  customLayer: ManualCustomLayer,
  targetMapLayer: ProjectMapLayer
): Promise<string> {
  if (!customLayer.editObjects.length) {
    return targetMapLayer.image_base64;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetMapLayer.width || img.width;
      canvas.height = targetMapLayer.height || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(targetMapLayer.image_base64);
        return;
      }

      // Draw base map image
      ctx.drawImage(img, 0, 0);

      // Full opacity for ROS map values
      ctx.globalAlpha = 1.0;

      // Draw each edit object
      for (const obj of customLayer.editObjects) {
        drawEditObjectToCanvas(ctx, obj, targetMapLayer.info);
      }

      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    };
    img.onerror = (err) => {
      console.error('Failed to load map image for custom layer compositing:', err);
      resolve(targetMapLayer.image_base64);
    };
    img.src = targetMapLayer.image_base64;
  });
}

/**
 * Calculates the bounding box in world coordinates for all objects in a ManualCustomLayer.
 */
export function getEditLayerBoundingBox(
  editLayer: ManualCustomLayer,
  resolution = 0.05
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  widthPx: number;
  heightPx: number;
} {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

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
    }
  }

  if (minX === Infinity) {
    minX = -10; maxX = 10; minY = -10; maxY = 10;
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
  customLayer: ManualCustomLayer
): Promise<{
  id: string;
  name: string;
  image_base64: string;
  info: any;
  opacity: number;
  blend_mode: string;
  z_index: number;
} | null> {
  if (!customLayer.visible || customLayer.editObjects.length === 0) {
    return null;
  }

  const resolution = 0.05;
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
    z_index: 1000 + customLayer.z_index,
  };
}

/**
 * Prepares visible MapLayers and CustomLayers (both manual & plugin) for export or preview.
 */
export async function prepareLayersForExport(
  mapLayers: ProjectMapLayer[],
  customLayers: CustomLayer[]
) {
  const visibleMapLayers = mapLayers
    .filter((l) => l.visible)
    .map((l) => ({
      id: l.id,
      name: l.name,
      image_base64: l.image_base64,
      info: l.info,
      opacity: 1.0,
      blend_mode: l.blend_mode || 'overwrite',
      z_index: l.z_index,
      visible: true,
    }));

  const customLayerExports = await Promise.all(
    customLayers
      .filter((l) => l.visible)
      .map(async (cl) => {
        if (cl.type === 'manual') {
          return rasterizeManualCustomLayerToExportLayer(cl);
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
            z_index: 1000 + cl.z_index,
            visible: true,
          };
        }
      })
  );

  const validCustomLayers = customLayerExports
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .map((l) => ({ ...l, visible: true }));

  return [...visibleMapLayers, ...validCustomLayers];
}

/**
 * Pre-composites visible ManualCustomLayers onto their target MapLayers (Legacy compatibility).
 */
export async function preCompositeEditLayers(
  mapLayers: ProjectMapLayer[],
  customLayers: ManualCustomLayer[]
): Promise<ProjectMapLayer[]> {
  if (!customLayers.length || !mapLayers.length) {
    return mapLayers;
  }

  const result = mapLayers.map((l) => ({ ...l }));
  const visibleEditLayers = customLayers
    .filter((el) => el.visible && el.editObjects.length > 0)
    .sort((a, b) => a.z_index - b.z_index);

  if (!visibleEditLayers.length) {
    return mapLayers;
  }

  for (const editLayer of visibleEditLayers) {
    const visibleMapLayers = result.filter((l) => l.visible).sort((a, b) => b.z_index - a.z_index);
    const targetMapId = (editLayer as any).targetMapLayerId || visibleMapLayers[0]?.id;
    if (!targetMapId) continue;

    const targetIdx = result.findIndex((l) => l.id === targetMapId);
    if (targetIdx < 0) continue;

    const compositedBase64 = await compositeManualCustomLayerOntoMap(editLayer, result[targetIdx]);
    result[targetIdx] = {
      ...result[targetIdx],
      image_base64: compositedBase64,
    };
  }

  return result;
}
