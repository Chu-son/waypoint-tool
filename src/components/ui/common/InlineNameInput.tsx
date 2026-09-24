import { useState } from 'react';
import { cn } from '../../../utils/cn';

interface InlineNameInputProps {
  /** The current name; the input starts with this value. */
  name: string;
  /** Called with the trimmed new name when it is non-empty and differs from `name`. */
  onRename: (newName: string) => void;
  /** Called when editing ends without a change (Escape, empty input, or unchanged name). */
  onCancel: () => void;
  className?: string;
}

/**
 * Text input for renaming an item in place (tree rows etc.).
 * Mount it only while editing: Enter or blur commits, Escape cancels.
 */
export function InlineNameInput({ name, onRename, onCancel, className }: InlineNameInputProps) {
  const [value, setValue] = useState(name);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed && value !== name) {
      onRename(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      type="text"
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'flex-1 min-w-0 bg-surface-base border border-primary-base rounded px-1.5 py-0.5 text-xs text-text-base focus:outline-none',
        className,
      )}
    />
  );
}
