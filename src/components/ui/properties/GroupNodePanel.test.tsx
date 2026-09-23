import { fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GroupNodePanel } from './GroupNodePanel';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makeGroup, makeWaypoint, waypointTree } from '../../../test/fixtures';

const group = makeGroup('grp-1', ['c1', 'c2'], { name: 'Test Group' });
const renderPanel = () =>
  renderWithStore(<GroupNodePanel node={group} />, waypointTree([group, makeWaypoint('c1'), makeWaypoint('c2')]));

describe('GroupNodePanel', () => {
  it('shows the group name, id and child summary', () => {
    renderPanel();
    expect(screen.getByText('Test Group')).toBeInTheDocument();
    expect(screen.getByText('grp-1')).toBeInTheDocument();
    expect(screen.getByText('合計')).toBeInTheDocument();
  });

  it('selects all children of the group', () => {
    renderPanel();
    fireEvent.click(screen.getByText('子要素をすべて選択'));
    expect(getAppState().selectedNodeIds).toEqual(['c1', 'c2']);
  });

  it('ungroups, moving the children up to the parent level', () => {
    renderPanel();
    fireEvent.click(screen.getByText('グループ解除 (Ungroup)'));
    expect(getAppState().nodes['grp-1']).toBeUndefined();
    expect(getAppState().rootNodeIds).toEqual(['c1', 'c2']);
  });

  it('renames the group inline', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Test Group'));
    const input = screen.getByDisplayValue('Test Group');
    fireEvent.change(input, { target: { value: 'Renamed Group' } });
    fireEvent.blur(input);
    expect(getAppState().nodes['grp-1'].name).toBe('Renamed Group');
  });
});
