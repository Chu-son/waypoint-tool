import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { DEFAULT_PANEL_LAYOUT } from '../migrations/storageMigration';

describe('uiSlice - Panel Layout and Tab Management', () => {
  beforeEach(() => {
    useAppStore.getState().resetPanelLayout();
  });

  it('initializes with default panel layout', () => {
    const state = useAppStore.getState();
    expect(state.panelLayout).toEqual(DEFAULT_PANEL_LAYOUT);
    expect(state.leftPanelActiveTab).toBe('waypoints');
    expect(state.rightPanelActiveTab).toBe('layers');
    expect(state.isLeftPanelOpen).toBe(true);
    expect(state.isRightPanelOpen).toBe(true);
  });

  it('moves tab from left panel to right panel and switches active tab', () => {
    const state = useAppStore.getState();
    expect(state.panelLayout.leftTabs).toContain('annotations');

    state.moveTabToPanel('annotations', 'right');

    const updated = useAppStore.getState();
    expect(updated.panelLayout.leftTabs).not.toContain('annotations');
    expect(updated.panelLayout.rightTabs).toContain('annotations');
    expect(updated.rightPanelActiveTab).toBe('annotations');
    expect(updated.isRightPanelOpen).toBe(true);
  });

  it('reorders tabs within a panel', () => {
    const state = useAppStore.getState();
    expect(state.panelLayout.leftTabs[0]).toBe('waypoints');
    expect(state.panelLayout.leftTabs[1]).toBe('annotations');

    // Move 'annotations' from index 1 to index 0
    state.reorderTab('left', 1, 0);

    const updated = useAppStore.getState();
    expect(updated.panelLayout.leftTabs[0]).toBe('annotations');
    expect(updated.panelLayout.leftTabs[1]).toBe('waypoints');
  });

  it('activateTab opens the corresponding panel and sets the active tab', () => {
    const state = useAppStore.getState();
    state.setLeftPanelOpen(false);
    state.setRightPanelOpen(false);

    // Activate left tab
    state.activateTab('annotations');
    expect(useAppStore.getState().isLeftPanelOpen).toBe(true);
    expect(useAppStore.getState().leftPanelActiveTab).toBe('annotations');

    // Activate right tab
    state.activateTab('inspector');
    expect(useAppStore.getState().isRightPanelOpen).toBe(true);
    expect(useAppStore.getState().rightPanelActiveTab).toBe('inspector');

    // Legacy 'project' tab maps to 'waypoints'
    state.activateTab('project');
    expect(useAppStore.getState().leftPanelActiveTab).toBe('waypoints');
  });

  it('revealInTree activates waypoints for nodes and annotations for annotations', () => {
    const state = useAppStore.getState();

    state.revealInTree('node', 'node-123');
    expect(useAppStore.getState().leftPanelActiveTab).toBe('waypoints');
    expect(useAppStore.getState().treeRevealTarget?.id).toBe('node-123');

    state.revealInTree('annotation', 'ann-456');
    expect(useAppStore.getState().leftPanelActiveTab).toBe('annotations');
    expect(useAppStore.getState().treeRevealTarget?.id).toBe('ann-456');
  });

  it('resets panel layout back to default', () => {
    const state = useAppStore.getState();
    state.moveTabToPanel('waypoints', 'right');
    expect(useAppStore.getState().panelLayout.rightTabs).toContain('waypoints');

    state.resetPanelLayout();
    const updated = useAppStore.getState();
    expect(updated.panelLayout).toEqual(DEFAULT_PANEL_LAYOUT);
    expect(updated.leftPanelActiveTab).toBe('waypoints');
    expect(updated.rightPanelActiveTab).toBe('layers');
  });
});
