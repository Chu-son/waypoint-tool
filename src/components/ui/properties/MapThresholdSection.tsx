import { RotateCcw } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { Select } from '../common/Select';
import type { ResolvedMapLayer } from '../../../types/store';

export type ThresholdUpdates = Partial<{ occupied_thresh: number; free_thresh: number; negate: number }>;

interface MapThresholdSectionProps {
  layer: ResolvedMapLayer;
  /** Edits occupancy thresholds, which every instance of this map shares. */
  onUpdate: (updates: ThresholdUpdates) => void;
}

/** Occupancy thresholds of the map (shared by every layer of it), with a bar showing the three ranges. */
export function MapThresholdSection({ layer, onUpdate }: MapThresholdSectionProps) {
  const occupancySettings = useAppStore((state) => state.occupancySettings);
  const occThresh = layer.info?.occupied_thresh ?? occupancySettings?.defaultOccupiedThresh ?? 0.65;
  const freeThresh = layer.info?.free_thresh ?? occupancySettings?.defaultFreeThresh ?? 0.25;
  const negate = layer.info?.negate ?? occupancySettings?.defaultNegate ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-text-base flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-occupancy-unknown inline-block" />
          Occupancy Thresholds
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px] text-text-muted hover:text-text-base gap-1"
          onClick={() =>
            onUpdate({
              occupied_thresh: occupancySettings?.defaultOccupiedThresh ?? 0.65,
              free_thresh: occupancySettings?.defaultFreeThresh ?? 0.25,
              negate: occupancySettings?.defaultNegate ?? 0,
            })
          }
          title="Reset thresholds to project defaults"
        >
          <RotateCcw size={11} />
          <span>Reset</span>
        </Button>
      </div>

      <div className="h-2 w-full rounded overflow-hidden flex border border-border-base/40">
        <div
          style={{ width: `${Math.min(100, Math.max(0, freeThresh * 100))}%` }}
          className="bg-occupancy-free/80"
          title={`Free: 0.00 ~ ${freeThresh.toFixed(2)}`}
        />
        <div
          style={{ width: `${Math.max(0, (occThresh - freeThresh) * 100)}%` }}
          className="bg-occupancy-unknown/80"
          title={`Unknown: ${freeThresh.toFixed(2)} ~ ${occThresh.toFixed(2)}`}
        />
        <div
          style={{ width: `${Math.max(0, (1.0 - occThresh) * 100)}%` }}
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
        onChange={(e) => onUpdate({ occupied_thresh: Math.max(parseFloat(e.target.value), freeThresh) })}
      />
      <Slider
        label="Free Thresh"
        valueDisplay={freeThresh.toFixed(2)}
        min="0"
        max="1"
        step="0.01"
        value={freeThresh}
        onChange={(e) => onUpdate({ free_thresh: Math.min(parseFloat(e.target.value), occThresh) })}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-text-muted font-medium">Negate</span>
        <Select
          value={negate}
          onChange={(e) => onUpdate({ negate: parseInt(e.target.value) as 0 | 1 })}
          className="h-6 text-[11px] bg-surface-base border-border-base/50 w-32 py-0"
        >
          <option value={0}>0 (Standard)</option>
          <option value={1}>1 (Inverted)</option>
        </Select>
      </div>
    </div>
  );
}
