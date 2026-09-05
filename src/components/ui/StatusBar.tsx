import React from 'react';
import { useAppStore } from '../../stores/appStore';
import {
  MousePointer2,
  MapPin,
  Pencil,
  Layers,
  Sparkles,
  Plug,
  Copy,
  Crop,
  AppWindow,
  Magnet,
  Check,
  Loader2,
  Maximize2,
} from 'lucide-react';
import { Slider } from './common/Slider';
import { getPrecedingManualWaypoint, getFlattenedWaypointIds } from '../../utils/treeUtils';
import { computeStatusInteraction, computeTotalPathDistance, StatusIconType, StatusModeVariant } from '../../utils/statusUtils';
import { cn } from '../../utils/cn';

function ModeIcon({ icon }: { icon: StatusIconType }) {
  const size = 12;
  switch (icon) {
    case 'waypoint':
      return <MapPin size={size} />;
    case 'annotation':
      return <Pencil size={size} />;
    case 'layer':
      return <Layers size={size} />;
    case 'generator':
      return <Sparkles size={size} />;
    case 'plugin':
      return <Plug size={size} />;
    case 'copy':
      return <Copy size={size} />;
    case 'region':
      return <Crop size={size} />;
    case 'modal':
      return <AppWindow size={size} />;
    case 'select':
    default:
      return <MousePointer2 size={size} />;
  }
}

function getModeBadgeClasses(variant: StatusModeVariant): string {
  switch (variant) {
    case 'primary':
      return 'bg-primary-base/15 border-primary-base/40 text-primary-base';
    case 'reference':
      return 'bg-accent-reference/15 border-accent-reference/40 text-accent-reference';
    case 'obstacle':
      return 'bg-occupancy-obstacle/15 border-occupancy-obstacle/40 text-occupancy-obstacle';
    case 'anchor':
      return 'bg-accent-anchor/15 border-accent-anchor/40 text-accent-anchor';
    case 'generator':
      return 'bg-accent-generator/15 border-accent-generator/40 text-accent-generator';
    case 'default':
    default:
      return 'bg-surface-base border-border-base text-text-base';
  }
}

