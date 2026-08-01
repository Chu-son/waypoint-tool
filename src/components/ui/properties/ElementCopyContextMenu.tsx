import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { ElementCopyField } from '../../../stores/slices/uiSlice';
import { Button } from '../common/Button';
import { FieldLabel } from '../common/FieldLabel';
import { cn } from '../../../utils/cn';

interface ElementCopyContextMenuProps {
  field: ElementCopyField;
  worldValue: number;
  anchorRelValue?: number;
  anchorAvailable: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

function CopyMenuItem({
  label,
  value,
  isAnchor,
  onClick,
}: {
  label: string;
  value: number;
  isAnchor?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "w-full text-left justify-between px-3 py-2 hover:bg-surface-hover transition-colors",
        isAnchor ? "text-amber-300" : "text-text-base"
      )}
    >
      <span>{label}</span>
      <span className={cn("font-mono ml-2", isAnchor ? "text-amber-400/80" : "text-text-muted")}>
        {value.toFixed(4)}
      </span>
    </Button>
  );
}

export function ElementCopyContextMenu({
  field,
  worldValue,
  anchorRelValue,
  anchorAvailable,
  position,
  onClose,
}: ElementCopyContextMenuProps) {
  const setElementCopyState = useAppStore((state) => state.setElementCopyState);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const fieldUpper = field.toUpperCase();

  return (
    <div
      ref={menuRef}
      style={{ top: position.y, left: position.x }}
      className="fixed z-[9999] bg-surface-panel border border-border-base rounded-lg shadow-xl py-1 min-w-[220px] text-xs text-text-base select-none"
    >
      <div className="px-3 py-1.5 border-b border-border-base mb-1">
        <FieldLabel>{fieldUpper} の要素コピー</FieldLabel>
      </div>
      <CopyMenuItem
        label="World 座標値でコピー"
        value={worldValue}
        onClick={() => {
          setElementCopyState({
            field,
            value: worldValue,
            coordSystem: 'world',
            previewNodeId: null,
          });
          onClose();
        }}
      />
      {anchorAvailable && anchorRelValue !== undefined && (
        <CopyMenuItem
          label="⚓ アンカー相対値でコピー"
          value={anchorRelValue}
          isAnchor
          onClick={() => {
            setElementCopyState({
              field,
              value: anchorRelValue,
              coordSystem: 'anchor',
              previewNodeId: null,
            });
            onClose();
          }}
        />
      )}
    </div>
  );
}
