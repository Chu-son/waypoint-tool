import { useEffect, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, PanelBottom, PanelTop, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { findTab } from '../../../utils/dockLayout';
import type { DockGroupIndex, DockSide } from '../../../types/ui';
import { cn } from '../../../utils/cn';

interface DockTabMenuProps {
  tabId: string;
  title: string;
  x: number;
  y: number;
  onClose: () => void;
}

function MenuItem({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 transition-colors cursor-pointer rounded-md',
        'text-text-muted hover:bg-surface-hover hover:text-text-base disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
    </button>
  );
}

const SIDE_NAME: Record<DockSide, string> = { left: 'Left Panel', right: 'Right Panel' };
const GROUP_NAME: Record<DockGroupIndex, string> = { 0: 'Top Group', 1: 'Bottom Group' };

/**
 * The menu of a rail tab: move it to the other column or the other side panel, reorder it within its column, or
 * reset the layout. Every entry that would leave the tab where it is stays out of the list.
 */
export function DockTabMenu({ tabId, title, x, y, onClose }: DockTabMenuProps) {
  const dockLayout = useAppStore((state) => state.dockLayout);
  const customPanelLayout = useAppStore((state) => state.customPanelLayout);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
  const movePanelTab = useAppStore((state) => state.movePanelTab);
  const reorderPanelTab = useAppStore((state) => state.reorderPanelTab);
  const resetPanelLayout = useAppStore((state) => state.resetPanelLayout);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const layout = isCustomUiMode && customPanelLayout ? customPanelLayout : dockLayout;
  const loc = findTab(layout, tabId);
  if (!loc) return null;

  const count = layout[loc.side].groups[loc.group].tabs.length;
  const otherSide: DockSide = loc.side === 'left' ? 'right' : 'left';
  const otherGroup: DockGroupIndex = loc.group === 0 ? 1 : 0;
  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        role="menu"
        aria-label={`${title} tab`}
        style={{ top: y, left: x }}
        className="fixed z-50 w-52 bg-surface-panel/98 backdrop-blur-md border border-border-base rounded-lg shadow-2xl p-1"
      >
        <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-text-muted uppercase truncate">
          {title}
        </div>
        <div className="space-y-0.5">
          <MenuItem
            icon={otherGroup === 0 ? <PanelTop size={13} /> : <PanelBottom size={13} />}
            label={`Move to ${GROUP_NAME[otherGroup]}`}
            onClick={run(() => movePanelTab(tabId, { side: loc.side, group: otherGroup }))}
          />
          {([0, 1] as const).map((group) => (
            <MenuItem
              key={group}
              icon={group === 0 ? <PanelTop size={13} /> : <PanelBottom size={13} />}
              label={`Move to ${SIDE_NAME[otherSide]} (${GROUP_NAME[group]})`}
              onClick={run(() => movePanelTab(tabId, { side: otherSide, group }))}
            />
          ))}
          {count > 1 && (
            <>
              <MenuItem
                icon={<ArrowUp size={13} />}
                label="Move Up"
                disabled={loc.index <= 0}
                onClick={run(() => reorderPanelTab(loc.side, loc.group, loc.index, loc.index - 1))}
              />
              <MenuItem
                icon={<ArrowDown size={13} />}
                label="Move Down"
                disabled={loc.index >= count - 1}
                onClick={run(() => reorderPanelTab(loc.side, loc.group, loc.index, loc.index + 1))}
              />
            </>
          )}
          <div className="my-1 border-t border-border-base/50" />
          <MenuItem icon={<RotateCcw size={13} />} label="Reset Panel Layout" onClick={run(resetPanelLayout)} />
        </div>
      </div>
    </>
  );
}
