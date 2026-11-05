import { memo, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/appStore';
import { basePoseTarget, effectiveBasePose } from '../../../stores/groupMove';
import { CANVAS_BASE_POSE_COLOR } from '../canvasConstants';

/**
 * The reference pose of the waypoint or annotation group shown in the inspector: a ring at its position
 * and an arrow along its heading. Turns and typed values in the inspector work around this point. Drawn
 * faint while the pose is only the centre of the contents (not stored yet, so it follows edits).
 */
export const BasePoseMarkerLayer = memo(function BasePoseMarkerLayer({ scale }: { scale: number }) {
  const target = useAppStore(useShallow(basePoseTarget));
  const pose = useAppStore(useShallow((state) => (target ? effectiveBasePose(state, target.domain, target.id) : null)));
  const isStored = useAppStore((state) => {
    if (!target) return false;
    const item = target.domain === 'node' ? state.nodes[target.id] : state.annotationGroups[target.id];
    return !!item?.base_pose;
  });

  const yaw = pose?.yaw ?? 0;
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      const radius = 6 / scale;
      const arrow = 28 / scale;
      const head = 7 / scale;
      const width = 2 / scale;
      const alpha = isStored ? 1 : 0.5;
      const tipX = Math.cos(yaw) * arrow;
      const tipY = Math.sin(yaw) * arrow;

      g.strokeStyle = { width, color: CANVAS_BASE_POSE_COLOR, alpha };
      g.circle(0, 0, radius);
      g.moveTo(Math.cos(yaw) * radius, Math.sin(yaw) * radius);
      g.lineTo(tipX, tipY);
      g.moveTo(tipX, tipY);
      g.lineTo(tipX - Math.cos(yaw - 0.5) * head, tipY - Math.sin(yaw - 0.5) * head);
      g.moveTo(tipX, tipY);
      g.lineTo(tipX - Math.cos(yaw + 0.5) * head, tipY - Math.sin(yaw + 0.5) * head);
      g.stroke();
    },
    [scale, yaw, isStored],
  );

  if (!pose) return null;
  return <pixiGraphics x={pose.x} y={pose.y} draw={draw} />;
});
