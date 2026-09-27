import { useMemo } from 'react';
import { Crop, Plus, Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { ToggleSwitch } from '../common/ToggleSwitch';
import type { ClipRect, MapLayerClip, ResolvedMapLayer } from '../../../types/store';
import { boundsToRect, halfOfBounds, mapWorldBounds, type ClipSide } from '../../../utils/mapClip';

interface MapClipEditorProps {
  layer: ResolvedMapLayer;
  onChange: (clip: MapLayerClip | null) => void;
}

const HALVES: { side: ClipSide; label: string }[] = [
  { side: 'left', label: 'Left half' },
  { side: 'right', label: 'Right half' },
  { side: 'bottom', label: 'Bottom half' },
  { side: 'top', label: 'Top half' },
];

/**
 * Chooses which part of a map instance takes part in drawing and export, as a union of world-space
 * rectangles. Duplicate the map layer and give each copy a different area to combine several regions
 * of the same map (e.g. an L-shape from two rectangles).
 */
export function MapClipEditor({ layer, onChange }: MapClipEditorProps) {
  const bounds = useMemo(() => mapWorldBounds(layer), [layer]);
  const rects = layer.clip?.rects ?? [];

  const setRects = (next: ClipRect[]) => onChange({ rects: next });
  const updateRect = (index: number, updates: Partial<ClipRect>) =>
    setRects(rects.map((r, i) => (i === index ? { ...r, ...updates } : r)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-text-base flex items-center gap-1.5">
          <Crop size={12} className="text-primary-base" />
          Use Area
        </span>
        <ToggleSwitch
          checked={layer.clip !== null}
          onChange={(enabled) => onChange(enabled ? { rects: [boundsToRect(bounds)] } : null)}
          title="Use only part of this map"
        />
      </div>

      {layer.clip !== null && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {HALVES.map(({ side, label }) => (
              <Button
                key={side}
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-[10px] text-text-muted hover:text-text-base"
                onClick={() => setRects([halfOfBounds(bounds, side)])}
              >
                {label}
              </Button>
            ))}
          </div>

          {rects.map((rect, index) => (
            <div
              key={index}
              role="group"
              aria-label={`Area ${index + 1}`}
              className="space-y-1 rounded-md border border-border-base/30 p-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-text-muted">Area {index + 1} (m)</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-text-muted hover:text-danger-base disabled:opacity-30"
                  disabled={rects.length <= 1}
                  onClick={() => setRects(rects.filter((_, i) => i !== index))}
                  title={`Remove area ${index + 1}`}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <LabeledNumericInput label="X" value={rect.x} step={0.1} onChange={(x) => updateRect(index, { x })} />
                <LabeledNumericInput label="Y" value={rect.y} step={0.1} onChange={(y) => updateRect(index, { y })} />
                <LabeledNumericInput
                  label="W"
                  value={rect.width}
                  step={0.1}
                  min={0}
                  onChange={(width) => updateRect(index, { width })}
                />
                <LabeledNumericInput
                  label="H"
                  value={rect.height}
                  step={0.1}
                  min={0}
                  onChange={(height) => updateRect(index, { height })}
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-text-muted hover:text-text-base gap-1"
            onClick={() => setRects([...rects, boundsToRect(bounds)])}
          >
            <Plus size={11} />
            <span>Add area</span>
          </Button>
        </>
      )}
    </div>
  );
}
