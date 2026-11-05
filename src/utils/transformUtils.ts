import { WaypointNode, Transform } from '../types/store';
import type { ElementCopyState } from '../types/ui';

export interface AnchorRelativeTransform {
  relX: number;
  relY: number;
  relZ: number;
  relYaw: number;
}

export function quaternionToYaw(transform: Partial<Transform> | undefined | null): number {
  if (!transform) return 0;
  const qx = transform.qx || 0;
  const qy = transform.qy || 0;
  const qz = transform.qz || 0;
  const qw = transform.qw ?? 1;

  const yaw = Math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz));
  return isFinite(yaw) ? yaw : 0;
}

export function yawToQuaternion(yaw: number): { qx: number; qy: number; qz: number; qw: number } {
  const halfYaw = yaw / 2.0;
  return {
    qx: 0,
    qy: 0,
    qz: Math.sin(halfYaw),
    qw: Math.cos(halfYaw),
  };
}

/**
 * Turns an orientation by `dyaw` about the world Z axis (left-multiplies by that rotation), keeping any
 * roll and pitch. Missing components count as the identity.
 */
export function rotateQuaternionAboutZ(
  q: Partial<Pick<Transform, 'qx' | 'qy' | 'qz' | 'qw'>>,
  dyaw: number,
): { qx: number; qy: number; qz: number; qw: number } {
  const qx = q.qx ?? 0;
  const qy = q.qy ?? 0;
  const qz = q.qz ?? 0;
  const qw = q.qw ?? 1;
  const s = Math.sin(dyaw / 2);
  const c = Math.cos(dyaw / 2);
  return { qx: c * qx - s * qy, qy: c * qy + s * qx, qz: c * qz + s * qw, qw: c * qw - s * qz };
}

export function calculateAnchorRelativeTransform(
  targetTransform: Partial<Transform>,
  anchorTransform: Partial<Transform>,
): AnchorRelativeTransform {
  const ax = anchorTransform.x ?? 0;
  const ay = anchorTransform.y ?? 0;
  const az = anchorTransform.z ?? 0;
  const aYaw = quaternionToYaw(anchorTransform);

  const cx = targetTransform.x ?? 0;
  const cy = targetTransform.y ?? 0;
  const cz = targetTransform.z ?? 0;
  const cYaw = quaternionToYaw(targetTransform);

  const dx = cx - ax;
  const dy = cy - ay;
  const relZ = cz - az;

  const relX = dx * Math.cos(aYaw) + dy * Math.sin(aYaw);
  const relY = -dx * Math.sin(aYaw) + dy * Math.cos(aYaw);

  let relYaw = cYaw - aYaw;
  while (relYaw > Math.PI) relYaw -= 2 * Math.PI;
  while (relYaw < -Math.PI) relYaw += 2 * Math.PI;

  return { relX, relY, relZ, relYaw };
}

export function applyElementPaste(
  targetNode: WaypointNode,
  copyState: NonNullable<ElementCopyState>,
  anchorNodeId: string | null,
  nodes: Record<string, WaypointNode>,
  updateNode: (id: string, updates: Partial<WaypointNode>) => void,
) {
  if (!targetNode.transform) return;
  const tf = targetNode.transform;

  if (copyState.coordSystem === 'world') {
    switch (copyState.field) {
      case 'x':
        updateNode(targetNode.id, { transform: { ...tf, x: copyState.value } });
        break;
      case 'y':
        updateNode(targetNode.id, { transform: { ...tf, y: copyState.value } });
        break;
      case 'z':
        updateNode(targetNode.id, { transform: { ...tf, z: copyState.value } });
        break;
      case 'yaw': {
        const q = yawToQuaternion(copyState.value);
        updateNode(targetNode.id, { transform: { ...tf, ...q } });
        break;
      }
    }
  } else {
    if (!anchorNodeId || !nodes[anchorNodeId] || !nodes[anchorNodeId].transform) {
      console.error('[applyElementPaste] anchor-relative paste was attempted but anchorNode is missing.', {
        anchorNodeId,
        copyState,
      });
      return;
    }
    const anchor = nodes[anchorNodeId];
    const aTf = anchor.transform!;
    const aYaw = quaternionToYaw(aTf);
    const ax = aTf.x ?? 0;
    const ay = aTf.y ?? 0;
    const az = aTf.z ?? 0;
    const cx = tf.x ?? 0;
    const cy = tf.y ?? 0;

    switch (copyState.field) {
      case 'x': {
        const dx = cx - ax;
        const dy = cy - ay;
        const curRelY = -dx * Math.sin(aYaw) + dy * Math.cos(aYaw);
        const newDx = copyState.value * Math.cos(aYaw) - curRelY * Math.sin(aYaw);
        const newDy = copyState.value * Math.sin(aYaw) + curRelY * Math.cos(aYaw);
        updateNode(targetNode.id, { transform: { ...tf, x: ax + newDx, y: ay + newDy } });
        break;
      }
      case 'y': {
        const dx = cx - ax;
        const dy = cy - ay;
        const curRelX = dx * Math.cos(aYaw) + dy * Math.sin(aYaw);
        const newDx = curRelX * Math.cos(aYaw) - copyState.value * Math.sin(aYaw);
        const newDy = curRelX * Math.sin(aYaw) + copyState.value * Math.cos(aYaw);
        updateNode(targetNode.id, { transform: { ...tf, x: ax + newDx, y: ay + newDy } });
        break;
      }
      case 'z': {
        updateNode(targetNode.id, { transform: { ...tf, z: az + copyState.value } });
        break;
      }
      case 'yaw': {
        const newYaw = aYaw + copyState.value;
        const q = yawToQuaternion(newYaw);
        updateNode(targetNode.id, { transform: { ...tf, ...q } });
        break;
      }
    }
  }
}
