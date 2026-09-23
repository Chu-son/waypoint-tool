import { useAppStore } from '../../../stores/appStore';
import { AnnotationObject, OptionDef } from '../../../types/store';
import { FieldLabel } from '../common/FieldLabel';
import { Label } from '../common/Label';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { ToggleSwitch } from '../common/ToggleSwitch';

export function AnnotationCustomOptionsGroup({ obj }: { obj: AnnotationObject }) {
  const optionsSchema = useAppStore((state) => state.optionsSchema);
  const updateAnnotationObject = useAppStore((state) => state.updateAnnotationObject);

  if (!optionsSchema || !optionsSchema.options || optionsSchema.options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 pt-3 border-t border-border-base/40">
      <div className="flex items-center justify-between">
        <FieldLabel>カスタムオプション (Custom Options)</FieldLabel>
        <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border-base/30 font-mono">
          Options
        </span>
      </div>

      <div className="space-y-2">
        {optionsSchema.options.map((opt: OptionDef) => {
          const optVal = obj.options?.[opt.name] ?? opt.default ?? '';

          const handleChange = (val: string | number | boolean | Array<string | number | boolean>) => {
            updateAnnotationObject(obj.id, {
              options: {
                ...(obj.options || {}),
                [opt.name]: val,
              },
            });
          };

          return (
            <div key={opt.name} className="space-y-1">
              <Label className="text-[11px] flex items-center justify-between">
                <span>{opt.label || opt.name}</span>
                <span className="opacity-50 text-[10px] uppercase font-normal">({opt.type})</span>
              </Label>

              {opt.type === 'list' ? (
                <Input
                  type="text"
                  value={Array.isArray(optVal) ? optVal.join(', ') : String(optVal || '')}
                  placeholder={
                    opt.default !== undefined
                      ? Array.isArray(opt.default)
                        ? opt.default.join(', ')
                        : String(opt.default)
                      : 'csv'
                  }
                  onChange={(e) => {
                    const rawArr = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0);
                    let parsedArr: any[] = rawArr;
                    if (opt.item_type === 'float') {
                      parsedArr = rawArr.map((s) => parseFloat(s)).filter((n) => !isNaN(n));
                    } else if (opt.item_type === 'integer') {
                      parsedArr = rawArr.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
                    } else if (opt.item_type === 'boolean') {
                      parsedArr = rawArr.map((s) => s === 'true' || s === '1');
                    }
                    handleChange(parsedArr);
                  }}
                  className="h-8 text-xs font-mono"
                />
              ) : opt.type === 'string' && opt.enum_values && opt.enum_values.length > 0 ? (
                <Select value={String(optVal)} onChange={(e) => handleChange(e.target.value)} className="h-8 text-xs">
                  {opt.enum_values.map((v: string) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              ) : opt.type === 'integer' || opt.type === 'float' ? (
                <Input
                  type="number"
                  step={opt.type === 'float' ? '0.1' : '1'}
                  value={String(optVal)}
                  placeholder={String(opt.default || '')}
                  onChange={(e) => {
                    const num = opt.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                    handleChange(isNaN(num) ? '' : num);
                  }}
                  className="h-8 text-xs font-mono"
                />
              ) : opt.type === 'boolean' ? (
                <div className="flex items-center justify-between bg-surface-panel/40 p-2 rounded-lg border border-border-base/30">
                  <span className="text-xs text-text-muted">{opt.label || opt.name}</span>
                  <ToggleSwitch checked={Boolean(optVal)} onChange={(checked) => handleChange(checked)} />
                </div>
              ) : (
                <Input
                  type="text"
                  value={String(optVal)}
                  placeholder={String(opt.default || '')}
                  onChange={(e) => handleChange(e.target.value)}
                  className="h-8 text-xs"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
