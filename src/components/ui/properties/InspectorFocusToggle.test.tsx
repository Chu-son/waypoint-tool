import { act, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makeWaypoint, waypointTree } from '../../../test/fixtures';

const panel = { rightPanelActiveTab: 'layers', isRightPanelOpen: true } as const;

describe('switching to the Inspector on selection', () => {
  it('brings the Inspector forward when an item is selected', () => {
    renderWithStore(<PropertiesPanel />, { ...waypointTree([makeWaypoint('a')]), ...panel });

    act(() => getAppState().selectNodes(['a']));

    expect(getAppState().rightPanelActiveTab).toBe('inspector');
  });

  it('leaves the panel where it is once the toggle in the empty Inspector is turned off', () => {
    renderWithStore(<PropertiesPanel />, { ...waypointTree([makeWaypoint('a')]), ...panel });

    fireEvent.click(screen.getByRole('switch', { name: '選択時に Inspector へ切り替える' }));
    act(() => getAppState().selectNodes(['a']));

    expect(getAppState().autoFocusInspector).toBe(false);
    expect(getAppState().selectedNodeIds).toEqual(['a']);
    expect(getAppState().rightPanelActiveTab).toBe('layers');
  });

  it('applies to selecting layers and annotations too', () => {
    renderWithStore(<PropertiesPanel />, { autoFocusInspector: false, ...panel });

    act(() => getAppState().setSelection({ type: 'annotations', ids: ['x'] }));

    expect(getAppState().rightPanelActiveTab).toBe('layers');
  });

  it('shows the toggle only while nothing is selected', () => {
    renderWithStore(<PropertiesPanel />, waypointTool());

    expect(screen.getByRole('switch', { name: '選択時に Inspector へ切り替える' })).toBeChecked();

    act(() => getAppState().selectNodes(['a']));

    expect(screen.queryByRole('switch', { name: '選択時に Inspector へ切り替える' })).not.toBeInTheDocument();
  });
});

function waypointTool() {
  return waypointTree([makeWaypoint('a')]);
}
