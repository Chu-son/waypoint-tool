import { describe, expect, it } from 'vitest';
import type { DockGroupIndex, DockSide, DockState } from '../types/ui';
import {
  ALL_BUILTIN_PANEL_TAB_IDS,
  MAX_GROUP_WIDTH,
  MIN_GROUP_WIDTH,
  activateTab,
  clickTab,
  createDefaultDockState,
  dockLayoutFromLegacy,
  findTab,
  moveTab,
  normalizeDockLayout,
  reorderTab,
  setGroupWidth,
  setPanelOpen,
  shownGroups,
  visibleTabIds,
} from './dockLayout';

/** Right panel with Layers in the inner column and Inspector in the outer one, both shown. */
function layersBesideInspector(): DockState {
  return moveTab(createDefaultDockState(), 'inspector', { side: 'right', group: 1 });
}

function expectInvariants(state: DockState) {
  const seen: string[] = [];
  for (const side of ['left', 'right'] as DockSide[]) {
    for (const g of state.layout[side].groups) {
      seen.push(...g.tabs);
      if (g.tabs.length === 0) {
        expect(g.activeTab).toBeNull();
        expect(g.visible).toBe(false);
      } else {
        expect(g.tabs).toContain(g.activeTab);
      }
    }
  }
  expect([...seen].sort()).toEqual([...ALL_BUILTIN_PANEL_TAB_IDS].sort());
}

describe('normalizeDockLayout', () => {
  it('gives the default layout for missing or broken input', () => {
    const defaults = createDefaultDockState().layout;
    expect(normalizeDockLayout(undefined)).toEqual(defaults);
    expect(normalizeDockLayout('nope')).toEqual(defaults);
    expect(normalizeDockLayout({ left: 3, right: { groups: 'x' } })).toEqual(defaults);
  });

  it('drops unknown tabs, keeps the first of a duplicate and brings missing tabs back to their default column', () => {
    const layout = normalizeDockLayout({
      left: { groups: [{ tabs: ['layers', 'ghost', 'layers'] }, { tabs: ['inspector'] }] },
      right: { groups: [{ tabs: ['layers', 7] }, {}] },
    });
    expect(layout.left.groups[0].tabs).toEqual(['layers', 'waypoints', 'annotations', 'plugins']);
    expect(layout.left.groups[1].tabs).toEqual(['inspector']);
    expect(layout.right.groups[0].tabs).toEqual([]);
    expectInvariants({ layout, open: { left: true, right: true } });
  });

  it('expands the retired project tab into waypoints and annotations', () => {
    const layout = normalizeDockLayout({ left: { groups: [{ tabs: ['project', 'plugins'] }] } });
    expect(layout.left.groups[0].tabs).toEqual(['waypoints', 'annotations', 'plugins']);
  });

  it('repairs an active tab that is not in the group and hides an empty group', () => {
    const layout = normalizeDockLayout({
      right: { groups: [{ tabs: ['layers', 'inspector'], activeTab: 'plugins', visible: true }, { visible: true }] },
    });
    expect(layout.right.groups[0].activeTab).toBe('layers');
    expect(layout.right.groups[1].visible).toBe(false);
  });

  it('clamps widths and falls back to the default for non-numbers', () => {
    const layout = normalizeDockLayout({
      left: { groups: [{ width: 5 }, { width: 99999 }] },
      right: { groups: [{ width: 'wide' }] },
    });
    expect(layout.left.groups[0].width).toBe(MIN_GROUP_WIDTH);
    expect(layout.left.groups[1].width).toBe(MAX_GROUP_WIDTH);
    expect(layout.right.groups[0].width).toBe(createDefaultDockState().layout.right.groups[0].width);
  });

  it('is idempotent', () => {
    const once = normalizeDockLayout({ left: { groups: [{ tabs: ['project', 'x'], width: 1 }] } });
    expect(normalizeDockLayout(once)).toEqual(once);
  });
});

