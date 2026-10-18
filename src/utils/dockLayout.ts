import type { DockGroup, DockGroupIndex, DockLayout, DockSide, DockState, LegacyPanelLayout } from '../types/ui';

/**
 * Pure operations on the side-panel dock: which tab lives in which column of which side panel, which columns are
 * shown, and what clicking a tab on the rail does. Every operation returns a new state (or the same object when
 * nothing changes) and keeps the invariants of `normalizeDockLayout`:
 * - each built-in tab appears exactly once in the whole layout,
 * - `activeTab` is one of the group's tabs (or null when it has none),
 * - an empty group is not visible.
 */

export const ALL_BUILTIN_PANEL_TAB_IDS = ['waypoints', 'annotations', 'plugins', 'layers', 'inspector'] as const;

export const MIN_GROUP_WIDTH = 200;
export const MAX_GROUP_WIDTH = 800;

const DEFAULT_LEFT_WIDTH = 280;
const DEFAULT_RIGHT_WIDTH = 320;

const SIDES: readonly DockSide[] = ['left', 'right'];
const GROUPS: readonly DockGroupIndex[] = [0, 1];

function emptyGroup(width: number): DockGroup {
  return { tabs: [], activeTab: null, visible: false, width };
}

function group(tabs: string[], width: number): DockGroup {
  return { tabs, activeTab: tabs[0] ?? null, visible: tabs.length > 0, width };
}

export function createDefaultDockLayout(): DockLayout {
  return {
    left: {
      groups: [group(['waypoints', 'annotations', 'plugins'], DEFAULT_LEFT_WIDTH), emptyGroup(DEFAULT_LEFT_WIDTH)],
    },
    right: { groups: [group(['layers', 'inspector'], DEFAULT_RIGHT_WIDTH), emptyGroup(DEFAULT_RIGHT_WIDTH)] },
  };
}

export function createDefaultDockState(): DockState {
  return { layout: createDefaultDockLayout(), open: { left: true, right: true } };
}

export function clampGroupWidth(width: number): number {
  return Math.max(MIN_GROUP_WIDTH, Math.min(width, MAX_GROUP_WIDTH));
}

function isBuiltinTab(id: string): boolean {
  return (ALL_BUILTIN_PANEL_TAB_IDS as readonly string[]).includes(id);
}

/**
 * Builds a valid layout from anything (a saved file, an older shape, garbage). Unknown ids are dropped, tabs seen
 * twice keep their first place, the retired `project` tab becomes `waypoints` + `annotations`, and built-in tabs
 * that are missing return to their default column.
 */
export function normalizeDockLayout(raw: unknown): DockLayout {
  const defaults = createDefaultDockLayout();
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const seen = new Set<string>();

  const take = (value: unknown): string[] => {
    const result: string[] = [];
    if (!Array.isArray(value)) return result;
    for (const id of value) {
      if (typeof id !== 'string') continue;
      const expanded = id === 'project' ? ['waypoints', 'annotations'] : [id];
      for (const tab of expanded) {
        if (!isBuiltinTab(tab) || seen.has(tab)) continue;
        seen.add(tab);
        result.push(tab);
      }
    }
    return result;
  };

  const layout = createDefaultDockLayout();
  const rawGroups: Record<string, any>[][] = [];
  for (const side of SIDES) {
    const groups = source[side]?.groups;
    rawGroups.push(
      GROUPS.map((i) => (Array.isArray(groups) && groups[i] && typeof groups[i] === 'object' ? groups[i] : {})),
    );
  }

  SIDES.forEach((side, s) => {
    GROUPS.forEach((i) => {
      const rawGroup = rawGroups[s][i];
      const tabs = take(rawGroup.tabs);
      const width =
        typeof rawGroup.width === 'number' && Number.isFinite(rawGroup.width)
          ? clampGroupWidth(rawGroup.width)
          : defaults[side].groups[i].width;
      layout[side].groups[i] = {
        tabs,
        activeTab:
          typeof rawGroup.activeTab === 'string' && tabs.includes(rawGroup.activeTab)
            ? rawGroup.activeTab
            : (tabs[0] ?? null),
        visible: tabs.length > 0 && rawGroup.visible !== false,
        width,
      };
    });
  });

  // Built-in tabs missing from the layout go back to their default column.
  for (const side of SIDES) {
    for (const tab of defaults[side].groups[0].tabs) {
      if (seen.has(tab)) continue;
      seen.add(tab);
      const target = layout[side].groups[0];
      target.tabs.push(tab);
      target.activeTab ??= tab;
      target.visible = true;
    }
  }

  return layout;
}

