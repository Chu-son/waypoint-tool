import {
  WaypointNode,
  WaypointDiffItem,
  GeneratorStash,
  GeneratorModificationSummary,
  WaypointOptions,
  Transform,
} from '../types/store';
import { quaternionToYaw, yawToQuaternion } from './transformUtils';

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function areOptionsEqual(
  optA?: WaypointOptions,
  optB?: WaypointOptions
): boolean {
  if (!optA && !optB) return true;
  if (!optA || !optB) {
    const nonNull = optA || optB;
    return Object.keys(nonNull || {}).length === 0;
  }

  const keysA = Object.keys(optA);
  const keysB = Object.keys(optB);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    const valA = optA[key];
    const valB = optB[key];
    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (valA.length !== valB.length) return false;
      for (let i = 0; i < valA.length; i++) {
        if (valA[i] !== valB[i]) return false;
      }
    } else if (valA !== valB) {
      return false;
    }
  }
  return true;
}

/**
 * ジェネレーターの子ウェイポイントが生成時のベースラインから手動変更されているかを検知する
 */
export function detectGeneratorModifications(
  generatorNode: WaypointNode,
  allNodes: Record<string, WaypointNode>
): GeneratorModificationSummary {
  const baseline = generatorNode.baseline_waypoints;
  const childrenIds = generatorNode.children_ids || [];

  if (!baseline || baseline.length === 0) {
    return {
      hasModifications: false,
      modifiedCount: 0,
      totalCurrent: childrenIds.length,
      totalBaseline: 0,
      diffs: [],
      hasCountChanged: false,
    };
  }

  const hasCountChanged = childrenIds.length !== baseline.length;
  const diffs: WaypointDiffItem[] = [];

  const maxLen = Math.max(childrenIds.length, baseline.length);

  for (let i = 0; i < maxLen; i++) {
    const childId = childrenIds[i];
    const childNode = childId ? allNodes[childId] : undefined;
    const baseItem = baseline[i];

    if (childNode && baseItem) {
      const curT: Transform = childNode.transform || {
        x: 0,
        y: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
      };
      const baseT: Transform = baseItem.transform || {
        x: 0,
        y: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
      };

      const deltaX = (curT.x ?? 0) - (baseT.x ?? 0);
      const deltaY = (curT.y ?? 0) - (baseT.y ?? 0);
      const deltaZ = (curT.z ?? 0) - (baseT.z ?? 0);

      const curYaw = quaternionToYaw(curT);
      const baseYaw = quaternionToYaw(baseT);
      const deltaYaw = normalizeAngle(curYaw - baseYaw);

      const hasTransformDiff =
        Math.abs(deltaX) > 1e-4 ||
        Math.abs(deltaY) > 1e-4 ||
        Math.abs(deltaZ) > 1e-4 ||
        Math.abs(deltaYaw) > 1e-3;

      const optionsEqual = areOptionsEqual(childNode.options, baseItem.options);
      const nameDiff =
        childNode.name !== undefined &&
        baseItem.name !== undefined &&
        childNode.name !== baseItem.name;

      if (hasTransformDiff || !optionsEqual || nameDiff) {
        diffs.push({
          index: i,
          hasTransformDiff,
          deltaX,
          deltaY,
          deltaZ,
          deltaYaw,
          modifiedOptions: !optionsEqual ? childNode.options : undefined,
          customName: nameDiff ? childNode.name : undefined,
        });
      }
    } else if (childNode && !baseItem) {
      // ユーザーによって末尾に追加された子ノード
      const curT: Transform = childNode.transform || {
        x: 0,
        y: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
      };
      const curYaw = quaternionToYaw(curT);
      diffs.push({
        index: i,
        hasTransformDiff: true,
        deltaX: curT.x ?? 0,
        deltaY: curT.y ?? 0,
        deltaZ: curT.z ?? 0,
        deltaYaw: curYaw,
        modifiedOptions: childNode.options,
        customName: childNode.name,
      });
    }
  }

  return {
    hasModifications: diffs.length > 0 || hasCountChanged,
    modifiedCount: diffs.length,
    totalCurrent: childrenIds.length,
    totalBaseline: baseline.length,
    diffs,
    hasCountChanged,
  };
}

/**
 * 手動変更の差分をスタッシュ（退避データ）として算出する
 */
export function computeGeneratorStash(
  generatorNode: WaypointNode,
  allNodes: Record<string, WaypointNode>
): GeneratorStash {
  const summary = detectGeneratorModifications(generatorNode, allNodes);
  const stash: GeneratorStash = {};

  for (const diff of summary.diffs) {
    stash[diff.index] = diff;
  }

  return stash;
}

/**
 * プラグインが新しく生成したウェイポイント一覧に、スタッシュされた手動変更差分を適用する
 */
export function applyGeneratorStash(
  generatedWaypoints: any[],
  stash: GeneratorStash
): any[] {
  if (!stash || Object.keys(stash).length === 0) {
    return generatedWaypoints;
  }

  return generatedWaypoints.map((rawWp, index) => {
    const diff = stash[index];
    if (!diff) {
      return rawWp;
    }

    const cloned = JSON.parse(JSON.stringify(rawWp));

    // 既存の座標とクォータニオンを取得
    let origX = cloned.transform?.x ?? cloned.x ?? 0;
    let origY = cloned.transform?.y ?? cloned.y ?? 0;
    let origZ = cloned.transform?.z ?? cloned.z ?? 0;

    let origYaw = 0;
    if (typeof cloned.yaw === 'number') {
      origYaw = cloned.yaw;
    } else if (cloned.transform) {
      origYaw = quaternionToYaw(cloned.transform);
    } else if (cloned.qw !== undefined || cloned.qz !== undefined) {
      origYaw = quaternionToYaw({
        qx: cloned.qx ?? 0,
        qy: cloned.qy ?? 0,
        qz: cloned.qz ?? 0,
        qw: cloned.qw ?? 1,
      });
    }

    const newX = origX + diff.deltaX;
    const newY = origY + diff.deltaY;
    const newZ = origZ + diff.deltaZ;
    const newYaw = normalizeAngle(origYaw + diff.deltaYaw);
    const quat = yawToQuaternion(newYaw);

    if (cloned.transform) {
      cloned.transform.x = newX;
      cloned.transform.y = newY;
      cloned.transform.z = newZ;
      cloned.transform.qx = quat.qx;
      cloned.transform.qy = quat.qy;
      cloned.transform.qz = quat.qz;
      cloned.transform.qw = quat.qw;
    } else {
      cloned.x = newX;
      cloned.y = newY;
      cloned.z = newZ;
      cloned.qx = quat.qx;
      cloned.qy = quat.qy;
      cloned.qz = quat.qz;
      cloned.qw = quat.qw;
      if (cloned.yaw !== undefined) {
        cloned.yaw = newYaw;
      }
    }

    if (diff.modifiedOptions) {
      cloned.options = {
        ...(cloned.options || {}),
        ...diff.modifiedOptions,
      };
    }

    if (diff.customName) {
      cloned.name = diff.customName;
    }

    return cloned;
  });
}