describe('dockLayoutFromLegacy', () => {
  it('moves the old per-side tab lists, active tabs and widths into the inner column', () => {
    const layout = dockLayoutFromLegacy(
      { leftTabs: ['annotations', 'waypoints'], rightTabs: ['inspector', 'layers', 'plugins'] },
      { leftActiveTab: 'waypoints', rightActiveTab: 'layers', leftWidth: 400, rightWidth: 350 },
    );
    expect(layout.left.groups[0]).toMatchObject({
      tabs: ['annotations', 'waypoints'],
      activeTab: 'waypoints',
      width: 400,
    });
    expect(layout.right.groups[0]).toMatchObject({
      tabs: ['inspector', 'layers', 'plugins'],
      activeTab: 'layers',
      width: 350,
    });
    expect(layout.left.groups[1].tabs).toEqual([]);
  });

  it('maps an active tab of project to the side’s first tab, and falls back to defaults without a legacy layout', () => {
    expect(
      dockLayoutFromLegacy({ leftTabs: ['project'], rightTabs: [] }, { leftActiveTab: 'project' }).left.groups[0]
        .activeTab,
    ).toBe('waypoints');
    expect(dockLayoutFromLegacy(undefined)).toEqual(createDefaultDockState().layout);
  });
});

describe('clickTab', () => {
  it('shows a tab of the other column in its own column and keeps the first column', () => {
    const state = layersBesideInspector();
    const hidden = clickTab(clickTab(state, 'inspector'), 'inspector'); // hide, then show again
    expect(shownGroups(hidden, 'right')).toEqual([0, 1]);
    expect(visibleTabIds(hidden)).toContain('layers');
    expect(visibleTabIds(hidden)).toContain('inspector');
  });

  it('hides the column of the shown tab when the other column is also shown', () => {
    const state = clickTab(layersBesideInspector(), 'inspector');
    expect(shownGroups(state, 'right')).toEqual([0]);
    expect(state.open.right).toBe(true);
  });

  it('closes the panel when the shown tab is the only thing on screen, and reopens it on the next click', () => {
    const closed = clickTab(createDefaultDockState(), 'layers');
    expect(closed.open.right).toBe(false);
    expect(visibleTabIds(closed)).not.toContain('layers');

    const reopened = clickTab(closed, 'layers');
    expect(reopened.open.right).toBe(true);
    expect(visibleTabIds(reopened)).toContain('layers');
  });

  it('switches the tab of a column without touching the other column', () => {
    const state = clickTab(layersBesideInspector(), 'plugins'); // plugins is in the left panel
    expect(state.layout.left.groups[0].activeTab).toBe('plugins');
    expect(visibleTabIds(state)).toContain('inspector');
  });

  it('restores both columns after the panel was closed from the two-column state', () => {
    let state = layersBesideInspector();
    state = clickTab(state, 'layers'); // inspector column stays → hides layers column
    state = clickTab(state, 'inspector'); // only column left → closes the panel
    expect(state.open.right).toBe(false);
    state = clickTab(state, 'layers');
    expect(visibleTabIds(state)).toContain('layers');
  });

  it('ignores a tab that is not in the layout', () => {
    const state = createDefaultDockState();
    expect(clickTab(state, 'ghost')).toBe(state);
  });
});

describe('activateTab', () => {
  it('changes nothing when the tab is already on screen, so a second column is not disturbed', () => {
    const state = layersBesideInspector();
    expect(activateTab(state, 'inspector')).toBe(state);
  });

  it('opens the panel and column holding a hidden tab', () => {
    let state = layersBesideInspector();
    state = clickTab(state, 'inspector'); // hide the inspector column
    state = clickTab(state, 'layers'); // close the panel
    expect(state.open.right).toBe(false);

    const next = activateTab(state, 'inspector');
    expect(next.open.right).toBe(true);
    expect(visibleTabIds(next)).toContain('inspector');
  });

  it('brings a background tab of a column forward without hiding the other column', () => {
    const state = activateTab(layersBesideInspector(), 'plugins');
    expect(state.layout.left.groups[0].activeTab).toBe('plugins');
    expect(visibleTabIds(state)).toEqual(expect.arrayContaining(['plugins', 'layers', 'inspector']));
  });
});

