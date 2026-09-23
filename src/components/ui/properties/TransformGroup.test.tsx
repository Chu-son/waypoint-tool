import { act, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TransformGroup } from './TransformGroup';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makeTransform, makeWaypoint, waypointTree } from '../../../test/fixtures';
import { quaternionToYaw } from '../../../utils/transformUtils';
import type { WaypointNode } from '../../../types/store';

const updateNode = (id: string, updates: Partial<WaypointNode>) => getAppState().updateNode(id, updates);
const yawOf = (id: string) => quaternionToYaw(getAppState().nodes[id].transform);

function renderSingle() {
  const node = makeWaypoint('wp-1', { transform: makeTransform(10, 20, 0) });
  renderWithStore(<TransformGroup isMultiSelection={false} node={node} handleUpdate={updateNode} />, {
    ...waypointTree([node]),
    selectedNodeIds: ['wp-1'],
    visibleAttributes: ['transform'],
  });
}

describe('TransformGroup quick rotate', () => {
  it('exposes the rotate buttons with descriptive names', () => {
    renderSingle();

    expect(screen.getByRole('button', { name: 'Rotate 90° Left' })).toHaveAttribute('title', 'Rotate 90° Left (+90°)');
    expect(screen.getByRole('button', { name: 'Rotate 180°' })).toHaveAttribute(
      'title',
      'Rotate 180° (Mirror Reverse)',
    );
    expect(screen.getByRole('button', { name: 'Rotate 90° Right' })).toHaveAttribute(
      'title',
      'Rotate 90° Right (-90°)',
    );
  });

  it.each([
    ['Rotate 90° Left', Math.PI / 2],
    ['Rotate 90° Right', -Math.PI / 2],
  ])('%s turns the waypoint by the expected angle', (name, expectedYaw) => {
    renderSingle();

    fireEvent.click(screen.getByRole('button', { name }));

    expect(yawOf('wp-1')).toBeCloseTo(expectedYaw, 4);
    expect(getAppState().nodes['wp-1'].transform).toMatchObject({ x: 10, y: 20 });
  });

  it('Rotate 180° reverses the heading', () => {
    renderSingle();

    fireEvent.click(screen.getByRole('button', { name: 'Rotate 180°' }));

    expect(Math.abs(yawOf('wp-1'))).toBeCloseTo(Math.PI, 4);
  });

  it('rotates every selected waypoint as a single undoable step', () => {
    renderWithStore(<TransformGroup isMultiSelection={true} node={null} handleUpdate={updateNode} />, {
      ...waypointTree([
        makeWaypoint('wp-1', { transform: makeTransform(10, 20, 0) }),
        makeWaypoint('wp-2', { transform: makeTransform(5, 5, Math.PI / 2) }),
      ]),
      selectedNodeIds: ['wp-1', 'wp-2'],
      visibleAttributes: ['transform'],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Rotate 90° Left' }));

    expect(yawOf('wp-1')).toBeCloseTo(Math.PI / 2, 4);
    expect(Math.abs(yawOf('wp-2'))).toBeCloseTo(Math.PI, 4);

    act(() => getAppState().undo());

    expect(yawOf('wp-1')).toBeCloseTo(0, 4);
    expect(yawOf('wp-2')).toBeCloseTo(Math.PI / 2, 4);
  });
});
