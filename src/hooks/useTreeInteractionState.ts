import { useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export interface TreeContextMenuState {
  /** The item the menu was opened on, or null for the empty area. */
  id: string | null;
  x: number;
  y: number;
}

/** UI state shared by the sortable trees: DnD sensors, inline rename, drag, context menu, expansion. */
export function useTreeInteractionState() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<TreeContextMenuState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return {
    expanded,
    setExpanded,
    editingId,
    setEditingId,
    activeDragId,
    setActiveDragId,
    contextMenu,
    setContextMenu,
    sensors,
  };
}
