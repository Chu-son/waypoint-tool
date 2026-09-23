import { LabeledNumericInput } from '../common/LabeledNumericInput';

interface RectangleFormProps {
  data: any;
  onChange: (val: any) => void;
  precision?: number;
  showFooterHint?: boolean;
  inputSize?: 'sm' | 'md';
}

export function RectangleForm({
  data,
  onChange,
  precision = 2,
  showFooterHint = false,
  inputSize = 'sm',
}: RectangleFormProps) {
  const inputClassName = inputSize === 'md' ? 'h-8 text-xs' : 'h-7 text-[11px]';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <LabeledNumericInput
          label="Width (m)"
          value={data.width ?? 0}
          precision={precision}
          onChange={(val) => onChange({ ...data, width: Math.max(0, val) })}
          inputClassName={inputClassName}
        />
        <LabeledNumericInput
          label="Height (m)"
          value={data.height ?? 0}
          precision={precision}
          onChange={(val) => onChange({ ...data, height: Math.max(0, val) })}
          inputClassName={inputClassName}
        />
        <LabeledNumericInput
          label="Center X"
          value={data.center?.x ?? 0}
          precision={precision}
          onChange={(val) => onChange({ ...data, center: { ...data.center, x: val } })}
          inputClassName={inputClassName}
        />
        <LabeledNumericInput
          label="Center Y"
          value={data.center?.y ?? 0}
          precision={precision}
          onChange={(val) => onChange({ ...data, center: { ...data.center, y: val } })}
          inputClassName={inputClassName}
        />
        <div className="col-span-2">
          <LabeledNumericInput
            label="Yaw (degrees)"
            value={((data.yaw ?? 0) * 180) / Math.PI}
            precision={1}
            onChange={(val) => onChange({ ...data, yaw: (val * Math.PI) / 180 })}
            inputClassName={inputClassName}
          />
        </div>
      </div>
      {showFooterHint && (
        <div className="text-center text-text-muted text-[9px] mt-1 font-sans border-t border-border-base/30 pt-1">
          Drag ◻ corners · Drag ↻ handle to rotate
        </div>
      )}
    </div>
  );
}
