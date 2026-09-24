import { useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useAppStore } from '../../../stores/appStore';
import { CANVAS_GEO_ANCHOR_COLOR } from '../canvasConstants';

/**
 * 背景地図の位置合わせ中に、地図の原点（緯度経度/UTM で指定した地点）がワールド上で置かれている位置と、
 * その地図の東方向（回転の向き）を示す。回転はこの点を軸に行う。
 */
export function GeoAlignMarkerLayer({ scale }: { scale: number }) {
  const active = useAppStore((state) => state.appMode.mode === 'geo_map_align' && state.geoMap.enabled);
  const alignment = useAppStore((state) => state.geoMap.alignment);

  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      const arm = 14 / scale;
      const radius = 5 / scale;
      const yaw = (alignment.yawDeg * Math.PI) / 180;
      const width = 2 / scale;

      g.strokeStyle = { width, color: CANVAS_GEO_ANCHOR_COLOR };
      g.circle(0, 0, radius);
      g.stroke();
      g.moveTo(-arm, 0);
      g.lineTo(arm, 0);
      g.moveTo(0, -arm);
      g.lineTo(0, arm);
      g.stroke();

      // 地図の東方向
      g.strokeStyle = { width: width * 1.5, color: CANVAS_GEO_ANCHOR_COLOR };
      g.moveTo(0, 0);
      g.lineTo(Math.cos(yaw) * arm * 2.5, Math.sin(yaw) * arm * 2.5);
      g.stroke();
    },
    [scale, alignment.yawDeg],
  );

  if (!active) return null;
  return <pixiGraphics x={alignment.dx} y={alignment.dy} draw={draw} />;
}
