import { useMemo } from 'react';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DockSide } from './DockSide';
import { renderWithStore } from '../../../test/render';
import { getAppState, getVisibleTabs, PAST_WELCOME } from '../../../test/store';
import { useAppStore } from '../../../stores/appStore';
import { getDockState } from '../../../stores/dockAccess';
import type { PanelTab } from '../../../types/ui';

const TAB_IDS = ['waypoints', 'annotations', 'plugins', 'layers', 'inspector'];

/** Both side panels wired to the real store, with plain text as each tab's contents. */
function Docks() {
  const layout = useAppStore((s) => s.dockLayout);
  const left = useAppStore((s) => s.isLeftPanelOpen);
  const right = useAppStore((s) => s.isRightPanelOpen);
  const dock = useMemo(() => ({ layout, open: { left, right } }), [layout, left, right]);
  const tabs = useMemo(
    () =>
      new Map<string, PanelTab>(
        TAB_IDS.map((id) => [id, { id, title: id.toUpperCase(), component: <div>{`contents of ${id}`}</div> }]),
      ),
    [],
  );
  const clickPanelTab = useAppStore((s) => s.clickPanelTab);
  const setPanelGroupWidth = useAppStore((s) => s.setPanelGroupWidth);
  return (
    <div>
      <DockSide
        side="left"
        dock={dock}
        tabs={tabs}
        onTabClick={clickPanelTab}
        onWidthChange={(g, w) => setPanelGroupWidth('left', g, w)}
      />
      <DockSide
        side="right"
        dock={dock}
        tabs={tabs}
        onTabClick={clickPanelTab}
        onWidthChange={(g, w) => setPanelGroupWidth('right', g, w)}
      />
    </div>
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });

describe('DockSide', () => {
  it('shows each side panel with its first tab and a rail of vertical tabs', () => {
    renderWithStore(<Docks />, PAST_WELCOME);

    expect(screen.getByText('contents of waypoints')).toBeInTheDocument();
    expect(screen.getByText('contents of layers')).toBeInTheDocument();
    expect(screen.queryByText('contents of inspector')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('dock-rail-right')).getAllByRole('tab')).toHaveLength(2);
    expect(tab('LAYERS')).toHaveAttribute('aria-selected', 'true');
    expect(tab('INSPECTOR')).toHaveAttribute('aria-selected', 'false');
  });

  it('switches tabs from the rail', () => {
    renderWithStore(<Docks />, PAST_WELCOME);

    fireEvent.click(tab('INSPECTOR'));

    expect(screen.getByText('contents of inspector')).toBeInTheDocument();
    expect(screen.queryByText('contents of layers')).not.toBeInTheDocument();
  });

  it('closes the panel when its only shown tab is clicked, and keeps the rail so it can be reopened', () => {
    renderWithStore(<Docks />, PAST_WELCOME);

    fireEvent.click(tab('LAYERS'));

    expect(screen.queryByText('contents of layers')).not.toBeInTheDocument();
    expect(tab('LAYERS')).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(tab('LAYERS'));

    expect(screen.getByText('contents of layers')).toBeInTheDocument();
  });

  it('shows two columns side by side when both have an active tab, and hides one by clicking its tab', () => {
    renderWithStore(<Docks />, PAST_WELCOME);
    act(() => {
      getAppState().movePanelTab('inspector', { side: 'right', group: 1 });
    });
    expect(getVisibleTabs()).toEqual(expect.arrayContaining(['layers', 'inspector']));

    // Re-render with the new layout.
    expect(screen.getAllByTestId('dock-pane-right')).toHaveLength(2);
    expect(screen.getByText('contents of layers')).toBeInTheDocument();
    expect(screen.getByText('contents of inspector')).toBeInTheDocument();

    fireEvent.click(tab('INSPECTOR'));

    expect(screen.getAllByTestId('dock-pane-right')).toHaveLength(1);
    expect(screen.queryByText('contents of inspector')).not.toBeInTheDocument();
    // The panel itself stays open, and the column's choice is remembered.
    expect(getDockState(getAppState()).open.right).toBe(true);
    expect(getAppState().dockLayout.right.groups[1].activeTab).toBe('inspector');
  });

  it('renders nothing for a side that has no tabs', () => {
    renderWithStore(<Docks />, PAST_WELCOME);
    act(() => {
      for (const id of ['waypoints', 'annotations', 'plugins']) {
        getAppState().movePanelTab(id, { side: 'right', group: 0 });
      }
    });

    expect(screen.queryByTestId('dock-rail-left')).not.toBeInTheDocument();
    expect(screen.getByTestId('dock-rail-right')).toBeInTheDocument();
  });

  it('keeps the other column when one throws while rendering', () => {
    const Boom = () => {
      throw new Error('boom');
    };
    const tabs = new Map<string, PanelTab>([
      ['layers', { id: 'layers', title: 'LAYERS', component: <div>layers ok</div> }],
      ['inspector', { id: 'inspector', title: 'INSPECTOR', component: <Boom /> }],
    ]);
    renderWithStore(<div />, PAST_WELCOME);
    getAppState().movePanelTab('inspector', { side: 'right', group: 1 });
    const dock = getDockState(getAppState());
    const quiet = console.error;
    console.error = () => {};
    try {
      renderWithStore(<DockSide side="right" dock={dock} tabs={tabs} onTabClick={() => {}} onWidthChange={() => {}} />);
    } finally {
      console.error = quiet;
    }

    expect(screen.getByText('layers ok')).toBeInTheDocument();
  });
});
