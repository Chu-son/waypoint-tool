import { useState, useEffect, useCallback } from 'react';
import { Input } from './common/Input';

export interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  step?: number | string;
  min?: number;
  max?: number;
  precision?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** キー入力開始時（フォーカス時）に呼ばれる。連続編集をUndo/Redoの1エントリにまとめるために使う。 */
  onEditStart?: () => void;
  /** キー入力終了時（ブラー時）に呼ばれる。 */
  onEditEnd?: () => void;
}

/**
 * A controlled numeric input that allows intermediate editing states
 * (empty field, minus sign, trailing decimal point) without blocking input.
 * Commits the parsed value on blur or Enter.
 */
export function NumericInput({
  value,
  onChange,
  step,
  min,
  max,
  precision = 6,
  placeholder,
  className,
  disabled,
  onEditStart,
  onEditEnd,
}: NumericInputProps) {
  const [text, setText] = useState(() => formatNum(value, precision));
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value changes when not focused
  useEffect(() => {
    if (!isFocused) {
      setText(formatNum(value, precision));
    }
  }, [value, precision, isFocused]);

  const commit = useCallback(() => {
    let parsed = parseFloat(text);
    if (!isNaN(parsed)) {
      if (min !== undefined) parsed = Math.max(min, parsed);
      if (max !== undefined) parsed = Math.min(max, parsed);
      onChange(parsed);
      setText(formatNum(parsed, precision));
    } else {
      // Revert to the last valid value
      setText(formatNum(value, precision));
    }
  }, [text, value, precision, min, max, onChange]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      step={step}
      className={className}
      onFocus={() => {
        setIsFocused(true);
        onEditStart?.();
      }}
      onBlur={() => {
        setIsFocused(false);
        commit();
        onEditEnd?.();
      }}
      onChange={e => {
        const raw = e.target.value;
        // Allow empty, minus, decimal point, and any valid number fragment
        if (raw === '' || raw === '-' || raw === '.' || raw === '-.' || /^-?\d*\.?\d*$/.test(raw)) {
          setText(raw);
          // Live-update if it's a valid number and within optional bounds
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) {
            const isWithinMin = min === undefined || parsed >= min;
            const isWithinMax = max === undefined || parsed <= max;
            if (isWithinMin && isWithinMax) {
              onChange(parsed);
            }
          }
        }
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function formatNum(v: number, precision: number): string {
  if (v === 0) return '0';
  // Remove trailing zeros after formatting
  return parseFloat(v.toFixed(precision)).toString();
}