export const StatusBar: React.FC = () => {
  const cursorPosition = useAppStore(state => state.cursorPosition);
  const mapScale = useAppStore(state => state.mapScale);
  const nodes = useAppStore(state => state.nodes);
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const selection = useAppStore(state => state.selection);
  const appMode = useAppStore(state => state.appMode);
  const insertionTarget = useAppStore(state => state.insertionTarget);
  const modalStack = useAppStore(state => state.modalStack);
  const isSettingsModalOpen = useAppStore(state => state.isSettingsModalOpen);
  const isExportModalOpen = useAppStore(state => state.isExportModalOpen);
  const isImportModalOpen = useAppStore(state => state.isImportModalOpen);
  const isExportMapsModalOpen = useAppStore(state => state.isExportMapsModalOpen);
  const isShortcutsModalOpen = useAppStore(state => state.isShortcutsModalOpen);
  const isWelcomeModalOpen = useAppStore(state => state.isWelcomeModalOpen);
  const isInitialLaunch = useAppStore(state => state.isInitialLaunch);
  const pluginDataModalState = useAppStore(state => state.pluginDataModalState);
  const customLayers = useAppStore(state => state.customLayers);
  const mapLayers = useAppStore(state => state.mapLayers);
  const enableSnapping = useAppStore(state => state.enableSnapping);
  const setEnableSnapping = useAppStore(state => state.setEnableSnapping);
  const isDirty = useAppStore(state => state.isDirty);
  const saveProject = useAppStore(state => state.saveProject);
  const triggerFitToMaps = useAppStore(state => state.triggerFitToMaps);
  const handleGlobalEscape = useAppStore(state => state.handleGlobalEscape);

  const showOccupancyHighlight = useAppStore(state => state.showOccupancyHighlight);
  const occupancyHighlightAlpha = useAppStore(state => state.occupancyHighlightAlpha);
  const setOccupancyHighlightAlpha = useAppStore(state => state.setOccupancyHighlightAlpha);
  const activeLoadingTasks = useAppStore(state => state.activeLoadingTasks);

  const backgroundTasks = Object.values(activeLoadingTasks || {}).filter(t => t.blocking === false);
  const activeBgTask = backgroundTasks.sort((a, b) => b.createdAt - a.createdAt)[0];

  // 状態機械に基づくモード・Escアクションの計算
  const statusInfo = computeStatusInteraction({
    modalStack,
    isSettingsModalOpen,
    isExportModalOpen,
    isImportModalOpen,
    isExportMapsModalOpen,
    isShortcutsModalOpen,
    isWelcomeModalOpen,
    isInitialLaunch,
    pluginDataModalState,
    appMode,
    selection,
    nodes,
    customLayers,
  });

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
    const dist = Math.hypot(dx, dy);
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    // Convert to local coordinate frame of the latest waypoint
    const localX = dx * Math.cos(-yaw) - dy * Math.sin(-yaw);
    const localY = dx * Math.sin(-yaw) + dy * Math.cos(-yaw);
    
    relativeText = `(Rel) Δ: ${dist.toFixed(2)}m (${angleDeg.toFixed(0)}°) [X: ${localX.toFixed(2)} Y: ${localY.toFixed(2)}]`;
  }

  // 統計情報
  const allWaypointIds = getFlattenedWaypointIds(rootNodeIds, nodes);
  const totalWaypointsCount = allWaypointIds.length;
  const totalDistance = computeTotalPathDistance(rootNodeIds, nodes);

  // マップ解像度
  const activeMapLayer = mapLayers.find(l => l.visible) || mapLayers[0];
  const mapResolution = activeMapLayer?.info?.resolution;

  return (
    <div className="h-7 flex items-center justify-between px-3 bg-surface-panel border-t border-border-base text-xs text-text-muted flex-shrink-0 z-50 select-none gap-2">
      {/* Left Section: Status / Mode Badge / Esc Guide / Tasks / Occupancy Slider */}
      <div className="flex-1 flex items-center space-x-2 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
        {showOccupancyHighlight ? (
          <div className="flex items-center gap-2.5 text-[11px] shrink-0">
            <span className="font-semibold text-text-base flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-reference animate-pulse inline-block" />
              Highlight:
            </span>
            <span className="text-occupancy-obstacle font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded bg-occupancy-obstacle inline-block" />
              Obstacle
            </span>
            <span className="text-occupancy-free font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded bg-occupancy-free inline-block" />
              Free
            </span>
            <span className="text-occupancy-unknown font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded bg-occupancy-unknown inline-block" />
              Unknown
            </span>
            <div className="flex items-center gap-1.5 ml-1 w-24">
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
        ) : (
          <div className="flex items-center gap-1.5 overflow-hidden">
            {/* Mode Badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border shrink-0 transition-colors",
                getModeBadgeClasses(statusInfo.modeVariant)
              )}
              title={statusInfo.hintText || statusInfo.modeBadgeText}
            >
              <ModeIcon icon={statusInfo.modeIcon} />
              <span className="truncate max-w-[180px]">{statusInfo.modeBadgeText}</span>
            </span>

            {/* Next on Esc Guide Button */}
            {statusInfo.escActionLabel && (
              <button
                type="button"
                onClick={() => handleGlobalEscape()}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-base border border-border-base text-text-muted hover:text-text-base hover:border-border-focus hover:bg-surface-hover transition-colors font-mono text-[11px] shrink-0"
                title={`Escキーまたはクリックで ${statusInfo.escActionLabel}`}
              >
                <span className="font-semibold text-[10px] px-1 py-0.2 rounded bg-surface-panel border border-border-base/60 text-text-base">
                  Esc
                </span>
                <span className="font-sans text-[11px] text-text-muted">{statusInfo.escActionLabel}</span>
              </button>
            )}

            {/* Active Background Task */}
            {activeBgTask && (
              <span className="text-primary-base font-medium flex items-center gap-1.5 animate-pulse text-[11px] shrink-0">
                <Loader2 size={12} className="animate-spin" />
                <span className="truncate max-w-[200px]">{activeBgTask.message}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center Section: Cursor Coordinates & Relative Measurements */}
      <div className="flex items-center justify-center space-x-3 shrink-0 text-[11px]">
        {cursorPosition ? (
          <>
            <span className="font-mono text-text-base" title="カーソル世界座標 (X, Y [m])">
              (World) X: {cursorPosition.x.toFixed(3)}m Y: {cursorPosition.y.toFixed(3)}m
            </span>
            {relativeText && (
              <span className="font-mono text-primary-base/90 hidden md:inline-block" title="直前ノードからの相対距離・方位・ローカル座標">
                {relativeText}
              </span>
            )}
          </>
        ) : (
          <span className="font-mono text-text-muted/50">Cursor outside map</span>
        )}

        {insertionTarget && (
          <button
            type="button"
            onClick={() => useAppStore.getState().setInsertionTarget(null)}
            className="cursor-pointer font-sans text-[11px] px-1.5 py-0.5 rounded bg-primary-base/15 border border-primary-base/40 text-primary-base hover:bg-primary-base/25 transition-colors flex items-center gap-1"
            title="クリックで挿入位置指定を解除"
          >
            📍 挿入: {insertionTarget.parentId ? (nodes[insertionTarget.parentId]?.name || 'Group') : 'ルート'} [{insertionTarget.index}] ✕
          </button>
        )}
      </div>

      {/* Right Section: Metrics, Snapping, Dirty, Resolution, Zoom & Fit */}
      <div className="flex-1 flex justify-end items-center space-x-2.5 shrink-0 text-[11px]">
        {/* Node Count & Path Distance */}
        {totalWaypointsCount > 0 && (
          <div className="hidden lg:flex items-center gap-2 text-text-muted shrink-0">
            <span title="選択ノード数 / 全ウェイポイント数">
              {selection.type === 'nodes' && selection.ids.length > 0 ? (
                <span className="text-primary-base font-medium">{selection.ids.length}</span>
              ) : (
                <span>0</span>
              )}
              <span className="text-text-muted/60"> / </span>
              <span>{totalWaypointsCount} WP</span>
            </span>
            {totalDistance > 0 && (
              <span className="text-text-muted/80 font-mono" title="マニュアルウェイポイント全経路長">
                ({totalDistance.toFixed(1)}m)
              </span>
            )}
          </div>
        )}

        {/* Snapping Quick Toggle */}
        <button
          type="button"
          onClick={() => setEnableSnapping(!enableSnapping)}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] transition-colors shrink-0",
            enableSnapping
              ? "bg-primary-base/15 border-primary-base/40 text-primary-base"
              : "bg-surface-base border-border-base text-text-muted/60 hover:text-text-base"
          )}
          title={enableSnapping ? "スナップ有効 (クリックで無効化)" : "スナップ無効 (クリックで有効化)"}
        >
          <Magnet size={11} />
          <span>Snap</span>
        </button>

        {/* Dirty / Save Indicator */}
        {isDirty ? (
          <button
            type="button"
            onClick={() => saveProject()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-status-warning/15 border border-status-warning/40 text-status-warning hover:bg-status-warning/25 transition-colors font-medium text-[11px] shrink-0"
            title="未保存の変更があります (Ctrl+S またはクリックで上書き保存)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse inline-block" />
            <span>未保存</span>
          </button>
        ) : (
          <span className="hidden sm:flex items-center gap-1 text-text-muted/70 text-[11px] shrink-0" title="すべての変更が保存されています">
            <Check size={11} className="text-status-success" />
            <span>保存済</span>
          </span>
        )}

        {/* Map Resolution */}
        {typeof mapResolution === 'number' && (
          <span className="hidden xl:inline-block font-mono text-text-muted/80 shrink-0" title="マップ画像解像度">
            {mapResolution.toFixed(3)}m/px
          </span>
        )}

        {/* Zoom & Fit Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="font-mono text-text-base text-[11px]" title="ズーム倍率">
            {(mapScale * 100).toFixed(0)}%
          </span>
          <button
            type="button"
            onClick={() => triggerFitToMaps()}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-base border border-border-base text-text-muted hover:text-text-base hover:bg-surface-hover hover:border-border-focus transition-colors text-[11px] shrink-0"
            title="マップ全体にフィット表示"
          >
            <Maximize2 size={10} />
            <span>Fit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
