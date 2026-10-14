import { RotateCcw, RotateCw, FlipHorizontal2, Move } from 'lucide-react';
import { Button } from '../common/Button';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { PoseAdjuster } from '../common/PoseAdjuster';
import type { ResolvedMapLayer } from '../../../types/store';

type Pose = [number, number, number];

const poseOf = (raw: unknown, fallback: Pose): Pose =>
  Array.isArray(raw) && raw.length >= 2 ? [Number(raw[0]) || 0, Number(raw[1]) || 0, Number(raw[2]) || 0] : fallback;

interface MapPoseSectionProps {
  layer: ResolvedMapLayer;
  /** How many map instances draw from this layer's source. */
  sharedCount: number;
  /** Moves this map. While the pose is linked this moves every linked instance of the map. */
  onSetOrigin: (origin: Pose) => void;
  /** Links the pose to the other instances of this map, or unlinks it so this instance moves alone. */
  onSetPoseLinked: (linked: boolean) => void;
}

/** The map's pose relative to the origin in its YAML file: quick rotations, numbers and nudges. */
export function MapPoseSection({ layer, sharedCount, onSetOrigin, onSetPoseLinked }: MapPoseSectionProps) {
  const poseUnlinked = layer.origin_override !== null;
  const origin = poseOf(layer.info?.origin, [0, 0, 0]);
  const initialOrigin = poseOf(layer.info?.initial_origin, origin);

  const deltaX = origin[0] - initialOrigin[0];
  const deltaY = origin[1] - initialOrigin[1];
  const deltaYawDeg = (origin[2] - initialOrigin[2]) * (180.0 / Math.PI);

  const setDelta = (updates: Partial<{ deltaX: number; deltaY: number; deltaYawDeg: number }>) => {
    const dx = updates.deltaX ?? deltaX;
    const dy = updates.deltaY ?? deltaY;
    const dyawDeg = updates.deltaYawDeg ?? deltaYawDeg;
    onSetOrigin([initialOrigin[0] + dx, initialOrigin[1] + dy, initialOrigin[2] + dyawDeg * (Math.PI / 180.0)]);
  };

  const rotateBy = (stepDeg: number) => {
    let next = Math.round((deltaYawDeg + stepDeg) / 90) * 90;
    next = ((((next + 180) % 360) + 360) % 360) - 180;
    setDelta({ deltaYawDeg: next });
  };

  return (
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
          onClick={() => onSetOrigin([...initialOrigin])}
          title="Reset pose to YAML origin"
        >
          <RotateCcw size={11} />
          <span>Reset</span>
        </Button>
      </div>

      {(sharedCount > 1 || poseUnlinked) && (
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[10px] text-text-muted font-medium"
            title="On: moving this layer moves the other linked layers of this map. Off: this layer moves alone."
          >
            Link pose with other layers
          </span>
          <ToggleSwitch
            checked={!poseUnlinked}
            onChange={onSetPoseLinked}
            title={
              poseUnlinked ? 'Link pose again (returns to the shared pose)' : 'Unlink pose (move this layer alone)'
            }
            aria-label="Link pose"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
          onClick={() => rotateBy(-90)}
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
          onClick={() => rotateBy(180)}
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
          onClick={() => rotateBy(90)}
          title="Rotate +90° (Clockwise)"
        >
          <RotateCw size={12} />
          <span>+90°</span>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <LabeledNumericInput
          label="ΔX (m)"
          value={deltaX}
          step={0.05}
          precision={3}
          onChange={(val) => setDelta({ deltaX: val })}
        />
        <LabeledNumericInput
          label="ΔY (m)"
          value={deltaY}
          step={0.05}
          precision={3}
          onChange={(val) => setDelta({ deltaY: val })}
        />
        <LabeledNumericInput
          label="ΔYaw (°)"
          value={deltaYawDeg}
          step={1}
          precision={1}
          onChange={(val) => setDelta({ deltaYawDeg: val })}
        />
      </div>

      <PoseAdjuster
        onNudge={({ dx, dy, dyawDeg }) =>
          setDelta({ deltaX: deltaX + dx, deltaY: deltaY + dy, deltaYawDeg: deltaYawDeg + dyawDeg })
        }
      />

      <div
        className="text-[9px] text-text-muted truncate font-mono px-0.5"
        title={`YAML Origin: [${initialOrigin[0]}, ${initialOrigin[1]}, ${initialOrigin[2]}]`}
      >
        YAML Origin: [{initialOrigin[0].toFixed(2)}, {initialOrigin[1].toFixed(2)},{' '}
        {(initialOrigin[2] * (180 / Math.PI)).toFixed(1)}°]
      </div>
    </div>
  );
}
