import { useCallback, useEffect, useRef } from 'react';

export type EditBoundary = {
  /** Called when an edit (typing, a drag, a held button) begins, so it can become one undo step. */
  onEditStart?: () => void;
  /** Called when that edit ends; also when the component unmounts mid-edit. */
  onEditEnd?: () => void;
};

/**
 * The `onEditStart` / `onEditEnd` convention of the input components: `start` and `end` call them at most
 * once per edit, and an edit still open when the component unmounts is ended then.
 */
export function useEditSession({ onEditStart, onEditEnd }: EditBoundary) {
  const latest = useRef({ onEditStart, onEditEnd });
  latest.current = { onEditStart, onEditEnd };
  const editing = useRef(false);

  const start = useCallback(() => {
    if (editing.current) return;
    editing.current = true;
    latest.current.onEditStart?.();
  }, []);

  const end = useCallback(() => {
    if (!editing.current) return;
    editing.current = false;
    latest.current.onEditEnd?.();
  }, []);

  useEffect(() => end, [end]);

  return { start, end, isEditing: () => editing.current };
}
