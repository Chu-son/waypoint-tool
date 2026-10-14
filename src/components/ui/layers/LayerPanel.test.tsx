import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LayerPanel } from './LayerPanel';
import { useInspectorPanelComponent } from '../shell/PanelRegistry';
import { BackendAPI, DialogAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState, getLayerOrder } from '../../../test/store';
import { layerStackState, makeLayerGroup, makeManualCustomLayer, makeMap } from '../../../test/fixtures';

/** The layer panel next to the inspector, as in the app. */
function PanelWithInspector() {
  return (
    <>
      <LayerPanel />
      <section aria-label="Inspector">{useInspectorPanelComponent()}</section>
    </>
  );
}

const tree = () => screen.getByRole('tree', { name: 'Layers' });
const row = (name: string) => within(tree()).getByRole('treeitem', { name });
const inspector = () => within(screen.getByRole('region', { name: 'Inspector' }));
const openMenu = (name: string) => fireEvent.contextMenu(within(row(name)).getByText(name));

const twoMaps = () =>
  layerStackState(makeMap('l1', { name: 'Map 1' }), makeMap('l2', { name: 'Map 2', visible: false, opacity: 0.5 }));

/** Map A, [Floor: Wall, Map B], Map C */
const withGroup = () =>
  layerStackState(
    makeMap('a', { name: 'Map A' }),
    makeLayerGroup('floor', [makeManualCustomLayer('wall', { name: 'Wall' }), makeMap('b', { name: 'Map B' })], {
      name: 'Floor',
    }),
    makeMap('c', { name: 'Map C' }),
  );

