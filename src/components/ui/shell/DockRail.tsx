import { Fragment, type KeyboardEvent, type MouseEvent } from 'react';
import type { DockGroupIndex, DockSide, PanelTab } from '../../../types/ui';
import { cn } from '../../../utils/cn';

export interface DockRailGroup {
  tabs: PanelTab[];
  /** The tab this column shows (or would show when it is shown again). */
  activeTab: string | null;
  /** Whether this column is on screen right now. */
  shown: boolean;
}

interface DockRailProps {
  side: DockSide;
  /** [0] = column nearest the canvas (top of the rail), [1] = column nearest the screen edge (bottom of the rail). */
  groups: [DockRailGroup, DockRailGroup];
  onTabClick: (tabId: string) => void;
  onTabContextMenu?: (tabId: string, event: MouseEvent) => void;
}

const SIDE_LABEL: Record<DockSide, string> = { left: 'Left', right: 'Right' };

/** WAI-ARIA tabs (vertical): ↑↓ move focus between the tabs of a column, Home/End jump to its first/last. */
function moveFocusWithArrows(e: KeyboardEvent<HTMLElement>) {
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (current < 0) return;
  let next: number;
  if (e.key === 'ArrowDown') next = (current + 1) % tabs.length;
  else if (e.key === 'ArrowUp') next = (current - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = tabs.length - 1;
  else return;
  e.preventDefault();
  tabs[next].focus();
}

/**
 * The always-visible strip of vertical tabs on the outer edge of a side panel. Clicking a tab shows it, or hides it
 * when it is the one shown. Tabs of the two columns are separated by a line; labels are written vertically.
 */
export function DockRail({ side, groups, onTabClick, onTabContextMenu }: DockRailProps) {
  const hasTop = groups[0].tabs.length > 0;
  return (
    <div
      data-testid={`dock-rail-${side}`}
      className={cn(
        'w-7 shrink-0 bg-surface-panel border-border-base z-20 flex flex-col items-stretch py-1 gap-1',
        side === 'left' ? 'border-r' : 'border-l',
      )}
    >
      {groups.map((group, index) => {
        if (group.tabs.length === 0) return null;
        const groupIndex = index as DockGroupIndex;
        return (
          <Fragment key={groupIndex}>
            {groupIndex === 1 && hasTop && (
              <div role="separator" className="mx-1.5 my-0.5 border-t border-border-base" />
            )}
            <div
              role="tablist"
              aria-orientation="vertical"
              aria-label={`${SIDE_LABEL[side]} panel tabs ${groupIndex + 1}`}
              className="flex flex-col items-stretch gap-1"
              onKeyDown={moveFocusWithArrows}
            >
              {group.tabs.map((tab) => {
                const isShown = group.shown && group.activeTab === tab.id;
                // Only one tab per column is in the tab order: the one shown (or the first, when none is).
                const isTabStop = group.activeTab !== null ? group.activeTab === tab.id : tab === group.tabs[0];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isShown}
                    tabIndex={isTabStop ? 0 : -1}
                    title={tab.title}
                    onClick={() => onTabClick(tab.id)}
                    onContextMenu={onTabContextMenu ? (e) => onTabContextMenu(tab.id, e) : undefined}
                    className={cn(
                      'py-2 px-1 rounded-md flex items-center gap-1.5 cursor-pointer select-none transition-colors',
                      'text-[11px] font-semibold tracking-wide',
                      // Left rail: the label reads bottom to top, so its icon goes next to the start of the text.
                      side === 'left' ? 'flex-col-reverse' : 'flex-col',
                      isShown
                        ? 'text-primary-base bg-primary-base/15 font-bold shadow-sm'
                        : 'text-text-muted hover:text-text-base hover:bg-surface-hover/60',
                    )}
                  >
                    <span className="shrink-0">{tab.icon}</span>
                    <span
                      className={cn('[writing-mode:vertical-rl] whitespace-nowrap', side === 'left' && 'rotate-180')}
                    >
                      {tab.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
