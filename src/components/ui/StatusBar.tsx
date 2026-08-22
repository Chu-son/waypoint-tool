import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { Copy } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const cursorPosition = useAppStore(state => state.cursorPosition);
  const mapScale = useAppStore(state => state.mapScale);
  const nodes = useAppStore(state => state.nodes);
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const insertionIndex = useAppStore(state => state.insertionIndex);
  const elementCopyState = useAppStore(state => state.elementCopyState);

  // Calculate the latest waypoint (the point immediately before the insertion point or at the very end)
  const getLatestWaypoint = () => {
    const targetIndex = insertionIndex !== -1 ? insertionIndex - 1 : rootNodeIds.length - 1;
    if (targetIndex >= 0 && targetIndex < rootNodeIds.length) {
      const nodeId = rootNodeIds[targetIndex];
      return nodes[nodeId];
    }
    return null;
  };

  const latestNode = getLatestWaypoint();

  let relativeText = "";
  if (latestNode && latestNode.transform && cursorPosition) {
    const transform = latestNode.transform;
    const Wx = transform.x ?? 0;
    const Wy = transform.y ?? 0;
    const qx = transform.qx ?? 0;
    const qy = transform.qy ?? 0;
    const qz = transform.qz ?? 0;
    const qw = transform.qw ?? 1;
    
    let yaw = Math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz));
    if (!isFinite(yaw)) yaw = 0;

    const dx = cursorPosition.x - Wx;
    const dy = cursorPosition.y - Wy;

    // Convert to local coordinate frame of the latest waypoint
    const localX = dx * Math.cos(-yaw) - dy * Math.sin(-yaw);
    const localY = dx * Math.sin(-yaw) + dy * Math.cos(-yaw);
    
    relativeText = `(Relative) X: ${localX.toFixed(3)} Y: ${localY.toFixed(3)}`;
  }

  const showOccupancyHighlight = useAppStore(state => state.showOccupancyHighlight);
  const occupancyHighlightAlpha = useAppStore(state => state.occupancyHighlightAlpha);
  const setOccupancyHighlightAlpha = useAppStore(state => state.setOccupancyHighlightAlpha);

  return (
    <div className="h-6 flex items-center justify-between px-3 bg-surface-panel border-t border-border-base text-xs text-text-muted flex-shrink-0 z-50">
      {/* Left Section: Status / Tool Info / Occupancy Legend */}
      <div className="flex-1 flex items-center space-x-3 overflow-hidden text-ellipsis whitespace-nowrap">
        {elementCopyState ? (
          <span className="text-amber-400 font-medium flex items-center gap-1.5 animate-pulse">
            <Copy size={12} />
            要素コピーモード: {elementCopyState.field.toUpperCase()} ({elementCopyState.coordSystem === 'world' ? 'World' : '⚓ Anchor相対'}) = {elementCopyState.value.toFixed(4)}
            <span className="text-text-muted font-normal ml-1">(クリックで選択 → 左上ボタンで確定/完了)</span>
          </span>
        ) : showOccupancyHighlight ? (
          <div className="flex items-center gap-3 text-[11px]">
            <span className="font-semibold text-text-base flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse inline-block" />
              Highlight Mode:
            </span>
            <span className="text-rose-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-rose-500 inline-block" />
              Obstacle
            </span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-emerald-500 inline-block" />
              Free
            </span>
            <span className="text-purple-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-purple-500 inline-block" />
              Unknown
            </span>
            <div className="flex items-center gap-1 ml-2">
              <span className="text-[10px] text-text-muted">Alpha:</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={occupancyHighlightAlpha}
                onChange={(e) => setOccupancyHighlightAlpha(parseFloat(e.target.value))}
                className="w-14 h-1.5 accent-purple-400 cursor-pointer"
                title={`Highlight Alpha: ${Math.round(occupancyHighlightAlpha * 100)}%`}
              />
              <span className="text-[10px] font-mono">{Math.round(occupancyHighlightAlpha * 100)}%</span>
            </div>
          </div>
        ) : (
          <span>Ready</span>
        )}
      </div>

      {/* Center Section: Cursor Coordinates */}
      <div className="flex-1 flex justify-center items-center space-x-6 min-w-max">
        {cursorPosition ? (
          <>
            <span className="font-mono">
              (World) X: {cursorPosition.x.toFixed(3)} Y: {cursorPosition.y.toFixed(3)}
            </span>
            {relativeText && (
              <span className="font-mono text-primary-base/80">
                {relativeText}
              </span>
            )}
          </>
        ) : (
          <span className="font-mono text-text-muted/50">Cursor outside map</span>
        )}
      </div>

      {/* Right Section: Zoom & Extensions */}
      <div className="flex-1 flex justify-end items-center space-x-4">
        <span className="font-mono">Zoom: {(mapScale * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
};
