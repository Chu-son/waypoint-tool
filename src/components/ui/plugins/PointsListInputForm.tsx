import { cn } from '../../../utils/cn';
import { Button } from '../common/Button';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { quaternionToYaw } from '../../../utils/transformUtils';
import { Trash2, Plus, Crosshair } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface PointsListFormProps {
  data: Array<any>;
  onChange: (val: any[]) => void;
  precision?: number;
  allowYaw?: boolean;
  maxPoints?: number;
  minPoints?: number;
  inputSize?: 'sm' | 'md';
}

export function PointsListForm({
  data = [],
  onChange,
  precision = 2,
  allowYaw = false,
  maxPoints = 50,
  minPoints = 1,
  inputSize = 'sm',
}: PointsListFormProps) {
  const points = Array.isArray(data) ? data : [];
  const inputClassName = inputSize === 'md' ? 'h-7 text-xs' : 'h-6 text-[11px]';

  const handleUpdatePoint = (idx: number, updated: any) => {
    const next = [...points];
    next[idx] = { ...next[idx], ...updated };
    onChange(next);
  };

  const handleRemovePoint = (idx: number) => {
    const next = points.filter((_, i) => i !== idx);
    onChange(next);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleAddManualPoint = () => {
    if (points.length >= maxPoints) return;
    const newPoint = {
      id: uuidv4(),
      x: 0,
      y: 0,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
    };
    onChange([...points, newPoint]);
  };

  return (
    <div className="space-y-2">
      {/* Header Info & Actions */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-text-muted font-medium flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-primary-base" />
          <span>
            {points.length} {points.length === 1 ? 'point' : 'points'}
            {maxPoints && <span className="opacity-60"> / {maxPoints} max</span>}
          </span>
        </span>
        <div className="flex items-center gap-1">
          {points.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-1.5 text-[10px] text-danger-base hover:bg-danger-base/10"
              title="Clear all points"
            >
              Clear All
            </Button>
          )}
          {points.length < maxPoints && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddManualPoint}
              className="h-6 px-2 text-[10px] flex items-center gap-1"
              title="Add point manually"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </Button>
          )}
        </div>
      </div>

      {minPoints > 0 && points.length < minPoints && (
        <p className="text-[10px] text-status-warning/90 font-medium">
          At least {minPoints} {minPoints === 1 ? 'point is' : 'points are'} required.
        </p>
      )}

      {/* Points List */}
      {points.length === 0 ? (
        <div className="py-2.5 text-center text-text-muted/60 italic text-[11px] border border-dashed border-border-base/50 rounded-md">
          Click on map to add points
        </div>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {points.map((pt, idx) => {
            const key = pt.id || `point-${idx}`;
            const yaw = allowYaw ? quaternionToYaw(pt) : 0;

            return (
              <div
                key={key}
                className="flex items-center gap-1.5 p-1.5 rounded bg-surface-base/80 border border-border-base/40 hover:border-border-base transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-primary-base/20 text-primary-base text-[10px] flex items-center justify-center font-bold shrink-0">
                  {idx + 1}
                </span>

                <div className={cn('grid gap-1 flex-1', allowYaw ? 'grid-cols-3' : 'grid-cols-2')}>
                  <LabeledNumericInput
                    label="X"
                    value={pt.x ?? 0}
                    precision={precision}
                    onChange={(val) => handleUpdatePoint(idx, { x: val })}
                    inputClassName={inputClassName}
                  />
                  <LabeledNumericInput
                    label="Y"
                    value={pt.y ?? 0}
                    precision={precision}
                    onChange={(val) => handleUpdatePoint(idx, { y: val })}
                    inputClassName={inputClassName}
                  />
                  {allowYaw && (
                    <LabeledNumericInput
                      label="Yaw"
                      value={yaw}
                      precision={precision}
                      step="0.01"
                      onChange={(val) => {
                        const qz = Math.sin(val / 2);
                        const qw = Math.cos(val / 2);
                        handleUpdatePoint(idx, { qx: 0, qy: 0, qz, qw });
                      }}
                      inputClassName={inputClassName}
                    />
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePoint(idx)}
                  className="h-6 w-6 p-0 text-text-muted hover:text-danger-base hover:bg-danger-base/10 shrink-0"
                  title="Remove this point"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Annotation Select Form
// ----------------------------------------------------------------------
