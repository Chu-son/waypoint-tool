/** Commands on the annotation tree that its menu and the keyboard shortcuts share (like `layerCommands`). */
import { useAppStore } from '../stores/appStore';

export const ANNOTATION_TREE_ID = 'annotations';

/** Ids selected in the annotation tree, or none when something else is selected. */
export function selectedAnnotationItemIds(): string[] {
  const { selection } = useAppStore.getState();
  return selection.type === 'annotations' ? selection.ids : [];
}

/** Wraps the annotations in a new group, opened and selected; returns its id. */
export function groupAnnotationItems(ids: string[]): string | null {
  const store = useAppStore.getState();
  const groupId = store.groupAnnotations(ids);
  if (groupId) store.expandTreeItems(ANNOTATION_TREE_ID, [groupId]);
  return groupId;
}

/** Dissolves the groups among `ids`, selecting what they held. */
export function ungroupAnnotationItems(ids: string[]): void {
  const store = useAppStore.getState();
  const groups = ids.filter((id) => store.annotationGroups[id]);
  if (groups.length === 0) return;
  const released = groups.flatMap((id) => store.annotationGroups[id].children_ids ?? []);
  store.runInHistoryTransaction(() => groups.forEach((id) => useAppStore.getState().ungroupAnnotation(id)));
  useAppStore.getState().selectAnnotationObjects(released);
}
