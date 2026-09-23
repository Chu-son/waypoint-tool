import { useAppStore } from '../../../stores/appStore';
import { DEFAULT_ANNOTATION_COLOR } from '../../../utils/colorPresets';
import { Select } from '../common/Select';
import type { PluginInput } from './PluginInputEditor';

interface AnnotationSelectFormProps {
  input: PluginInput;
  value: any;
  onChange: (val: any) => void;
}

export function AnnotationSelectForm({ input, value, onChange }: AnnotationSelectFormProps) {
  const annotationObjects = useAppStore((state) => state.annotationObjects) || {};
  const annotationOrder = useAppStore((state) => state.annotationOrder) || [];

  const filterType = input.object_type;
  const filteredAnnotations = annotationOrder
    .map((id) => annotationObjects[id])
    .filter((a) => a && (filterType === 'any' || !filterType || a.type === filterType));

  const isMultiple = !!input.multiple;

  if (filteredAnnotations.length === 0) {
    return (
      <div className="text-xs text-text-muted/60 italic py-1 text-center">
        利用可能なアノテーション ({filterType || 'any'}) がありません
      </div>
    );
  }

  if (isMultiple) {
    const selectedList: any[] = Array.isArray(value) ? value : [];
    const selectedIds = new Set(selectedList.map((item) => (typeof item === 'string' ? item : item?.id)));

    const handleToggle = (obj: any) => {
      if (selectedIds.has(obj.id)) {
        onChange(selectedList.filter((item) => (typeof item === 'string' ? item : item?.id) !== obj.id));
      } else {
        onChange([...selectedList, obj]);
      }
    };

    return (
      <div className="space-y-1 max-h-36 overflow-y-auto p-1 bg-surface-base/40 rounded border border-border-base/30">
        {filteredAnnotations.map((obj) => (
          <label
            key={obj.id}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-hover cursor-pointer text-xs select-none"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(obj.id)}
              onChange={() => handleToggle(obj)}
              className="rounded border-border-base text-primary-base focus:ring-0"
            />
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: obj.color || DEFAULT_ANNOTATION_COLOR }}
            />
            <span className="truncate flex-1 font-medium">{obj.name}</span>
            <span className="text-[10px] text-text-muted uppercase font-mono">{obj.type}</span>
          </label>
        ))}
      </div>
    );
  }

  const currentId = typeof value === 'string' ? value : value?.id || '';

  return (
    <Select
      value={currentId}
      onChange={(e) => {
        const found = annotationObjects[e.target.value];
        onChange(found || null);
      }}
      className="h-8 text-xs w-full"
    >
      <option value="">-- アノテーションを選択 --</option>
      {filteredAnnotations.map((obj) => (
        <option key={obj.id} value={obj.id}>
          {obj.name} ({obj.type})
        </option>
      ))}
    </Select>
  );
}