/** Converts the settings written before the dock existed: one list of tabs per side, one active tab and width. */
export function dockLayoutFromLegacy(
  legacy: Partial<LegacyPanelLayout> | undefined,
  options: { leftActiveTab?: unknown; rightActiveTab?: unknown; leftWidth?: unknown; rightWidth?: unknown } = {},
): DockLayout {
  const raw = (side: DockSide, tabs: unknown, active: unknown, width: unknown) => ({
    groups: [
      {
        tabs,
        activeTab: active === 'project' ? (side === 'left' ? 'waypoints' : 'layers') : active,
        width,
      },
    ],
  });
  return normalizeDockLayout({
    left: raw('left', legacy?.leftTabs, options.leftActiveTab, options.leftWidth),
    right: raw('right', legacy?.rightTabs, options.rightActiveTab, options.rightWidth),
  });
}

export interface CustomSidePanel {
  tabIds: string[];
  width?: number;
}

/**
 * The layout of a Custom UI: the tabs its config lists go into the first column of that side (the second column is
 * left empty); a side the config does not list keeps `base`. Tab ids are not checked against the built-in ones, and
 * the result is never saved.
 */
export function createCustomDockLayout(
  base: DockLayout,
  custom: Partial<Record<DockSide, CustomSidePanel>>,
): DockLayout {
  const layout = createDefaultDockLayout();
  for (const side of SIDES) {
    const spec = custom[side];
    if (!spec || spec.tabIds.length === 0) {
      layout[side] = { groups: base[side].groups.map((g) => ({ ...g, tabs: [...g.tabs] })) as [DockGroup, DockGroup] };
      continue;
    }
    const width = clampGroupWidth(spec.width ?? base[side].groups[0].width);
    layout[side].groups[0] = group(spec.tabIds, width);
    layout[side].groups[1] = emptyGroup(width);
  }
  return layout;
}

export interface DockLocation {
  side: DockSide;
  group: DockGroupIndex;
  index: number;
}

export function findTab(layout: DockLayout, tabId: string): DockLocation | null {
  for (const side of SIDES) {
    for (const group of GROUPS) {
      const index = layout[side].groups[group].tabs.indexOf(tabId);
      if (index >= 0) return { side, group, index };
    }
  }
  return null;
}

function cloneState(state: DockState): DockState {
  const cloneSide = (side: DockSide) => ({
    groups: state.layout[side].groups.map((g) => ({ ...g, tabs: [...g.tabs] })) as [DockGroup, DockGroup],
  });
  return { layout: { left: cloneSide('left'), right: cloneSide('right') }, open: { ...state.open } };
}

function isGroupShown(state: DockState, side: DockSide, group: DockGroupIndex): boolean {
  const g = state.layout[side].groups[group];
  return state.open[side] && g.visible && g.activeTab !== null;
}

export function sideHasTabs(layout: DockLayout, side: DockSide): boolean {
  return layout[side].groups.some((g) => g.tabs.length > 0);
}

/** The groups of a side panel that are on screen, from the canvas outward. Empty while the panel is closed. */
export function shownGroups(state: DockState, side: DockSide): DockGroupIndex[] {
  return GROUPS.filter((i) => isGroupShown(state, side, i));
}

