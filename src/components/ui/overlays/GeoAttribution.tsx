import { useAppStore } from '../../../stores/appStore';
import { resolveBasemap } from '../../../utils/geo/basemapPresets';

/** 背景地図の帰属表示（タイル提供元の利用条件により、地図の表示中は常に出す）。 */
export function GeoAttribution() {
  const geoMap = useAppStore((state) => state.geoMap);
  if (!geoMap.enabled) return null;

  const { attribution } = resolveBasemap(geoMap.basemapId, geoMap.customBasemap);
  if (!attribution) return null;

  return (
    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-surface-panel/80 text-[10px] text-text-muted pointer-events-none select-none">
      {attribution}
    </div>
  );
}
