import { useState, useEffect, useRef } from 'react';

export type ResponsiveTier = 'compact' | 'normal' | 'wide';

export interface ResponsiveThresholds {
  compact: number;
  normal: number;
}

const DEFAULT_THRESHOLDS: ResponsiveThresholds = {
  compact: 600,
  normal: 900,
};

/**
 * 対象要素の実際のレンダリング幅（px）を ResizeObserver で監視し、
 * 'compact' (< compactThreshold), 'normal' (compact ~ normal), 'wide' (>= normalThreshold)
 * の3段階のレスポンシブティアを動的に返します。
 */
export function useResponsiveContainer<T extends HTMLElement = HTMLDivElement>(
  thresholds: ResponsiveThresholds = DEFAULT_THRESHOLDS
) {
  const containerRef = useRef<T>(null);
  const [tier, setTier] = useState<ResponsiveTier>('wide');
  const [width, setWidth] = useState<number>(1000);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // absolute要素の場合は親要素の利用可能幅を監視、そうでなければ要素自身の幅を監視
    const targetEl = el.parentElement || el;

    const updateWidth = (w: number) => {
      setWidth(w);
      if (w < thresholds.compact) {
        setTier('compact');
      } else if (w < thresholds.normal) {
        setTier('normal');
      } else {
        setTier('wide');
      }
    };

    // 初期幅の設定
    const initialWidth = targetEl.getBoundingClientRect().width;
    if (initialWidth > 0) {
      updateWidth(initialWidth);
    }

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        updateWidth(w);
      }
    });

    observer.observe(targetEl);
    return () => observer.disconnect();
  }, [thresholds.compact, thresholds.normal]);

  return { containerRef, tier, width, isCompact: tier === 'compact', isNormal: tier === 'normal', isWide: tier === 'wide' };
}
