import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { BackendAPI } from '../../api';
import { renderWithStore } from '../../test/render';
import { getAppState } from '../../test/store';
import { makeGroup, makePlugin, makeTransform, makeWaypoint, waypointTree } from '../../test/fixtures';

describe('PropertiesPanel', () => {
  it('shows an empty state when nothing is selected', () => {
    renderWithStore(<PropertiesPanel />);
    expect(screen.getByText(/no item selected/i)).toBeInTheDocument();
  });

  it('edits the X coordinate of the selected waypoint', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1', { transform: makeTransform(1, 2) })]),
      selectedNodeIds: ['node-1'],
      visibleAttributes: ['index', 'transform'],
    });

    expect(screen.getByText(/Waypoint \[0\]/i)).toBeInTheDocument();

    const xInput = screen.getByDisplayValue('1');
    await user.clear(xInput);
    await user.type(xInput, '15');
    await user.tab();

    expect(getAppState().nodes['node-1'].transform?.x).toBe(15);
    expect(getAppState().nodes['node-1'].transform?.y).toBe(2);
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();
  });

  it('replaces the generated children when a generator is re-generated', async () => {
    const plugin = makePlugin('plugin-1', {
      name: 'Test Generator',
      properties: [{ name: 'count', type: 'float', label: 'Count' }],
    });
    const runPlugin = vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue([{ x: 10, y: 10, yaw: 0 }]);

    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([
        makeWaypoint('gen-1', {
          type: 'generator',
          plugin_id: 'plugin-1',
          transform: undefined,
          generator_params: { properties: { count: 5 } },
          children_ids: ['child-1'],
        }),
        makeWaypoint('child-1', { transform: makeTransform(0, 0) }),
      ]),
      plugins: { 'plugin-1': plugin },
      selectedNodeIds: ['gen-1'],
    });

    expect(screen.getByText('Generator Node')).toBeInTheDocument();
    expect(screen.getByText('Test Generator')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /re-generate path/i }));

    await waitFor(() => expect(getAppState().nodes['child-1']).toBeUndefined());
    expect(runPlugin).toHaveBeenCalledTimes(1);

    const { nodes } = getAppState();
    const newChildren = nodes['gen-1'].children_ids ?? [];
    expect(newChildren).toHaveLength(1);
    expect(nodes[newChildren[0]].transform).toMatchObject({ x: 10, y: 10 });
    expect(nodes['gen-1'].generator_params?.properties).toEqual({ count: 5 });
  });

  it('edits a custom option defined by the options schema', async () => {
    renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1')]),
      selectedNodeIds: ['node-1'],
      optionsSchema: { options: [{ name: 'speed', label: 'Target Speed', type: 'float', default: 0.5 }] },
      visibleAttributes: [],
    });

    expect(screen.getByText('Target Speed')).toBeInTheDocument();

    // The field ignores non-numeric intermediate values (an emptied field snaps back), so set the
    // final value directly rather than simulating clear-then-type.
    fireEvent.change(screen.getByDisplayValue('0.5'), { target: { value: '1.2' } });

    expect(getAppState().nodes['node-1'].options?.speed).toBe(1.2);
  });

  it('shows a summary when several waypoints are selected', () => {
    renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1'), makeWaypoint('node-2')]),
      selectedNodeIds: ['node-1', 'node-2'],
    });
    expect(screen.getByText(/multiple selected \(2\)/i)).toBeInTheDocument();
  });

  it('shows the transform relative to the previous waypoint in traversal order, across groups', () => {
    renderWithStore(<PropertiesPanel />, {
      ...waypointTree([
        makeWaypoint('wp-1', { transform: makeTransform(0, 0) }),
        makeGroup('grp-1', ['wp-2']),
        makeWaypoint('wp-2', { transform: makeTransform(5, 0) }),
      ]),
      selectedNodeIds: ['wp-2'],
      visibleAttributes: ['transform'],
    });

    expect(screen.getByText('Waypoint [1]')).toBeInTheDocument();
    expect(screen.getByText('Transform (Relative to Prev)')).toBeInTheDocument();
  });
});
