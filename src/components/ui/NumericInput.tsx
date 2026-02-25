import { useState, useEffect, useCallback } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  step?: number | string;
  precision?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * A controlled numeric input that allows intermediate editing states
 * (empty field, minus sign, trailing decimal point) without blocking input.
 * Commits the parsed value on blur or Enter.
 */
export function NumericInput({ value, onChange, step, precision = 6, placeholder, className, disabled }: NumericInputProps) {
  const [text, setText] = useState(() => formatNum(value, precision));
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value changes when not focused
  useEffect(() => {
    if (!isFocused) {
      setText(formatNum(value, precision));
    }
  }, [value, precision, isFocused]);

  const commit = useCallback(() => {
    const parsed = parseFloat(text);
    if (!isNaN(parsed)) {
      onChange(parsed);
      setText(formatNum(parsed, precision));
    } else {
      // Revert to the last valid value
      setText(formatNum(value, precision));
    }
  }, [text, value, precision, onChange]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      step={step}
      className={className}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        commit();
      }}
      onChange={e => {
        const raw = e.target.value;
        // Allow empty, minus, decimal point, and any valid number fragment
        if (raw === '' || raw === '-' || raw === '.' || raw === '-.' || /^-?\d*\.?\d*$/.test(raw)) {
          setText(raw);
          // Live-update if it's a valid number
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) {
            onChange(parsed);
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