describe('moveTab', () => {
  it('moves a tab into the other column of the same panel and shows both', () => {
    const state = layersBesideInspector();
    expect(findTab(state.layout, 'inspector')).toMatchObject({ side: 'right', group: 1 });
    expect(state.layout.right.groups[0].tabs).toEqual(['layers']);
    expect(shownGroups(state, 'right')).toEqual([0, 1]);
    expectInvariants(state);
  });

  it('moves a tab to the other panel, opens it and closes the panel that is now empty', () => {
    let state = createDefaultDockState();
    state = moveTab(state, 'layers', { side: 'left', group: 0 });
    state = moveTab(state, 'inspector', { side: 'left', group: 1 });
    expect(state.open.right).toBe(false);
    expect(state.open.left).toBe(true);
    expectInvariants(state);
  });

  it('picks a neighbour as active when the active tab leaves, and hides an emptied column', () => {
    let state = createDefaultDockState();
    state = moveTab(state, 'waypoints', { side: 'right', group: 1 });
    expect(state.layout.left.groups[0].activeTab).toBe('annotations');
    state = moveTab(state, 'layers', { side: 'left', group: 0 });
    state = moveTab(state, 'inspector', { side: 'left', group: 0 });
    expect(state.layout.right.groups[0].visible).toBe(false);
    expectInvariants(state);
  });

  it('reorders inside one column when the target is the same column', () => {
    const state = moveTab(createDefaultDockState(), 'layers', { side: 'right', group: 0 }, 99);
    expect(state.layout.right.groups[0].tabs).toEqual(['inspector', 'layers']);
    expectInvariants(state);
  });

  it('ignores an unknown tab', () => {
    const state = createDefaultDockState();
    expect(moveTab(state, 'ghost', { side: 'left', group: 1 })).toBe(state);
  });
});

describe('reorderTab / setGroupWidth / setPanelOpen', () => {
  it('reorders tabs of a column and ignores out-of-range moves', () => {
    const state = createDefaultDockState();
    expect(reorderTab(state, 'left', 0, 0, 2).layout.left.groups[0].tabs).toEqual([
      'annotations',
      'plugins',
      'waypoints',
    ]);
    expect(reorderTab(state, 'left', 0, 0, 9)).toBe(state);
    expect(reorderTab(state, 'left', 0, 1, 1)).toBe(state);
  });

  it('clamps a column width', () => {
    const state = createDefaultDockState();
    expect(setGroupWidth(state, 'right', 0, 10).layout.right.groups[0].width).toBe(MIN_GROUP_WIDTH);
    expect(setGroupWidth(state, 'right', 0, 5000).layout.right.groups[0].width).toBe(MAX_GROUP_WIDTH);
    expect(setGroupWidth(state, 'right', 0, 400).layout.right.groups[0].width).toBe(400);
  });

  it('opens a panel with every column hidden by showing its first column that has tabs', () => {
    let state = layersBesideInspector();
    state = { ...state, layout: normalizeDockLayout(state.layout), open: { ...state.open, right: false } };
    state.layout.right.groups[0].visible = false;
    state.layout.right.groups[1].visible = false;
    const opened = setPanelOpen(state, 'right', true);
    expect(opened.open.right).toBe(true);
    expect(shownGroups(opened, 'right')).toEqual([0]);
  });

  it('does not open a panel that has no tabs', () => {
    let state = createDefaultDockState();
    state = moveTab(state, 'layers', { side: 'left', group: 0 });
    state = moveTab(state, 'inspector', { side: 'left', group: 0 });
    expect(setPanelOpen(state, 'right', true).open.right).toBe(false);
  });
});

describe('random operation sequences', () => {
  it('keep every built-in tab exactly once and the column rules intact', () => {
    let seed = 12345;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const tabs = [...ALL_BUILTIN_PANEL_TAB_IDS];
    const sides: DockSide[] = ['left', 'right'];
    let state = createDefaultDockState();

    for (let step = 0; step < 500; step++) {
      const tab = tabs[rand(tabs.length)];
      const side = sides[rand(2)];
      const group = rand(2) as DockGroupIndex;
      switch (rand(6)) {
        case 0:
          state = clickTab(state, tab);
          break;
        case 1:
          state = activateTab(state, tab);
          break;
        case 2:
          state = moveTab(state, tab, { side, group }, rand(4));
          break;
        case 3:
          state = reorderTab(state, side, group, rand(4), rand(4));
          break;
        case 4:
          state = setPanelOpen(state, side, rand(2) === 0);
          break;
        default:
          state = setGroupWidth(state, side, group, rand(1200));
      }
      expectInvariants(state);
      expect(normalizeDockLayout(state.layout)).toEqual(state.layout);
    }
  });
});
