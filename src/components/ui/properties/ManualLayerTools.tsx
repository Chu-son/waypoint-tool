import { Slash, Square, Circle, Pencil, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import type { ManualCustomLayer } from '../../../types/store';
import { Button } from '../common/Button';
import { Label } from '../common/Label';
import { Slider } from '../common/Slider';
import { FieldLabel } from '../common/FieldLabel';
import { cn } from '../../../utils/cn';

type SubTool = 'line' | 'rect' | 'circle' | 'freehand';

const DRAW_TOOLS: { tool: SubTool; label: string; Icon: LucideIcon }[] = [
  { tool: 'line', label: 'Line', Icon: Slash },
  { tool: 'rect', label: 'Rectangle', Icon: Square },
  { tool: 'circle', label: 'Circle', Icon: Circle },
  { tool: 'freehand', label: 'Brush', Icon: Pencil },
];

const OBJECT_ICONS: Record<string, LucideIcon> = { line: Slash, rect: Square, circle: Circle };

/** Drawing tools, fill type, brush size and the drawn-object list of a manual (vector) map layer. */
export function ManualLayerTools({ layer }: { layer: ManualCustomLayer }) {
  const isMapEditMode = useAppStore((state) => state.isMapEditMode);
  const setMapEditMode = useAppStore((state) => state.setMapEditMode);
  const mapEditSubTool = useAppStore((state) => state.mapEditSubTool);
  const setMapEditSubTool = useAppStore((state) => state.setMapEditSubTool);
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const setMapEditFillValue = useAppStore((state) => state.setMapEditFillValue);
  const mapEditBrushSize = useAppStore((state) => state.mapEditBrushSize);
  const setMapEditBrushSize = useAppStore((state) => state.setMapEditBrushSize);
  const selectedEditObjectId = useAppStore((state) => state.selectedEditObjectId);
  const setSelectedEditObjectId = useAppStore((state) => state.setSelectedEditObjectId);
  const removeEditObject = useAppStore((state) => state.removeEditObject);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FieldLabel className="text-[10px]">Vector Drawing Tools</FieldLabel>
        <div className="grid grid-cols-4 gap-1.5 bg-surface-base/60 p-1 rounded-xl border border-border-base/40">
          {DRAW_TOOLS.map(({ tool, label, Icon }) => (
            <button
              key={tool}
              type="button"
              onClick={() => {
                setMapEditSubTool(tool);
                setMapEditMode(true);
              }}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-semibold gap-1 transition-all',
                isMapEditMode && mapEditSubTool === tool
                  ? 'bg-primary-base text-text-inverse shadow-sm'
                  : 'text-text-muted hover:text-text-base hover:bg-surface-hover/50',
              )}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-text-muted">Paint Fill Type</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMapEditFillValue(0)}
            className={cn(
              'flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all',
              mapEditFillValue === 0
                ? 'bg-surface-base border-border-base text-text-inverse shadow-sm'
                : 'bg-surface-panel border-border-base/40 text-text-muted hover:text-text-base',
            )}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-surface-base border border-border-base" />
            <span>Obstacle (0)</span>
          </button>
          <button
            type="button"
            onClick={() => setMapEditFillValue(255)}
            className={cn(
              'flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all',
              mapEditFillValue === 255
                ? 'bg-text-inverse border-border-base text-surface-base shadow-sm'
                : 'bg-surface-panel border-border-base/40 text-text-muted hover:text-text-base',
            )}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-text-inverse border border-border-base" />
            <span>Free (255)</span>
          </button>
        </div>
      </div>

      {mapEditSubTool === 'freehand' && (
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px] text-text-muted font-medium">
            <span>Brush Radius</span>
            <span>{mapEditBrushSize} px</span>
          </div>
          <Slider
            min={2}
            max={50}
            step={1}
            value={mapEditBrushSize}
            onChange={(e) => setMapEditBrushSize(parseInt(e.target.value))}
          />
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-border-base/30">
        <div className="flex justify-between items-center">
          <FieldLabel className="text-[10px]">Drawn Objects</FieldLabel>
          <span className="text-[10px] text-text-muted">{layer.editObjects.length} objects</span>
        </div>
        {layer.editObjects.length === 0 ? (
          <p className="text-[11px] text-text-muted bg-surface-base/40 p-2.5 rounded-xl text-center border border-border-base/20">
            No objects drawn yet. Drag on canvas to draw.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {layer.editObjects.map((obj, idx) => {
              const ObjectIcon = OBJECT_ICONS[obj.type] ?? Pencil;
              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedEditObjectId(obj.id)}
                  className={cn(
                    'p-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all',
                    selectedEditObjectId === obj.id
                      ? 'bg-primary-base/10 border-primary-base/50 text-text-base'
                      : 'bg-surface-base/40 border-border-base/30 text-text-muted hover:bg-surface-hover/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ObjectIcon size={13} />
                    <span className="font-medium capitalize">
                      {obj.type} #{idx + 1}
                    </span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-surface-panel/80 text-text-muted">
                      {obj.fillValue === 0 ? 'Obstacle' : 'Free'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-text-muted hover:text-danger-base"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEditObject(layer.id, obj.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
