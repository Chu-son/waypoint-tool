import { useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { basePoseTarget, effectiveBasePose, type GroupDomain } from '../stores/groupMove';
import type { Pose2D } from '../types/geometry';

/**
 * The reference pose of a waypoint or annotation group, and whether it is stored (or only the centre of the
 * contents). Recomputed only when waypoints or annotations change, not on every store update (the cursor
 * position is written on each pointer move).
 */
export function useBasePose(domain: GroupDomain, id: string): { pose: Pose2D | null; isStored: boolean } {
  const nodes = useAppStore((state) => state.nodes);
  const annotationGroups = useAppStore((state) => state.annotationGroups);
  const annotationObjects = useAppStore((state) => state.annotationObjects);
  return useMemo(() => {
    const item = domain === 'node' ? nodes[id] : annotationGroups[id];
    return {
      pose: effectiveBasePose({ nodes, annotationGroups, annotationObjects }, domain, id),
      isStored: !!item?.base_pose,
    };
  }, [domain, id, nodes, annotationGroups, annotationObjects]);
}

/** The group whose reference pose the inspector shows (see `basePoseTarget`), recomputed only when needed. */
export function useBasePoseTarget(): { domain: GroupDomain; id: string } | null {
  const appMode = useAppStore((state) => state.appMode);
  const selection = useAppStore((state) => state.selection);
  const nodes = useAppStore((state) => state.nodes);
  const annotationGroups = useAppStore((state) => state.annotationGroups);
  return useMemo(
    () => basePoseTarget({ appMode, selection, nodes, annotationGroups }),
    [appMode, selection, nodes, annotationGroups],
  );
}
