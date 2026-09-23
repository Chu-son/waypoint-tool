import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { WaypointTree } from './WaypointTree';
import { renderWithStore } from '../../test/render';
import { getAppState } from '../../test/store';
import { makeGroup, makePlugin, makeWaypoint, waypointTree } from '../../test/fixtures';
import { setMemoryClipboardCache, writeMapElementsToClipboard } from '../../utils/mapElementClipboard';

const INSERTION_BAR_GRIP = 'ドラッグして挿入位置を移動';
const RESET_INSERTION = '末尾に戻す';

/** Visible tree rows (waypoints, groups and the insertion bar) in display order. */
const rows = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('ul > li'));
const isInsertionBar = (row: HTMLElement) => within(row).queryByTitle(INSERTION_BAR_GRIP) !== null;

const expand = (name = /expand/i) => fireEvent.click(screen.getAllByRole('button', { name })[0]);

describe('WaypointTree', () => {
  afterEach(() => setMemoryClipboardCache(null));

  it('shows an empty state with the insertion bar when there are no waypoints', () => {
    renderWithStore(<WaypointTree />);
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
    expect(screen.getByTitle(INSERTION_BAR_GRIP)).toBeInTheDocument();
  });

  it('numbers waypoints in traversal order, counting collapsed generator children', () => {
    renderWithStore(<WaypointTree />, {
      ...waypointTree([
        makeWaypoint('wp-1'),
        makeWaypoint('gen-1', { type: 'generator', name: undefined, plugin_id: 'p1', children_ids: ['c1', 'c2'] }),
        makeWaypoint('c1'),
        makeWaypoint('c2'),
        makeWaypoint('wp-2'),
      ]),
      plugins: { p1: makePlugin('p1', { name: 'Test Plugin' }) },
      indexStartIndex: 1,
    });

    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('Test Plugin')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // child count badge
    expect(screen.getByText('[4]')).toBeInTheDocument(); // 1 + wp-1 + 2 generated children
  });

  it('reveals generator children with their indices when expanded', () => {
    renderWithStore(<WaypointTree />, {
      ...waypointTree([
        makeWaypoint('gen-1', { type: 'generator', plugin_id: 'p1', children_ids: ['c1', 'c2'] }),
        makeWaypoint('c1'),
        makeWaypoint('c2'),
      ]),
      plugins: { p1: makePlugin('p1') },
    });

    expect(screen.queryByText('[0]')).not.toBeInTheDocument();
    expand();
    expect(screen.getByText('[0]')).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
  });

  it('groups the selected waypoints from the context menu', () => {
    renderWithStore(<WaypointTree />, {
      ...waypointTree([makeWaypoint('wp-1'), makeWaypoint('wp-2'), makeWaypoint('wp-3')]),
      selectedNodeIds: ['wp-1', 'wp-2'],
    });

    fireEvent.contextMenu(screen.getByText('[0]'));
    fireEvent.click(screen.getByText('選択項目をグループ化 (2)'));

    const { rootNodeIds, nodes } = getAppState();
    expect(rootNodeIds).toHaveLength(2);
    const group = nodes[rootNodeIds[0]];
    expect(group.type).toBe('manual_group');
    expect(group.children_ids).toEqual(['wp-1', 'wp-2']);
    expect(rootNodeIds[1]).toBe('wp-3');
  });

  it('resets the insertion point to the end from the insertion bar', () => {
    renderWithStore(<WaypointTree />, {
      ...waypointTree([makeWaypoint('wp-1'), makeWaypoint('wp-2'), makeWaypoint('wp-3')]),
      insertionTarget: { parentId: null, index: 1 },
    });

    fireEvent.click(screen.getByTitle(RESET_INSERTION));

    expect(getAppState().insertionTarget).toBeNull();
    expect(screen.queryByTitle(RESET_INSERTION)).not.toBeInTheDocument();
  });

  it('selects a contiguous range with Shift+click, skipping the insertion bar', () => {
    renderWithStore(<WaypointTree />, {
      ...waypointTree([makeWaypoint('wp-1'), makeWaypoint('wp-2'), makeWaypoint('wp-3')]),
      insertionTarget: { parentId: null, index: 1 },
    });

    fireEvent.click(screen.getByText('[0]'));
    fireEvent.click(screen.getByText('[2]'), { shiftKey: true });

    expect(getAppState().selectedNodeIds).toEqual(['wp-1', 'wp-2', 'wp-3']);
  });

  it('offers "insert at start of group" for manual groups but not for generators', () => {
    renderWithStore(<WaypointTree />, {
      ...waypointTree([
        makeWaypoint('gen-1', { type: 'generator', name: 'Generator 1', children_ids: ['c1'] }),
        makeWaypoint('c1'),
        makeGroup('grp-1', [], { name: 'Group 1' }),
      ]),
    });

    fireEvent.contextMenu(screen.getByText('Generator 1'));
    expect(screen.queryByText('グループ内の先頭に挿入を設定')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText('Group 1'));
    fireEvent.click(screen.getByText('グループ内の先頭に挿入を設定'));

    expect(getAppState().insertionTarget).toEqual({ parentId: 'grp-1', index: 0 });
  });

  it('places the insertion point after the generator when "insert after" is used on a generated child', () => {
    renderWithStore(<WaypointTree />, {
      ...waypointTree([makeWaypoint('gen-1', { type: 'generator', children_ids: ['c1'] }), makeWaypoint('c1')]),
    });

    expand();
    fireEvent.contextMenu(screen.getByText('[0]'));
    fireEvent.click(screen.getByText('この直後に挿入を設定'));

    expect(getAppState().insertionTarget).toEqual({ parentId: null, index: 1 });
  });

  describe('insertion bar placement', () => {
    const groupWithTwoChildren = (after: string) =>
      waypointTree([
        makeGroup('grp-1', ['c1', 'c2'], { name: 'Group 1' }),
        makeWaypoint('c1', { name: 'Child 1' }),
        makeWaypoint('c2', { name: 'Child 2' }),
        makeWaypoint('wp-end', { name: after }),
      ]);

    it('follows the last child of an expanded group when the target is after the group', () => {
      const { container } = renderWithStore(<WaypointTree />, {
        ...groupWithTwoChildren('Waypoint 3'),
        insertionTarget: { parentId: null, index: 1 },
      });

      let visible = rows(container);
      expect(visible).toHaveLength(3);
      expect(visible[0]).toHaveTextContent('Group 1');
      expect(isInsertionBar(visible[1])).toBe(true);
      expect(visible[2]).toHaveTextContent('Waypoint 3');

      expand();

      visible = rows(container);
      expect(visible.map((r) => (isInsertionBar(r) ? 'BAR' : r.textContent))).toEqual([
        expect.stringContaining('Group 1'),
        expect.stringContaining('Child 1'),
        expect.stringContaining('Child 2'),
        'BAR',
        expect.stringContaining('Waypoint 3'),
      ]);
      expect(within(visible[3]).getByTitle(INSERTION_BAR_GRIP).parentElement).toHaveStyle({ marginLeft: '0px' });
    });

    it('is indented inside an expanded group when the target is at the end of that group', () => {
      const { container } = renderWithStore(<WaypointTree />, {
        ...groupWithTwoChildren('End Waypoint'),
        insertionTarget: { parentId: 'grp-1', index: 2 },
      });

      let visible = rows(container);
      expect(visible).toHaveLength(3);
      expect(isInsertionBar(visible[1])).toBe(true); // attached below the collapsed group

      expand();

      visible = rows(container);
      expect(visible).toHaveLength(5);
      expect(visible[2]).toHaveTextContent('Child 2');
      expect(isInsertionBar(visible[3])).toBe(true);
      expect(within(visible[3]).getByTitle(INSERTION_BAR_GRIP).parentElement).toHaveStyle({ marginLeft: '16px' });
    });

    it('appears right after the group header when the target is index 0 inside the group', () => {
      const { container } = renderWithStore(<WaypointTree />, {
        ...waypointTree([
          makeGroup('grp-1', ['c1', 'c2'], { name: 'Group 1' }),
          makeWaypoint('c1', { name: 'Child 1' }),
          makeWaypoint('c2', { name: 'Child 2' }),
        ]),
        insertionTarget: { parentId: 'grp-1', index: 0 },
      });

      expand();

      const visible = rows(container);
      expect(visible).toHaveLength(4);
      expect(visible[0]).toHaveTextContent('Group 1');
      expect(isInsertionBar(visible[1])).toBe(true);
      expect(visible[2]).toHaveTextContent('Child 1');
    });

    it('follows the children of a nested expanded group', () => {
      const { container } = renderWithStore(<WaypointTree />, {
        ...waypointTree([
          makeGroup('grp-1', ['subgrp-1', 'wp-sibling'], { name: 'Group 1' }),
          makeGroup('subgrp-1', ['sub-c1'], { name: 'Sub Group' }),
          makeWaypoint('sub-c1', { name: 'Sub Child 1' }),
          makeWaypoint('wp-sibling', { name: 'WP Sibling' }),
        ]),
        insertionTarget: { parentId: 'grp-1', index: 1 },
      });

      expand(); // Group 1
      expand(); // Sub Group (Group 1's toggle is now "Collapse")

      const visible = rows(container);
      expect(visible).toHaveLength(5);
      expect(visible[2]).toHaveTextContent('Sub Child 1');
      expect(isInsertionBar(visible[3])).toBe(true);
      expect(visible[4]).toHaveTextContent('WP Sibling');
    });

    it('attaches to the nearest visible ancestor when the target is inside collapsed nested groups', () => {
      const { container } = renderWithStore(<WaypointTree />, {
        ...waypointTree([
          makeGroup('top-grp', ['sub-grp'], { name: 'Top Group' }),
          makeGroup('sub-grp', ['sub-c1'], { name: 'Sub Group' }),
          makeWaypoint('sub-c1', { name: 'Sub Child 1' }),
          makeWaypoint('wp-end', { name: 'End Waypoint' }),
        ]),
        insertionTarget: { parentId: 'sub-grp', index: 1 },
      });

      const visible = rows(container);
      expect(visible).toHaveLength(3);
      expect(visible[0]).toHaveTextContent('Top Group');
      expect(isInsertionBar(visible[1])).toBe(true);
      expect(visible[2]).toHaveTextContent('End Waypoint');
    });

    it('moves the insertion point out of a group when that group is collapsed', () => {
      renderWithStore(<WaypointTree />, {
        ...waypointTree([makeGroup('grp-1', ['c1'], { name: 'Group 1' }), makeWaypoint('c1'), makeWaypoint('wp-end')]),
        insertionTarget: { parentId: 'grp-1', index: 1 },
      });

      expand();
      fireEvent.click(screen.getByRole('button', { name: /collapse/i }));

      expect(getAppState().insertionTarget).toEqual({ parentId: null, index: 1 });
    });
  });

  it('marks a collapsed group that contains the selected waypoint', () => {
    renderWithStore(<WaypointTree />, {
      ...waypointTree([makeGroup('grp-1', ['wp-child'], { name: 'My Group' }), makeWaypoint('wp-child')]),
      selectedNodeIds: ['wp-child'],
    });

    expect(screen.getByTitle('選択中の子要素を含んでいます')).toBeInTheDocument();
  });

  it('pastes copied waypoints from the blank-area context menu', async () => {
    const { container } = renderWithStore(<WaypointTree />);
    await writeMapElementsToClipboard({
      elementType: 'waypoint',
      topLevelIds: ['clip-1'],
      nodes: { 'clip-1': makeWaypoint('clip-1', { name: 'Copied' }) },
    });

    fireEvent.contextMenu(container.firstChild as HTMLElement, { clientX: 100, clientY: 200 });
    expect(screen.getByText('グループで貼り付け')).toBeInTheDocument();
    fireEvent.click(screen.getByText('貼り付け (Paste)'));

    await waitFor(() => expect(getAppState().rootNodeIds).toHaveLength(1));
    const pasted = getAppState().nodes[getAppState().rootNodeIds[0]];
    expect(pasted.name).toBe('Copied');
    expect(pasted.type).toBe('manual');
  });
});
