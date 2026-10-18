import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { getVisibleTabs, resetAppStore } from '../../test/store';
import { createDefaultDockLayout } from '../../utils/dockLayout';

const dock = () => useAppStore.getState().dockLayout;

describe('uiSlice - Panel Layout and Tab Management', () => {
  beforeEach(() => {
    resetAppStore();
  });

  it('starts with the default layout and both panels open', () => {
    const state = useAppStore.getState();
    expect(state.dockLayout).toEqual(createDefaultDockLayout());
    expect(getVisibleTabs()).toEqual(['waypoints', 'layers']);
    expect(state.isLeftPanelOpen).toBe(true);
    expect(state.isRightPanelOpen).toBe(true);
  });

  it('moves a tab to the other panel, opening it there and showing the tab', () => {
    useAppStore.getState().movePanelTab('annotations', { side: 'right', group: 0 });

    expect(dock().left.groups[0].tabs).not.toContain('annotations');
    expect(dock().right.groups[0].tabs).toContain('annotations');
    expect(getVisibleTabs()).toContain('annotations');
    expect(useAppStore.getState().isRightPanelOpen).toBe(true);
  });

  it('shows two tabs of the same panel side by side once one is moved to its second column', () => {
    useAppStore.getState().movePanelTab('inspector', { side: 'right', group: 1 });

    expect(getVisibleTabs()).toEqual(expect.arrayContaining(['layers', 'inspector']));
    expect(dock().right.groups[0].tabs).toEqual(['layers']);
    expect(dock().right.groups[1].tabs).toEqual(['inspector']);
  });

  it('reorders tabs within a column', () => {
    useAppStore.getState().reorderPanelTab('left', 0, 1, 0);

    expect(dock().left.groups[0].tabs.slice(0, 2)).toEqual(['annotations', 'waypoints']);
  });

  it('activateTab opens the panel that holds the tab and shows it', () => {
    const state = useAppStore.getState();
    state.setLeftPanelOpen(false);
    state.setRightPanelOpen(false);

    state.activateTab('annotations');
    expect(useAppStore.getState().isLeftPanelOpen).toBe(true);
    expect(getVisibleTabs()).toContain('annotations');

    state.activateTab('inspector');
    expect(useAppStore.getState().isRightPanelOpen).toBe(true);
    expect(getVisibleTabs()).toContain('inspector');
  });

  it('activateTab leaves the layout alone when the tab is already on screen', () => {
    useAppStore.getState().movePanelTab('inspector', { side: 'right', group: 1 });
    const before = dock();

    useAppStore.getState().activateTab('inspector');

    expect(dock()).toBe(before);
  });

  it('clicking a rail tab shows it, then hides its column, then closes the panel', () => {
    const state = useAppStore.getState();
    state.movePanelTab('inspector', { side: 'right', group: 1 });

    state.clickPanelTab('inspector'); // already shown, the other column is also shown: hide this column
    expect(getVisibleTabs()).not.toContain('inspector');
    expect(useAppStore.getState().isRightPanelOpen).toBe(true);

    state.clickPanelTab('layers'); // the only column left on screen: close the panel
    expect(useAppStore.getState().isRightPanelOpen).toBe(false);

    state.clickPanelTab('inspector'); // reopens the panel with that column
    expect(useAppStore.getState().isRightPanelOpen).toBe(true);
    expect(getVisibleTabs()).toContain('inspector');
  });

  it('revealInTree shows waypoints for nodes and annotations for annotations', () => {
    const state = useAppStore.getState();

    state.revealInTree('node', 'node-123');
    expect(getVisibleTabs()).toContain('waypoints');
    expect(useAppStore.getState().treeRevealTarget?.id).toBe('node-123');

    state.revealInTree('annotation', 'ann-456');
    expect(getVisibleTabs()).toContain('annotations');
    expect(useAppStore.getState().treeRevealTarget?.id).toBe('ann-456');
  });

  it('resets the layout back to the default', () => {
    const state = useAppStore.getState();
    state.movePanelTab('waypoints', { side: 'right', group: 1 });
    state.setPanelGroupWidth('right', 0, 500);

    state.resetPanelLayout();

    expect(useAppStore.getState().dockLayout).toEqual(createDefaultDockLayout());
  });

  it('keeps a column width within its limits', () => {
    useAppStore.getState().setPanelGroupWidth('right', 0, 5000);
    expect(dock().right.groups[0].width).toBe(800);

    useAppStore.getState().setPanelGroupWidth('right', 0, 10);
    expect(dock().right.groups[0].width).toBe(200);
  });

  it('does not mark the project as changed when the layout changes', () => {
    const state = useAppStore.getState();
    expect(state.isDirty).toBe(false);

    state.movePanelTab('inspector', { side: 'right', group: 1 });
    state.reorderPanelTab('left', 0, 0, 1);
    state.setPanelGroupWidth('left', 0, 400);
    state.clickPanelTab('layers');
    state.setLeftPanelOpen(false);
    state.resetPanelLayout();
    state.resetWindowLayout();

    expect(useAppStore.getState().isDirty).toBe(false);
  });
});
