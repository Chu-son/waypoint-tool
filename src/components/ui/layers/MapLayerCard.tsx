import { useState } from 'react';
import { RotateCcw, RotateCw, FlipHorizontal2, Move, Target } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { Select } from '../common/Select';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { FieldLabel } from '../common/FieldLabel';
import { InlineNameInput } from '../common/InlineNameInput';
import { PoseAdjuster } from '../common/PoseAdjuster';
import { ProjectMapLayer } from '../../../types/store';
import { LayerCardShell } from './LayerCardShell';

interface MapLayerCardProps {
  layer: ProjectMapLayer;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isActiveTargetMap: boolean;
  isMapEditMode: boolean;
  onSelect: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
  onUpdateLayer: (updates: Partial<ProjectMapLayer>) => void;
  isRenaming: boolean;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
}

/** Card for one ROS map layer: pose adjustment, opacity, blend mode and occupancy thresholds. */
export function MapLayerCard({
  layer,
  index,
  isFirst,
  isLast,
  isActiveTargetMap,
  isMapEditMode,
  onSelect,
  onContextMenu,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onRemove,
  onUpdateLayer,
  isRenaming,
  onStartRename,
  onRename,
  onCancelRename,
}: MapLayerCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const occupancySettings = useAppStore((state) => state.occupancySettings);

  const occThresh = layer.info?.occupied_thresh ?? occupancySettings?.defaultOccupiedThresh ?? 0.65;
  const freeThresh = layer.info?.free_thresh ?? occupancySettings?.defaultFreeThresh ?? 0.25;
  const negate = layer.info?.negate ?? occupancySettings?.defaultNegate ?? 0;

  // Origin & Initial Origin handling
  const rawOrigin = layer.info?.origin;
  const origin: [number, number, number] =
    Array.isArray(rawOrigin) && rawOrigin.length >= 2
      ? [Number(rawOrigin[0]) || 0, Number(rawOrigin[1]) || 0, Number(rawOrigin[2]) || 0]
      : [0, 0, 0];

  const rawInitialOrigin = layer.info?.initial_origin;
  const initialOrigin: [number, number, number] =
    Array.isArray(rawInitialOrigin) && rawInitialOrigin.length >= 2
      ? [Number(rawInitialOrigin[0]) || 0, Number(rawInitialOrigin[1]) || 0, Number(rawInitialOrigin[2]) || 0]
      : [...origin];

  const deltaX = origin[0] - initialOrigin[0];
  const deltaY = origin[1] - initialOrigin[1];
  const deltaYawRad = origin[2] - initialOrigin[2];
  const deltaYawDeg = deltaYawRad * (180.0 / Math.PI);

  const handleUpdateDelta = (updates: Partial<{ deltaX: number; deltaY: number; deltaYawDeg: number }>) => {
    const newDx = updates.deltaX !== undefined ? updates.deltaX : deltaX;
    const newDy = updates.deltaY !== undefined ? updates.deltaY : deltaY;
    const newDeg = updates.deltaYawDeg !== undefined ? updates.deltaYawDeg : deltaYawDeg;
    const newDeltaYawRad = newDeg * (Math.PI / 180.0);

    const newOx = initialOrigin[0] + newDx;
    const newOy = initialOrigin[1] + newDy;
    const newOyaw = initialOrigin[2] + newDeltaYawRad;

    onUpdateLayer({
      info: {
        ...layer.info,
        origin: [newOx, newOy, newOyaw],
        initial_origin: initialOrigin,
      },
    });
  };

  const handleResetPose = () => {
    onUpdateLayer({
      info: {
        ...layer.info,
        origin: [...initialOrigin],
        initial_origin: initialOrigin,
      },
    });
  };

  const handleRotateDelta = (stepDeg: number) => {
    let newDeg = Math.round((deltaYawDeg + stepDeg) / 90) * 90;
    newDeg = ((((newDeg + 180) % 360) + 360) % 360) - 180;
    handleUpdateDelta({ deltaYawDeg: newDeg });
  };

  const handleUpdateInfo = (updates: Partial<{ occupied_thresh: number; free_thresh: number; negate: number }>) => {
    onUpdateLayer({
      info: {
        ...layer.info,
        origin,
        initial_origin: initialOrigin,
        ...updates,
      },
    });
  };

  const handleResetThresholds = () => {
    onUpdateLayer({
      info: {
        ...layer.info,
        origin,
        initial_origin: initialOrigin,
        occupied_thresh: occupancySettings?.defaultOccupiedThresh ?? 0.65,
        free_thresh: occupancySettings?.defaultFreeThresh ?? 0.25,
        negate: occupancySettings?.defaultNegate ?? 0,
      },
    });
  };

  return (
    <LayerCardShell
      visible={layer.visible}
      isActive={isActiveTargetMap}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      isFirst={isFirst}
      isLast={isLast}
      title={
        isRenaming ? (
          <InlineNameInput name={layer.name} onRename={onRename} onCancel={onCancelRename} className="max-w-[140px]" />
        ) : (
          <span
            className="text-sm font-bold text-text-base truncate block max-w-[140px]"
            title={`${layer.name} (double-click to rename)`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartRename();
            }}
          >
            {layer.name}
          </span>
        )
      }
      subBadges={
        <>
          {isMapEditMode && isActiveTargetMap && (
            <span className="text-[9px] font-bold uppercase bg-accent-generator/20 text-accent-generator px-1 py-0.5 rounded flex items-center gap-1">
              <Target size={11} className="shrink-0" />
              Target Map
            </span>
          )}
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Layer {index + 1}</span>
        </>
      }
      showSettings={showSettings}
      onToggleSettings={() => setShowSettings(!showSettings)}
      settingsTooltip="Edit Map Layer (Pose, Opacity, Blend, Thresholds)"
      onToggleVisible={onToggleVisible}
      onRemove={onRemove}
      removeTooltip="Remove Map"
    >
      {/* Section 1: Relative Pose */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-text-base flex items-center gap-1.5">
            <Move size={12} className="text-accent-generator" />
            Relative Pose (from YAML)
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={handleResetPose}
            title="Reset pose to YAML origin"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </Button>
        </div>

        {/* Quick Rotate Buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={() => handleRotateDelta(-90)}
            title="Rotate -90° (Counter-clockwise)"
          >
            <RotateCcw size={12} />
            <span>-90°</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={() => handleRotateDelta(180)}
            title="Rotate 180°"
          >
            <FlipHorizontal2 size={12} />
            <span>180°</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={() => handleRotateDelta(90)}
            title="Rotate +90° (Clockwise)"
          >
            <RotateCw size={12} />
            <span>+90°</span>
          </Button>
        </div>

        {/* Numeric Inputs for deltaX, deltaY, deltaYaw */}
        <div className="grid grid-cols-3 gap-1.5">
          <LabeledNumericInput
            label="ΔX (m)"
            value={deltaX}
            step={0.05}
            precision={3}
            onChange={(val) => handleUpdateDelta({ deltaX: val })}
          />
          <LabeledNumericInput
            label="ΔY (m)"
            value={deltaY}
            step={0.05}
            precision={3}
            onChange={(val) => handleUpdateDelta({ deltaY: val })}
          />
          <LabeledNumericInput
            label="ΔYaw (°)"
            value={deltaYawDeg}
            step={1}
            precision={1}
            onChange={(val) => handleUpdateDelta({ deltaYawDeg: val })}
          />
        </div>

        <PoseAdjuster
          onNudge={({ dx, dy, dyawDeg }) =>
            handleUpdateDelta({ deltaX: deltaX + dx, deltaY: deltaY + dy, deltaYawDeg: deltaYawDeg + dyawDeg })
          }
        />

        {/* Subtext with original YAML origin */}
        <div
          className="text-[9px] text-text-muted truncate font-mono px-0.5"
          title={`YAML Origin: [${initialOrigin[0]}, ${initialOrigin[1]}, ${initialOrigin[2]}]`}
        >
          YAML Origin: [{initialOrigin[0].toFixed(2)}, {initialOrigin[1].toFixed(2)},{' '}
          {(initialOrigin[2] * (180 / Math.PI)).toFixed(1)}°]
        </div>
      </div>

      {/* Section 2: Display Settings */}
      <div className="space-y-2 pt-2 border-t border-border-base/30">
        <span className="text-[11px] font-bold text-text-base">Display</span>
        <Slider
          label="Layer Opacity"
          valueDisplay={`${Math.round(layer.opacity * 100)}%`}
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity}
          onChange={(e) => onUpdateLayer({ opacity: parseFloat(e.target.value) })}
        />
        <div className="flex flex-col gap-1 mt-1">
          <FieldLabel>Blend Mode</FieldLabel>
          <Select
            value={layer.blend_mode || 'overwrite'}
            onChange={(e) => onUpdateLayer({ blend_mode: e.target.value as any })}
            onClick={(e) => e.stopPropagation()}
            className="text-xs border-border-base/50 h-7"
          >
            <option value="overwrite">Overwrite (Ignore Unknown)</option>
            <option value="merge_obstacles">Merge Obstacles</option>
            <option value="merge_free">Merge Free Space</option>
          </Select>
        </div>
      </div>

      {/* Section 3: Occupancy Thresholds */}
      <div className="space-y-3 pt-2 border-t border-border-base/30">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-text-base flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-occupancy-unknown inline-block" />
            Occupancy Thresholds
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={handleResetThresholds}
            title="Reset thresholds to project defaults"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </Button>
        </div>

        {/* Mini Visual Threshold Bar */}
        <div className="h-2 w-full rounded overflow-hidden flex border border-border-base/40">
          <div
            style={{ width: `${Math.min(100, Math.max(0, freeThresh * 100))}%` }}
            className="bg-occupancy-free/80"
            title={`Free: 0.00 ~ ${freeThresh.toFixed(2)}`}
          />
          <div
            style={{
              width: `${Math.max(0, (occThresh - freeThresh) * 100)}%`,
            }}
            className="bg-occupancy-unknown/80"
            title={`Unknown: ${freeThresh.toFixed(2)} ~ ${occThresh.toFixed(2)}`}
          />
          <div
            style={{
              width: `${Math.max(0, (1.0 - occThresh) * 100)}%`,
            }}
            className="bg-occupancy-obstacle/80"
            title={`Obstacle: ${occThresh.toFixed(2)} ~ 1.00`}
          />
        </div>

        <Slider
          label="Occupied Thresh"
          valueDisplay={occThresh.toFixed(2)}
          min="0"
          max="1"
          step="0.01"
          value={occThresh}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            handleUpdateInfo({ occupied_thresh: Math.max(val, freeThresh) });
          }}
        />

        <Slider
          label="Free Thresh"
          valueDisplay={freeThresh.toFixed(2)}
          min="0"
          max="1"
          step="0.01"
          value={freeThresh}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            handleUpdateInfo({ free_thresh: Math.min(val, occThresh) });
          }}
        />

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-text-muted font-medium">Negate</span>
          <Select
            value={negate}
            onChange={(e) => handleUpdateInfo({ negate: parseInt(e.target.value) as 0 | 1 })}
            className="h-6 text-[11px] bg-surface-base border-border-base/50 w-32 py-0"
          >
            <option value={0}>0 (Standard)</option>
            <option value={1}>1 (Inverted)</option>
          </Select>
        </div>
      </div>
    </LayerCardShell>
  );
}
