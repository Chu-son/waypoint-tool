import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { Copy, Loader2 } from 'lucide-react';
import { Slider } from './common/Slider';
import { getPrecedingManualWaypoint } from '../../utils/treeUtils';

export const StatusBar: React.FC = () => {
  const cursorPosition = useAppStore(state => state.cursorPosition);
  const mapScale = useAppStore(state => state.mapScale);
  const nodes = useAppStore(state => state.nodes);
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const insertionTarget = useAppStore(state => state.insertionTarget);
  const elementCopyState = useAppStore(state => state.elementCopyState);

  // 直前のマニュアルウェイポイント（相対座標計算用）
  const latestNode = getPrecedingManualWaypoint(rootNodeIds, nodes, insertionTarget);

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
  const activeLoadingTasks = useAppStore(state => state.activeLoadingTasks);

  const backgroundTasks = Object.values(activeLoadingTasks).filter(t => t.blocking === false);
  const activeBgTask = backgroundTasks.sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <div className="h-6 flex items-center justify-between px-3 bg-surface-panel border-t border-border-base text-xs text-text-muted flex-shrink-0 z-50">
      {/* Left Section: Status / Tool Info / Occupancy Legend */}
      <div className="flex-1 flex items-center space-x-3 overflow-hidden text-ellipsis whitespace-nowrap">
        {elementCopyState ? (
          <span className="text-accent-anchor font-medium flex items-center gap-1.5 animate-pulse">
            <Copy size={12} />
            要素コピーモード: {elementCopyState.field.toUpperCase()} ({elementCopyState.coordSystem === 'world' ? 'World' : '⚓ Anchor相対'}) = {elementCopyState.value.toFixed(4)}
            <span className="text-text-muted font-normal ml-1">(クリックで選択 → 左上ボタンで確定/完了)</span>
          </span>
        ) : showOccupancyHighlight ? (
          <div className="flex items-center gap-3 text-[11px]">
            <span className="font-semibold text-text-base flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-reference animate-pulse inline-block" />
              Highlight Mode:
            </span>
            <span className="text-occupancy-obstacle font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-occupancy-obstacle inline-block" />
              Obstacle
            </span>
            <span className="text-occupancy-free font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-occupancy-free inline-block" />
              Free
            </span>
            <span className="text-occupancy-unknown font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-occupancy-unknown inline-block" />
              Unknown
            </span>
            <div className="flex items-center gap-1.5 ml-2 w-28">
              <span className="text-[10px] text-text-muted shrink-0">Alpha:</span>
              <Slider
                min={0.1}
                max={1.0}
                step={0.05}
                value={occupancyHighlightAlpha}
                onChange={(e) => setOccupancyHighlightAlpha(parseFloat(e.target.value))}
                title={`Highlight Alpha: ${Math.round(occupancyHighlightAlpha * 100)}%`}
              />
              <span className="text-[10px] font-mono shrink-0">{Math.round(occupancyHighlightAlpha * 100)}%</span>
            </div>
          </div>
        ) : activeBgTask ? (
          <span className="text-primary-base font-medium flex items-center gap-1.5 animate-pulse">
            <Loader2 size={12} className="animate-spin" />
            {activeBgTask.message}
          </span>
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
        {insertionTarget && (
          <span
            onClick={() => useAppStore.getState().setInsertionTarget(null)}
            className="cursor-pointer font-sans text-[11px] px-1.5 py-0.5 rounded bg-primary-base/20 border border-primary-base/40 text-primary-base hover:bg-primary-base/30 transition-colors flex items-center gap-1"
            title="クリックで挿入位置指定を解除"
          >
            📍 挿入: {insertionTarget.parentId ? (nodes[insertionTarget.parentId]?.name || 'Group') : 'ルート'} [{insertionTarget.index}] ✕
          </span>
        )}
        <span className="font-mono">Zoom: {(mapScale * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
};
