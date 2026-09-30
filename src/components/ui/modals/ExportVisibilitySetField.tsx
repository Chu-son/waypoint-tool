import type { LayerVisibilitySet } from '../../../types/store';
import { Label } from '../common/Label';
import { Select } from '../common/Select';

interface ExportVisibilitySetFieldProps {
  /** The set the map item draws with; undefined means the current display. */
  value: string | undefined;
  sets: LayerVisibilitySet[];
  onChange: (setId: string | undefined) => void;
}

/** Chooses which layer visibility set a map export item uses. */
export function ExportVisibilitySetField({ value, sets, onChange }: ExportVisibilitySetFieldProps) {
  const isMissing = value !== undefined && !sets.some((s) => s.id === value);

  return (
    <div className="space-y-1.5 pt-2 border-t border-border-base/30">
      <Label className="text-xs font-bold text-text-muted">レイヤー表示セット</Label>
      <Select
        aria-label="レイヤー表示セット"
        className="h-8 text-xs"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">現在の表示状態で出力</option>
        {isMissing && <option value={value}>（削除されたセット）</option>}
        {sets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      {isMissing ? (
        <p className="text-[11px] text-status-warning">
          選択していた表示セットは削除されました。選び直さないとエクスポートできません。
        </p>
      ) : (
        <p className="text-[11px] text-text-muted">
          セットを選ぶと、そのセットで表示するレイヤーだけを重ねて出力します。同じ領域を別のセットで出すときは、パスに{' '}
          {'{{set}}'} を含めてください。
        </p>
      )}
    </div>
  );
}
