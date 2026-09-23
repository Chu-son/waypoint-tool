import { Select } from '../common/Select';
import { Input } from '../common/Input';

interface WaypointSelectFormProps {
  value: any;
  onChange: (val: any) => void;
  rootNodeIds: string[];
  nodes: Record<string, any>;
  indexStartIndex: number;
  showDirectInput?: boolean;
}

export function WaypointSelectForm({
  value,
  onChange,
  rootNodeIds,
  nodes,
  indexStartIndex,
  showDirectInput = false,
}: WaypointSelectFormProps) {
  return (
    <>
      <Select
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value === '' ? null : parseInt(e.target.value);
          onChange(val);
        }}
        className="h-8 text-[11px] mb-2"
      >
        <option value="">-- Select Waypoint --</option>
        {rootNodeIds.map((id, idx) => {
          const n = nodes[id];
          if (n && n.type === 'manual') {
            return (
              <option key={id} value={idx}>
                Waypoint {idx + indexStartIndex}
              </option>
            );
          }
          return null;
        })}
      </Select>
      {showDirectInput && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-text-muted shrink-0">Index:</label>
          <Input
            type="number"
            min={indexStartIndex}
            max={rootNodeIds.length - 1 + indexStartIndex}
            value={value !== null ? value + indexStartIndex : ''}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                const idx = val - indexStartIndex;
                if (idx >= 0 && idx < rootNodeIds.length) {
                  onChange(idx);
                }
              } else {
                onChange(null);
              }
            }}
            className="h-7 text-[11px]"
            placeholder="Direct Input"
          />
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------
// PointsListForm
// ----------------------------------------------------------------------
