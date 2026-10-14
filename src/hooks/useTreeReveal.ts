import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';

export interface UseTreeRevealProps {
  treeType: 'node' | 'annotation';
  getAncestorIds: (id: string) => string[];
  /** Opens the given containers; must be a stable reference. */
  expandItems: (ids: string[]) => void;
  scrollDelayMs?: number;
  flashDurationMs?: number;
}

export function useTreeReveal({
  treeType,
  getAncestorIds,
  expandItems,
  scrollDelayMs = 60,
  flashDurationMs = 1800,
}: UseTreeRevealProps) {
  const treeRevealTarget = useAppStore((state) => state.treeRevealTarget);
  const clearTreeRevealTarget = useAppStore((state) => state.clearTreeRevealTarget);
  const [flashingId, setFlashingId] = useState<string | null>(null);
  const lastProcessedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!treeRevealTarget || treeRevealTarget.type !== treeType) return;
    if (lastProcessedRef.current === treeRevealTarget.timestamp) return;
    lastProcessedRef.current = treeRevealTarget.timestamp;

    const { id } = treeRevealTarget;
    const ancestors = getAncestorIds(id);

    // 1. 先祖グループを自動展開
    if (ancestors.length > 0) expandItems(ancestors);

    // 2. DOMの更新・レンダリング完了を待ってスクロール＆フラッシュ
    const scrollTimer = setTimeout(() => {
      const element = document.querySelector(`[data-tree-item-id="${id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setFlashingId(id);
        setTimeout(() => {
          setFlashingId((curr) => (curr === id ? null : curr));
        }, flashDurationMs);
      }
      clearTreeRevealTarget();
    }, scrollDelayMs);

    return () => {
      clearTimeout(scrollTimer);
    };
  }, [treeRevealTarget, treeType, getAncestorIds, expandItems, clearTreeRevealTarget, scrollDelayMs, flashDurationMs]);

  return { flashingId };
}