describe('LayerPanel', () => {
  it('shows an empty state when there are no layers', () => {
    renderWithStore(<LayerPanel />);
    expect(screen.getByText(/no maps or custom layers/i)).toBeInTheDocument();
  });

  it('lists maps and custom layers top of the stack first', () => {
    renderWithStore(
      <LayerPanel />,
      layerStackState(makeMap('a', { name: 'Top' }), makeManualCustomLayer('w', { name: 'Wall' })),
    );

    expect(
      within(tree())
        .getAllByRole('treeitem')
        .map((el) => el.getAttribute('aria-label')),
    ).toEqual(['Top', 'Wall']);
  });

  it('toggles map layer visibility', () => {
    renderWithStore(<LayerPanel />, twoMaps());

    fireEvent.click(screen.getByRole('button', { name: 'Map 1 を非表示にする' }));
    fireEvent.click(screen.getByRole('button', { name: 'Map 2 を表示する' }));

    expect(getAppState().mapLayers.map((l) => [l.id, l.visible])).toEqual([
      ['l1', false],
      ['l2', true],
    ]);
  });

  it('loads a ROS map chosen in the file dialog as a new layer', async () => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/path/to/test_map.yaml');
    const loadROSMap = vi.spyOn(BackendAPI, 'loadROSMap').mockResolvedValue({
      info: {
        image: 'test_map.pgm',
        resolution: 0.05,
        origin: [1, 2, 0],
        negate: 0,
        occupied_thresh: 0.65,
        free_thresh: 0.25,
      },
      image_data_b64: 'fake-base64',
      width: 100,
      height: 80,
    });
    renderWithStore(<LayerPanel />, { lastDirectory: '/test/dir' });

    fireEvent.click(screen.getByText('Load Map'));

    await waitFor(() => expect(getAppState().mapLayers).toHaveLength(1));
    expect(loadROSMap).toHaveBeenCalledWith('/path/to/test_map.yaml');
    expect(getAppState().mapLayers[0]).toMatchObject({ name: 'test_map.yaml', clip: null });
    expect(getAppState().mapSources[0]).toMatchObject({
      image_base64: 'fake-base64',
      width: 100,
      height: 80,
      info: { resolution: 0.05, origin: [1, 2, 0] },
    });
    expect(getAppState().lastDirectory).toBe('/path/to');
    expect(await screen.findByRole('treeitem', { name: 'test_map.yaml' })).toBeInTheDocument();
  });

  it('loads a map into the group that is selected', async () => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/maps/annex.yaml');
    vi.spyOn(BackendAPI, 'loadROSMap').mockResolvedValue({
      info: {
        image: 'annex.pgm',
        resolution: 0.05,
        origin: [0, 0, 0],
        negate: 0,
        occupied_thresh: 0.65,
        free_thresh: 0.25,
      },
      image_data_b64: 'img',
      width: 10,
      height: 10,
    });
    renderWithStore(<LayerPanel />, withGroup());
    fireEvent.click(within(row('Floor')).getByText('Floor'));

    fireEvent.click(screen.getByText('Load Map'));

    await waitFor(() => expect(getAppState().layerGroups.floor.children_ids).toHaveLength(3));
    expect(getAppState().mapLayers.find((l) => l.id === getAppState().layerGroups.floor.children_ids[0])?.name).toBe(
      'annex.yaml',
    );
  });

  describe('selecting', () => {
    it('shows the settings of the selected map in the inspector', () => {
      renderWithStore(<PanelWithInspector />, twoMaps());

      fireEvent.click(within(row('Map 1')).getByText('Map 1'));

      expect(row('Map 1')).toHaveAttribute('aria-selected', 'true');
      expect(inspector().getByText(/Relative Pose/)).toBeInTheDocument();
      expect(inspector().getByDisplayValue('Map 1')).toBeInTheDocument();
    });

    it('adds with Ctrl and extends with Shift, and offers grouping for several items', () => {
      renderWithStore(<PanelWithInspector />, withGroup());

      fireEvent.click(within(row('Map A')).getByText('Map A'));
      fireEvent.click(within(row('Map C')).getByText('Map C'), { ctrlKey: true });
      expect(getAppState().selection).toEqual({ type: 'layers', ids: ['a', 'c'], selectedObjectId: null });
      expect(inspector().getByText('2 項目を選択中')).toBeInTheDocument();

      // The range runs from the item clicked last (Map C).
      fireEvent.click(within(row('Floor')).getByText('Floor'), { shiftKey: true });
      expect(getAppState().selection).toMatchObject({ ids: ['floor', 'c'] });
    });

    it('shows the custom layer inspector for a hand-drawn layer', () => {
      renderWithStore(
        <PanelWithInspector />,
        layerStackState(makeManualCustomLayer('cl1', { name: 'Walls', opacity: 0.7 })),
      );

      fireEvent.click(within(row('Walls')).getByText('Walls'));

      expect(getAppState().activeCustomLayerId).toBe('cl1');
      expect(inspector().getByText('Layer Properties')).toBeInTheDocument();
    });
  });

  describe('reordering', () => {
    it('moves the selection among its siblings with Alt+↑/↓', () => {
      renderWithStore(<LayerPanel />, twoMaps());
      fireEvent.click(within(row('Map 1')).getByText('Map 1'));

      fireEvent.keyDown(tree(), { key: 'ArrowDown', altKey: true });
      expect(getLayerOrder()).toEqual(['l2', 'l1']);

      fireEvent.keyDown(tree(), { key: 'ArrowUp', altKey: true });
      expect(getLayerOrder()).toEqual(['l1', 'l2']);
    });

    it('stops at the end of a group instead of leaving it', () => {
      renderWithStore(<LayerPanel />, withGroup());
      fireEvent.click(screen.getByRole('button', { name: 'Floor を展開' }));
      fireEvent.click(within(row('Map B')).getByText('Map B'));

      fireEvent.keyDown(tree(), { key: 'ArrowDown', altKey: true });

      expect(getAppState().layerGroups.floor.children_ids).toEqual(['wall', 'b']);
    });

    it('takes a layer out of its group from the context menu, right above the group', () => {
      renderWithStore(<LayerPanel />, withGroup());
      fireEvent.click(screen.getByRole('button', { name: 'Floor を展開' }));

      openMenu('Map B');
      fireEvent.click(screen.getByText('グループから出す'));

      expect(getAppState().rootLayerIds).toEqual(['a', 'b', 'floor', 'c']);
    });
  });

  describe('groups', () => {
    it('shows the contents of a group only while it is expanded', () => {
      renderWithStore(<LayerPanel />, withGroup());
      expect(within(tree()).queryByRole('treeitem', { name: 'Wall' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Floor を展開' }));
      expect(row('Wall')).toHaveAttribute('aria-level', '2');

      fireEvent.click(screen.getByRole('button', { name: 'Floor を折りたたむ' }));
      expect(within(tree()).queryByRole('treeitem', { name: 'Wall' })).not.toBeInTheDocument();
    });

    it('hides a group without changing the flags of the layers inside', () => {
      renderWithStore(<LayerPanel />, withGroup());
      fireEvent.click(screen.getByRole('button', { name: 'Floor を展開' }));

      fireEvent.click(screen.getByRole('button', { name: 'Floor を非表示にする' }));

      expect(getAppState().layerGroups.floor.visible).toBe(false);
      expect(getAppState().mapLayers.find((l) => l.id === 'b')?.visible).toBe(true);
      // The layer inside keeps its own (on) eye and says why it is not drawn.
      expect(screen.getByRole('button', { name: 'Map B を非表示にする' })).toHaveAttribute(
        'title',
        '上のグループが非表示のため表示されていません',
      );
    });

    it('groups the selected layers from the context menu, and opens the group', () => {
      renderWithStore(<LayerPanel />, withGroup());
      fireEvent.click(within(row('Map A')).getByText('Map A'));
      fireEvent.click(within(row('Map C')).getByText('Map C'), { ctrlKey: true });

      openMenu('Map C');
      fireEvent.click(screen.getByText(/^グループ化 \(2\)/));

      const [groupId] = getAppState().rootLayerIds;
      expect(getAppState().layerGroups[groupId]).toMatchObject({ name: 'Group 1', children_ids: ['a', 'c'] });
      expect(getLayerOrder()).toEqual(['a', 'c', 'wall', 'b']);
      expect(getAppState().selection).toMatchObject({ ids: [groupId] });
    });

    it('ungroups from the context menu, keeping the layers in place', () => {
      renderWithStore(<LayerPanel />, withGroup());

      openMenu('Floor');
      fireEvent.click(screen.getByText(/^グループ解除/));

      expect(getAppState().rootLayerIds).toEqual(['a', 'wall', 'b', 'c']);
    });

    it('adds an empty group from the header button when nothing is selected', () => {
      renderWithStore(<LayerPanel />, twoMaps());

      fireEvent.click(screen.getByRole('button', { name: 'グループ' }));

      const [groupId] = getAppState().rootLayerIds;
      expect(getAppState().layerGroups[groupId]).toMatchObject({ children_ids: [] });
      expect(row('Group 1')).toBeInTheDocument();
    });

    it('deletes a group with its contents after warning that maps cannot be restored', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      renderWithStore(<LayerPanel />, withGroup());

      openMenu('Floor');
      fireEvent.click(screen.getByText(/グループごと削除/));

      await waitFor(() => expect(getLayerOrder()).toEqual(['a', 'c']));
      expect(ask.mock.calls[0][0]).toMatch(/マップ（1 枚）の削除は元に戻せません/);
    });
  });

  describe('removing and duplicating', () => {
    it('removes a map layer after the user confirms', async () => {
      vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      renderWithStore(<LayerPanel />, twoMaps());

      openMenu('Map 1');
      fireEvent.click(screen.getByText(/^削除/));

      await waitFor(() => expect(getAppState().mapLayers.map((l) => l.id)).toEqual(['l2']));
    });

    it('keeps the map layer when the user cancels removal', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
      renderWithStore(<LayerPanel />, twoMaps());

      openMenu('Map 1');
      fireEvent.click(screen.getByText(/^削除/));

      await waitFor(() => expect(ask).toHaveBeenCalled());
      expect(getAppState().mapLayers).toHaveLength(2);
    });

    it('adds another layer of the same map right above it, without copying the image', () => {
      renderWithStore(
        <LayerPanel />,
        layerStackState(makeMap('l1', { name: 'Map 1' }), makeMap('l2', { name: 'Map 2' })),
      );

      openMenu('Map 2');
      fireEvent.click(screen.getByText('複製（別の領域を使う）'));

      const layerOrder = getLayerOrder();
      expect(getAppState().mapLayers).toHaveLength(3);
      expect(getAppState().mapSources).toHaveLength(2);
      expect(layerOrder).toEqual(['l1', layerOrder[1], 'l2']);
      expect(row('Map 2 (copy)')).toBeInTheDocument();
      expect(within(row('Map 2 (copy)')).getByText('×2')).toBeInTheDocument();
    });

    it('duplicates a hand-drawn layer with its objects', () => {
      const rect = { id: 'r', type: 'rect', cx: 0, cy: 0, width: 1, height: 1, angle: 0, fillValue: 0 } as const;
      renderWithStore(
        <LayerPanel />,
        layerStackState(makeManualCustomLayer('w', { name: 'Wall', editObjects: [rect] })),
      );

      openMenu('Wall');
      fireEvent.click(screen.getByText(/^複製/));

      const copy = getAppState().customLayers.find((l) => l.name === 'Wall (copy)');
      expect(copy?.type === 'manual' && copy.editObjects).toHaveLength(1);
      expect(copy?.type === 'manual' && copy.editObjects[0].id).not.toBe('r');
      expect(getLayerOrder()).toEqual([copy?.id, 'w']);
    });

    it('keeps the map data while another copy still uses it, and drops it with the last copy', async () => {
      vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      renderWithStore(<LayerPanel />, layerStackState(makeMap('l1', { name: 'Map 1' })));
      openMenu('Map 1');
      fireEvent.click(screen.getByText('複製（別の領域を使う）'));

      openMenu('Map 1 (copy)');
      fireEvent.click(screen.getByText(/^削除/));
      await waitFor(() => expect(getAppState().mapLayers).toHaveLength(1));
      expect(getAppState().mapSources).toHaveLength(1);

      openMenu('Map 1');
      fireEvent.click(screen.getByText(/^削除/));
      await waitFor(() => expect(getAppState().mapLayers).toHaveLength(0));
      expect(getAppState().mapSources).toHaveLength(0);
    });
  });

  it('unlinks and re-links the pose of a copy from the context menu', () => {
    renderWithStore(<LayerPanel />, layerStackState(makeMap('l1', { name: 'Map 1' })));
    openMenu('Map 1');
    fireEvent.click(screen.getByText('複製（別の領域を使う）'));

    openMenu('Map 1 (copy)');
    fireEvent.click(screen.getByText('位置の共有を解除'));
    expect(within(row('Map 1 (copy)')).getByText('Own')).toBeInTheDocument();

    openMenu('Map 1 (copy)');
    fireEvent.click(screen.getByText('位置を再共有'));
    expect(within(row('Map 1 (copy)')).queryByText('Own')).not.toBeInTheDocument();
  });

  it('toggles whether a custom layer is a reference layer from the context menu', () => {
    renderWithStore(
      <LayerPanel />,
      layerStackState(
        makeManualCustomLayer('cl1', { name: 'Ref Layer', is_reference: true }),
        makeManualCustomLayer('cl2', { name: 'Normal Layer' }),
      ),
    );
    expect(within(row('Ref Layer')).getByText('Ref')).toBeInTheDocument();

    openMenu('Ref Layer');
    fireEvent.click(screen.getByText('参照レイヤー解除'));
    openMenu('Normal Layer');
    fireEvent.click(screen.getByText('参照レイヤーに設定'));

    const byId = Object.fromEntries(getAppState().customLayers.map((l) => [l.id, l]));
    expect(byId.cl1.is_reference).toBe(false);
    expect(byId.cl2.is_reference).toBe(true);
  });

  it('starts and stops vector editing of a hand-drawn layer from its row', () => {
    renderWithStore(<LayerPanel />, layerStackState(makeManualCustomLayer('w', { name: 'Wall' })));

    fireEvent.click(screen.getByRole('button', { name: 'Wall をベクター編集' }));
    expect(getAppState().appMode).toMatchObject({ mode: 'custom_layer_edit', targetLayerId: 'w' });

    fireEvent.click(screen.getByRole('button', { name: 'Wall のベクター編集を終了' }));
    expect(getAppState().appMode.mode).toBe('select');
  });

  it('reveals export region bounds only after opening its settings', () => {
    renderWithStore(<LayerPanel />, {
      exportRegions: [
        { id: 'r1', name: 'Export Zone', rect: { x: 1.5, y: 2.5, width: 10, height: 20 }, visible: true },
      ],
    });

    expect(screen.getByDisplayValue('Export Zone')).toBeInTheDocument();
    expect(screen.queryByText('Region Bounds')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Region Bounds Settings'));

    expect(screen.getByText('Region Bounds')).toBeInTheDocument();
  });

  describe('renaming', () => {
    const oneMap = () => renderWithStore(<LayerPanel />, layerStackState(makeMap('l1', { name: 'Map 1' })));
    const renameTo = (value: string, key = 'Enter') => {
      const input = within(tree()).getByDisplayValue('Map 1');
      fireEvent.change(input, { target: { value } });
      fireEvent.keyDown(input, { key });
    };

    it('renames by double-clicking the name and pressing Enter', () => {
      oneMap();

      fireEvent.doubleClick(within(row('Map 1')).getByText('Map 1'));
      renameTo('Warehouse 1F');

      expect(getAppState().mapLayers[0].name).toBe('Warehouse 1F');
      expect(row('Warehouse 1F')).toBeInTheDocument();
    });

    it('keeps the old name when renaming is cancelled with Escape or left empty', () => {
      oneMap();

      fireEvent.doubleClick(within(row('Map 1')).getByText('Map 1'));
      renameTo('Other', 'Escape');
      expect(getAppState().mapLayers[0].name).toBe('Map 1');

      fireEvent.doubleClick(within(row('Map 1')).getByText('Map 1'));
      renameTo('   ');
      expect(getAppState().mapLayers[0].name).toBe('Map 1');
    });

    it('renames with F2 and from the context menu', () => {
      oneMap();
      fireEvent.click(within(row('Map 1')).getByText('Map 1'));

      fireEvent.keyDown(tree(), { key: 'F2' });
      renameTo('Annex');
      expect(getAppState().mapLayers[0].name).toBe('Annex');

      openMenu('Annex');
      fireEvent.click(screen.getByText(/^名前を変更/));
      const input = within(tree()).getByDisplayValue('Annex');
      fireEvent.change(input, { target: { value: 'Annex 2' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(getAppState().mapLayers[0].name).toBe('Annex 2');
    });

    it('renames a group', () => {
      renderWithStore(<LayerPanel />, withGroup());

      fireEvent.doubleClick(within(row('Floor')).getByText('Floor'));
      const input = within(tree()).getByDisplayValue('Floor');
      fireEvent.change(input, { target: { value: '1F' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(getAppState().layerGroups.floor.name).toBe('1F');
    });
  });

  it('opens the group holding a layer that gets selected elsewhere', () => {
    renderWithStore(<LayerPanel />, withGroup());

    act(() => getAppState().setSelection({ type: 'layers', ids: ['b'], selectedObjectId: null }));

    expect(row('Map B')).toHaveAttribute('aria-selected', 'true');
  });
});
