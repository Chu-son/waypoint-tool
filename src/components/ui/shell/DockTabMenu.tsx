import { ArrowDown, ArrowUp, PanelBottom, PanelTop, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { findTab } from '../../../utils/dockLayout';
import type { DockGroupIndex, DockSide } from '../../../types/ui';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../common/ContextMenu';

interface DockTabMenuProps {
  tabId: string;
  title: string;
  x: number;
  y: number;
  onClose: () => void;
}

const SIDE_NAME: Record<DockSide, string> = { left: 'Left Panel', right: 'Right Panel' };
const GROUP_NAME: Record<DockGroupIndex, string> = { 0: 'Top Group', 1: 'Bottom Group' };
const groupIcon = (group: DockGroupIndex) => (group === 0 ? <PanelTop size={13} /> : <PanelBottom size={13} />);

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

  const layout = isCustomUiMode && customPanelLayout ? customPanelLayout : dockLayout;
  const loc = findTab(layout, tabId);
  if (!loc) return null;

  const count = layout[loc.side].groups[loc.group].tabs.length;
  const otherSide: DockSide = loc.side === 'left' ? 'right' : 'left';
  const otherGroup: DockGroupIndex = loc.group === 0 ? 1 : 0;

  return (
    <ContextMenu x={x} y={y} onClose={onClose} aria-label={`${title} tab`}>
      <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-text-muted uppercase truncate">
        {title}
      </div>
      <ContextMenuItem
        icon={groupIcon(otherGroup)}
        onSelect={() => movePanelTab(tabId, { side: loc.side, group: otherGroup })}
      >
        Move to {GROUP_NAME[otherGroup]}
      </ContextMenuItem>
      {([0, 1] as const).map((group) => (
        <ContextMenuItem
          key={group}
          icon={groupIcon(group)}
          onSelect={() => movePanelTab(tabId, { side: otherSide, group })}
        >
          Move to {SIDE_NAME[otherSide]} ({GROUP_NAME[group]})
        </ContextMenuItem>
      ))}
      {count > 1 && (
        <>
          <ContextMenuItem
            icon={<ArrowUp size={13} />}
            disabled={loc.index <= 0}
            onSelect={() => reorderPanelTab(loc.side, loc.group, loc.index, loc.index - 1)}
          >
            Move Up
          </ContextMenuItem>
          <ContextMenuItem
            icon={<ArrowDown size={13} />}
            disabled={loc.index >= count - 1}
            onSelect={() => reorderPanelTab(loc.side, loc.group, loc.index, loc.index + 1)}
          >
            Move Down
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem icon={<RotateCcw size={13} />} onSelect={resetPanelLayout}>
        Reset Panel Layout
      </ContextMenuItem>
    </ContextMenu>
  );
}
