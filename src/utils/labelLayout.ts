import { TextStyle, CanvasTextMetrics } from 'pixi.js';

export interface LabelCandidate {
  id: string;
  worldX: number;
  worldY: number;
  lines: string[];
}

export interface LabelLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputeLabelOffsetsOptions {
  baseOffsetX?: number;
  baseOffsetY?: number;
  margin?: number;
  maxAttempts?: number;
}

interface LabelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function measureLabelLines(lines: string[], style: TextStyle): { width: number; height: number } {
  const metrics = CanvasTextMetrics.measureText(lines.join('\n'), style);
  return { width: metrics.width, height: metrics.height };
}

function rectsIntersect(a: LabelRect, b: LabelRect, margin: number): boolean {
  return (
    a.left < b.left + b.width + margin &&
    a.left + a.width + margin > b.left &&
    a.top < b.top + b.height + margin &&
    a.top + a.height + margin > b.top
  );
}

/**
 * 各Waypointの属性ラベルが画面上で重ならないよう、アンカー(Waypoint座標)からの
 * オフセットを縦方向スタッキングで調整する。
 *
 * 判定・調整はすべて「画面ピクセル空間」で行う。ワールド座標の相対距離は
 * 全体を貫くトップレベルコンテナのscaleを掛けるだけでスクリーン距離になるため
 * (回転・panは無視してよい)、pan成分は考慮しない。
 *
 * 戻り値は各Waypointのラベルコンテナにそのまま設定できる x/y オフセット(ワールド単位)と、
 * 実測したラベルサイズ(width/height, 画面ピクセル単位)を含む。
 */
export function computeLabelOffsets(
  candidates: LabelCandidate[],
  scale: number,
  style: TextStyle,
  options: ComputeLabelOffsetsOptions = {}
): Map<string, LabelLayout> {
  const {
    baseOffsetX = 15,
    baseOffsetY = 15,
    margin = 2,
    maxAttempts = 20,
  } = options;

  const safeScale = Math.max(scale, 0.001);
  const result = new Map<string, LabelLayout>();

  const items = candidates.map(candidate => {
    const { width, height } = measureLabelLines(candidate.lines, style);
    const sx = candidate.worldX * safeScale;
    const sy = -candidate.worldY * safeScale;
    const left = sx + baseOffsetX;
    const bottom = sy - baseOffsetY;
    const top = bottom - height;
    return { id: candidate.id, sx, sy, width, height, left, top };
  });

  items.sort((a, b) => (a.top - b.top) || (a.left - b.left));

  const placed: LabelRect[] = [];

  for (const item of items) {
    let rect: LabelRect = { left: item.left, top: item.top, width: item.width, height: item.height };
    let attempts = 0;
    while (attempts < maxAttempts) {
      const collision = placed.find(p => rectsIntersect(rect, p, margin));
      if (!collision) break;
      rect = { ...rect, top: collision.top + collision.height + margin };
      attempts++;
    }
    placed.push(rect);

    result.set(item.id, {
      x: (rect.left - item.sx) / safeScale,
      y: (rect.top + rect.height - item.sy) / safeScale,
      width: item.width,
      height: item.height,
    });
  }

  return result;
}
