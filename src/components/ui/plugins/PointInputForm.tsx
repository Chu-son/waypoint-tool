import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { quaternionToYaw } from '../../../utils/transformUtils';

interface PointFormProps {
  data: any;
  onChange: (val: any) => void;
  precision?: number;
  includeYaw?: boolean;
  columns?: number;
  inputSize?: 'sm' | 'md';
}

export function PointForm({
  data,
  onChange,
  precision = 2,
  includeYaw = false,
  columns = 2,
  inputSize = 'sm',
}: PointFormProps) {
  const inputClassName = inputSize === 'md' ? 'h-8 text-xs' : 'h-7 text-[11px]';
  const gridClass = columns === 3 ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2';

  return (
    <div className={gridClass}>
      <LabeledNumericInput
        label="X (m)"
        value={data.x ?? 0}
        precision={precision}
        onChange={(val) => onChange({ ...data, x: val })}
        inputClassName={inputClassName}
      />
      <LabeledNumericInput
        label="Y (m)"
        value={data.y ?? 0}
        precision={precision}
        onChange={(val) => onChange({ ...data, y: val })}
        inputClassName={inputClassName}
      />
      {includeYaw && (
        <LabeledNumericInput
          label="Yaw (rad)"
          value={quaternionToYaw(data)}
          precision={precision}
          step="0.01"
          onChange={(val) => {
            const qz = Math.sin(val / 2);
            const qw = Math.cos(val / 2);
            onChange({ ...data, qx: 0, qy: 0, qz, qw });
          }}
          inputClassName={inputClassName}
        />
      )}
    </div>
  );
}
