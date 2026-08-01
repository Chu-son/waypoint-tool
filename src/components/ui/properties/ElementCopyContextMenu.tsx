import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { ElementCopyField } from '../../../stores/slices/uiSlice';
import { Button } from '../common/Button';

interface ElementCopyContextMenuProps {
  field: ElementCopyField;
  worldValue: number;
  anchorRelValue?: number;
  anchorAvailable: boolean;
  position: { x: number; y: number };
  onClose: () => void;
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
      <div className="px-3 py-1.5 font-semibold text-text-muted border-b border-border-base mb-1">
        {fieldUpper} の要素コピー
      </div>
      <Button
        variant="ghost"
        onClick={() => {
          setElementCopyState({
            field,
            value: worldValue,
            coordSystem: 'world',
            previewNodeId: null,
          });
          onClose();
        }}
        className="w-full text-left justify-between px-3 py-2 hover:bg-surface-hover text-text-base transition-colors"
      >
        <span>World 座標値でコピー</span>
        <span className="font-mono text-text-muted ml-2">{worldValue.toFixed(4)}</span>
      </Button>
      {anchorAvailable && anchorRelValue !== undefined && (
        <Button
          variant="ghost"
          onClick={() => {
            setElementCopyState({
              field,
              value: anchorRelValue,
              coordSystem: 'anchor',
              previewNodeId: null,
            });
            onClose();
          }}
          className="w-full text-left justify-between px-3 py-2 hover:bg-surface-hover text-amber-300 transition-colors"
        >
          <span>⚓ アンカー相対値でコピー</span>
          <span className="font-mono text-amber-400/80 ml-2">{anchorRelValue.toFixed(4)}</span>
        </Button>
      )}
    </div>
  );
}
