import { fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DockTabMenu } from './DockTabMenu';
import { renderWithStore } from '../../../test/render';
import { getAppState, getVisibleTabs, PAST_WELCOME } from '../../../test/store';
import { findTab } from '../../../utils/dockLayout';

const renderMenu = (tabId: string, onClose = vi.fn()) => {
  renderWithStore(<DockTabMenu tabId={tabId} title={tabId} x={10} y={10} onClose={onClose} />, PAST_WELCOME);
  return onClose;
};

const where = (tabId: string) => findTab(getAppState().dockLayout, tabId);

describe('DockTabMenu', () => {
  it('moves a tab to the other column of its side panel and shows both columns', () => {
    const onClose = renderMenu('inspector');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Bottom Group' }));

    expect(where('inspector')).toMatchObject({ side: 'right', group: 1 });
    expect(getVisibleTabs()).toEqual(expect.arrayContaining(['layers', 'inspector']));
    expect(onClose).toHaveBeenCalled();
  });

  it('moves a tab to the other side panel', () => {
    renderMenu('inspector');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Left Panel (Top Group)' }));

    expect(where('inspector')).toMatchObject({ side: 'left', group: 0 });
  });

  it('reorders a tab within its column', () => {
    renderMenu('layers');

    expect(screen.getByRole('menuitem', { name: 'Move Up' })).toBeDisabled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move Down' }));

    expect(getAppState().dockLayout.right.groups[0].tabs).toEqual(['inspector', 'layers']);
  });

  it('resets the layout', () => {
    renderMenu('inspector');
    getAppState().movePanelTab('inspector', { side: 'left', group: 1 });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset Panel Layout' }));

    expect(where('inspector')).toMatchObject({ side: 'right', group: 0 });
  });

  it('never marks the project as changed', () => {
    renderMenu('inspector');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Bottom Group' }));

    expect(getAppState().isDirty).toBe(false);
  });

  it('closes on Escape', () => {
    const onClose = renderMenu('layers');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
