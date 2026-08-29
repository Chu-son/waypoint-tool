import React, { useState, useCallback } from 'react';
import { computeRangeSelection } from '../utils/treeUtils';

export interface UseTreeItemSelectionOptions {
  selectedIds: string[];
  selectFn: (ids: string[], multi?: boolean) => void;
  visibleIds: string[];
  onInspect?: () => void;
  elementCopyState?: { previewNodeId?: string | null } | null;
  onElementCopySelect?: (id: string) => void;
}

export function useTreeItemSelection({
  selectedIds,
  selectFn,
  visibleIds,
  onInspect,
  elementCopyState,
  onElementCopySelect,
}: UseTreeItemSelectionOptions) {
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const handleItemClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();

      if (elementCopyState && onElementCopySelect) {
        onElementCopySelect(id);
        setLastSelectedId(id);
        return;
      }

      const isMulti = e.ctrlKey || e.metaKey;
      const isRange = e.shiftKey;

      if (isRange && lastSelectedId && visibleIds.includes(lastSelectedId)) {
        const range = computeRangeSelection(id, lastSelectedId, visibleIds, selectedIds, isMulti);
        selectFn(range, false);
      } else {
        setLastSelectedId(id);
        selectFn([id], isMulti);
      }

      onInspect?.();
    },
    [lastSelectedId, visibleIds, selectedIds, selectFn, onInspect, elementCopyState, onElementCopySelect]
  );

  const handleItemContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (!selectedIds.includes(id)) {
        selectFn([id], false);
        setLastSelectedId(id);
      }
    },
    [selectedIds, selectFn]
  );

  return {
    lastSelectedId,
    setLastSelectedId,
    handleItemClick,
    handleItemContextMenu,
  };
}
