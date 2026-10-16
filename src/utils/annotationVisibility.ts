import type { AnnotationGroup, AnnotationObject } from '../types/store';

/**
 * Whether an annotation is shown: its own flag AND the flag of every group above it. A group's flag never
 * overwrites its children's, so showing the group again brings back exactly what was shown before
 * (the same meaning as layer groups).
 */
export function isAnnotationShown(
  annotation: Pick<AnnotationObject, 'visible' | 'group_id'>,
  groups: Record<string, AnnotationGroup>,
): boolean {
  if (!annotation.visible) return false;
  const seen = new Set<string>();
  let groupId = annotation.group_id;
  while (groupId && !seen.has(groupId)) {
    seen.add(groupId);
    const group = groups[groupId];
    if (!group) break;
    if (group.visible === false) return false;
    groupId = group.parent_id;
  }
  return true;
}

/** Ids of the annotations and groups that sit under a hidden group (their own flags are not considered). */
export function idsHiddenByAnnotationGroups(groups: Record<string, AnnotationGroup>): Set<string> {
  const hidden = new Set<string>();
  const hide = (groupId: string) => {
    for (const childId of groups[groupId]?.children_ids ?? []) {
      if (hidden.has(childId)) continue;
      hidden.add(childId);
      if (groups[childId]) hide(childId);
    }
  };
  for (const group of Object.values(groups)) {
    if (group.visible === false) hide(group.id);
  }
  return hidden;
}
