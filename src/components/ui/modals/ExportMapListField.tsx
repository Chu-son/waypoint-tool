import type { ExportMapList, MapListExisting } from '../../../types/store';
import { Checkbox } from '../common/Checkbox';
import { Input } from '../common/Input';
import { Label } from '../common/Label';

interface ExportMapListFieldProps {
  /** The list settings of the map item; undefined means no list is written. */
  value: ExportMapList | undefined;
  onChange: (mapList: ExportMapList | undefined) => void;
}

const DEFAULT_MAP_LIST_FILE_NAME = 'map_list.txt';

const EXISTING_OPTIONS: { value: MapListExisting; label: string }[] = [
  { value: 'append', label: '重複を除いて追記' },
  { value: 'conflict_setting', label: '競合設定に従って作り直す' },
];

/** Chooses whether a map export item also lists its maps in a text file, and what happens to an existing list. */
export function ExportMapListField({ value, onChange }: ExportMapListFieldProps) {
  return (
    <div className="space-y-1.5 pt-2 border-t border-border-base/30">
      <label className="flex items-center gap-2 cursor-pointer text-xs">
        <Checkbox
          aria-label="マップ一覧ファイルを出力"
          checked={value !== undefined}
          onChange={(e) =>
            onChange(e.target.checked ? { fileName: DEFAULT_MAP_LIST_FILE_NAME, existing: 'append' } : undefined)
          }
        />
        <span className="font-semibold text-text-base">マップ一覧ファイル (map_list.txt) を出力</span>
      </label>
      <p className="text-[11px] text-text-muted ml-6">
        同じフォルダに出力されるマップは、項目をまたいで 1 つのファイルにまとめます。ROS Standard は .yaml
        のファイル名、Image Only は .png のファイル名を 1 行ずつ書きます。
      </p>

      {value && (
        <div className="ml-6 space-y-2">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-text-muted">ファイル名</Label>
            <Input
              aria-label="マップ一覧のファイル名"
              value={value.fileName}
              onChange={(e) => onChange({ ...value, fileName: e.target.value })}
              placeholder={DEFAULT_MAP_LIST_FILE_NAME}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold text-text-muted">既存のファイルがある場合</Label>
            <div className="flex gap-4 text-xs">
              {EXISTING_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="mapListExisting"
                    checked={value.existing === option.value}
                    onChange={() => onChange({ ...value, existing: option.value })}
                    className="accent-primary-base"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
