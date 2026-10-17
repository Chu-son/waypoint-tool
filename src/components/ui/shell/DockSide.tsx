import type { MouseEvent, ReactNode } from 'react';
import type { DockGroupIndex, DockSide as Side, DockState, PanelTab } from '../../../types/ui';
import { MIN_GROUP_WIDTH, shownGroups, sideHasTabs } from '../../../utils/dockLayout';
import { useDragResize } from '../../../hooks/useDragResize';
import { ErrorBoundary } from '../../common/ErrorBoundary';
import { cn } from '../../../utils/cn';
import { DockRail } from './DockRail';

interface DockPaneProps {
  side: Side;
  title: string;
  width: number;
  onWidthChange: (width: number) => void;
  children: ReactNode;
}

/** One column of a side panel. Its width changes only on the edge facing the canvas. */
function DockPane({ side, title, width, onWidthChange, children }: DockPaneProps) {
  const resize = useDragResize({ width, direction: side === 'left' ? 1 : -1, onCommit: onWidthChange });
  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${title}`}
      className={cn(
        'w-1 shrink-0 cursor-col-resize z-10 transition-colors hover:bg-primary-base/50',
        resize.isDragging ? 'bg-primary-base' : 'active:bg-primary-base',
      )}
      onMouseDown={resize.onMouseDown}
    />
  );
  const body = (
    <div
      data-testid={`dock-pane-${side}`}
      // The canvas keeps its own minimum width, so panes give way first (down to the minimum) in a narrow window.
      style={{ width: resize.width, minWidth: MIN_GROUP_WIDTH }}
      className={cn(
        'bg-surface-panel border-border-base flex flex-col z-20 shadow-lg relative',
        side === 'left' ? 'border-r' : 'border-l',
      )}
    >
      <ErrorBoundary fallbackTitle={`${title}の表示中にエラーが発生しました`}>
        <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
      </ErrorBoundary>
    </div>
  );
  return side === 'left' ? (
    <>
      {body}
      {handle}
    </>
  ) : (
    <>
      {handle}
      {body}
    </>
  );
}

interface DockSideProps {
  side: Side;
  dock: DockState;
  /** Every tab that can be docked, by id. */
  tabs: ReadonlyMap<string, PanelTab>;
  onTabClick: (tabId: string) => void;
  onTabContextMenu?: (tabId: string, event: MouseEvent) => void;
  onWidthChange: (group: DockGroupIndex, width: number) => void;
}

/**
 * A side panel: the rail on the screen edge and, from the edge toward the canvas, the columns that are shown.
 * Renders nothing when the side has no tabs.
 */
export function DockSide({ side, dock, tabs, onTabClick, onTabContextMenu, onWidthChange }: DockSideProps) {
  const sideLayout = dock.layout[side];
  if (!sideHasTabs(dock.layout, side)) return null;

  const shown = shownGroups(dock, side);
  const railGroup = (index: DockGroupIndex) => {
    const group = sideLayout.groups[index];
    return {
      tabs: group.tabs.map((id) => tabs.get(id)).filter((tab): tab is PanelTab => tab !== undefined),
      activeTab: group.activeTab,
      shown: shown.includes(index),
    };
  };

  const pane = (index: DockGroupIndex) => {
    if (!shown.includes(index)) return null;
    const group = sideLayout.groups[index];
    const tab = group.activeTab ? tabs.get(group.activeTab) : undefined;
    if (!tab) return null;
    return (
      <DockPane
        key={index}
        side={side}
        title={tab.title}
        width={group.width}
        onWidthChange={(width) => onWidthChange(index, width)}
      >
        <div key={tab.id} className="flex-1 overflow-hidden flex flex-col">
          {tab.component}
        </div>
      </DockPane>
    );
  };

  const rail = (
    <DockRail
      side={side}
      groups={[railGroup(0), railGroup(1)]}
      onTabClick={onTabClick}
      onTabContextMenu={onTabContextMenu}
    />
  );

  // Left: rail, outer column, inner column, canvas. Right: canvas, inner column, outer column, rail.
  return side === 'left' ? (
    <>
      {rail}
      {pane(1)}
      {pane(0)}
    </>
  ) : (
    <>
      {pane(0)}
      {pane(1)}
      {rail}
    </>
  );
}