/** Tabs whose contents are on screen right now. */
export function visibleTabIds(state: DockState): string[] {
  const ids: string[] = [];
  for (const side of SIDES) {
    for (const i of GROUPS) {
      if (isGroupShown(state, side, i)) ids.push(state.layout[side].groups[i].activeTab as string);
    }
  }
  return ids;
}

/** Opens a tab in its column (showing the column and its panel). Does nothing when the tab is already on screen. */
export function activateTab(state: DockState, tabId: string): DockState {
  const loc = findTab(state.layout, tabId);
  if (!loc) return state;
  const g = state.layout[loc.side].groups[loc.group];
  if (isGroupShown(state, loc.side, loc.group) && g.activeTab === tabId) return state;
  const next = cloneState(state);
  const target = next.layout[loc.side].groups[loc.group];
  target.activeTab = tabId;
  target.visible = true;
  next.open[loc.side] = true;
  return next;
}

/**
 * What clicking a tab on the rail does: show it, or — when it is already the one shown — hide its column (if the
 * other column is also shown) or close the whole panel. A hidden column is remembered, so reopening restores it.
 */
export function clickTab(state: DockState, tabId: string): DockState {
  const loc = findTab(state.layout, tabId);
  if (!loc) return state;
  const g = state.layout[loc.side].groups[loc.group];
  if (!(isGroupShown(state, loc.side, loc.group) && g.activeTab === tabId)) return activateTab(state, tabId);

  const next = cloneState(state);
  const otherIndex: DockGroupIndex = loc.group === 0 ? 1 : 0;
  if (isGroupShown(state, loc.side, otherIndex)) {
    next.layout[loc.side].groups[loc.group].visible = false;
  } else {
    next.open[loc.side] = false;
  }
  return next;
}

export function setPanelOpen(state: DockState, side: DockSide, open: boolean): DockState {
  if (state.open[side] === open) return state;
  if (open && !sideHasTabs(state.layout, side)) return state;
  const next = cloneState(state);
  next.open[side] = open;
  if (open && !GROUPS.some((i) => isGroupShown(next, side, i))) {
    // Nothing would show: bring back the first column that has tabs.
    const first = GROUPS.find((i) => next.layout[side].groups[i].tabs.length > 0);
    if (first !== undefined) next.layout[side].groups[first].visible = true;
  }
  return next;
}

export function moveTab(
  state: DockState,
  tabId: string,
  target: { side: DockSide; group: DockGroupIndex },
  index?: number,
): DockState {
  const loc = findTab(state.layout, tabId);
  if (!loc) return state;
  const next = cloneState(state);

  const source = next.layout[loc.side].groups[loc.group];
  source.tabs.splice(loc.index, 1);
  if (source.activeTab === tabId) source.activeTab = source.tabs[Math.min(loc.index, source.tabs.length - 1)] ?? null;
  if (source.tabs.length === 0) source.visible = false;

  const dest = next.layout[target.side].groups[target.group];
  const at = index === undefined ? dest.tabs.length : Math.max(0, Math.min(index, dest.tabs.length));
  dest.tabs.splice(at, 0, tabId);
  dest.activeTab = tabId;
  dest.visible = true;
  next.open[target.side] = true;

  if (loc.side !== target.side && !sideHasTabs(next.layout, loc.side)) next.open[loc.side] = false;
  return next;
}

export function reorderTab(
  state: DockState,
  side: DockSide,
  group: DockGroupIndex,
  from: number,
  to: number,
): DockState {
  const tabs = state.layout[side].groups[group].tabs;
  if (from === to || from < 0 || to < 0 || from >= tabs.length || to >= tabs.length) return state;
  const next = cloneState(state);
  const list = next.layout[side].groups[group].tabs;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return next;
}

export function setGroupWidth(state: DockState, side: DockSide, group: DockGroupIndex, width: number): DockState {
  const clamped = clampGroupWidth(width);
  if (state.layout[side].groups[group].width === clamped) return state;
  const next = cloneState(state);
  next.layout[side].groups[group].width = clamped;
  return next;
}
