import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';

export interface UseTreeRevealProps {
  treeType: 'node' | 'annotation';
  getAncestorIds: (id: string) => string[];
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  scrollDelayMs?: number;
  flashDurationMs?: number;
}

export function useTreeReveal({
  treeType,
  getAncestorIds,
  setExpanded,
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
    if (ancestors.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        let changed = false;
        ancestors.forEach((ancId) => {
          if (!next.has(ancId)) {
            next.add(ancId);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

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
  }, [treeRevealTarget, treeType, getAncestorIds, setExpanded, clearTreeRevealTarget, scrollDelayMs, flashDurationMs]);

  return { flashingId };
}
