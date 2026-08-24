import { NumericInput } from "../NumericInput";
import { FieldLabel } from "./FieldLabel";
import { cn } from "../../../utils/cn";

export interface LabeledNumericInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  precision?: number;
  step?: number | string;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

export function LabeledNumericInput({
  label,
  value,
  onChange,
  precision = 2,
  step,
  min,
  max,
  disabled,
  className,
  inputClassName,
  onEditStart,
  onEditEnd,
}: LabeledNumericInputProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <FieldLabel className="mb-0.5">{label}</FieldLabel>
      <NumericInput
        value={value}
        onChange={onChange}
        precision={precision}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        className={cn("h-7 text-[11px]", inputClassName)}
        onEditStart={onEditStart}
        onEditEnd={onEditEnd}
      />
    </div>
  );
}
