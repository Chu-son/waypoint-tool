import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LayerGroupInspector } from './LayerGroupInspector';
import { DialogAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { layerStackState, makeLayerGroup, makeManualCustomLayer, makeMap } from '../../../test/fixtures';

const originOf = (id: string) => {
  const layer = getAppState().mapLayers.find((l) => l.id === id)!;
  return layer.origin_override ?? getAppState().mapSources.find((s) => s.id === layer.sourceId)!.info.origin;
};

const site = () =>
  layerStackState(makeLayerGroup('site', [makeMap('mapA', { info: { origin: [1, 2, 0] } })], { name: 'Site' }));

describe('LayerGroupInspector: moving the group', () => {
  it('moves what the group holds by the numbers entered, and clears them afterwards', async () => {
    renderWithStore(<LayerGroupInspector id="site" />, site());

    fireEvent.change(screen.getByLabelText('ΔX (m)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('ΔY (m)'), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: '適用' }));

    await waitFor(() => expect(originOf('mapA')).toEqual([4, 1, 0]));
    expect(screen.getByRole('button', { name: '適用' })).toBeDisabled();
  });

  it('turns the group a quarter turn around its centre', async () => {
    renderWithStore(
      <LayerGroupInspector id="site" />,
      layerStackState(
        makeLayerGroup('site', [
          makeManualCustomLayer('wall', {
            editObjects: [{ id: 'c', type: 'circle', fillValue: 0, cx: 4, cy: 0, radius: 1 }],
          }),
        ]),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: '+90°' }));

    await waitFor(() => expect(getAppState().historyPast).toHaveLength(1));
    // The centre of the circle is the centre of the group, so it stays in place.
    expect(getAppState().customLayers[0]).toMatchObject({ editObjects: [{ cx: 4, cy: 0 }] });
  });

  it('moves with the nudge pad, and one undo puts it back', async () => {
    renderWithStore(<LayerGroupInspector id="site" />, site());

    fireEvent.click(screen.getByRole('button', { name: /Move right/ }));

    await waitFor(() => expect(originOf('mapA')[0]).toBeCloseTo(1.1));
    getAppState().undo();
    expect(originOf('mapA')).toEqual([1, 2, 0]);
  });

  describe('when a map is shared with a layer outside', () => {
    const shared = () => {
      const map = makeMap('mapA', { info: { origin: [0, 0, 0] } });
      return layerStackState(makeLayerGroup('site', [map]), {
        source: map.source,
        layer: { ...map.layer, id: 'copy', name: 'Copy' },
      });
    };
    const moveRight = async () => {
      fireEvent.change(screen.getByLabelText('ΔX (m)'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: '適用' }));
    };

    it('moves the other users of the map too when the user agrees', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      renderWithStore(<LayerGroupInspector id="site" />, shared());

      await moveRight();

      await waitFor(() => expect(originOf('copy')).toEqual([2, 0, 0]));
      expect(ask).toHaveBeenCalledWith(expect.stringContaining('Copy'), expect.anything());
    });

    it('moves only the group’s map, unlinked, when the user declines', async () => {
      vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
      renderWithStore(<LayerGroupInspector id="site" />, shared());

      await moveRight();

      await waitFor(() => expect(originOf('mapA')).toEqual([2, 0, 0]));
      expect(originOf('copy')).toEqual([0, 0, 0]);
    });
  });

  it('offers no adjustment for a group that holds nothing to move', () => {
    renderWithStore(<LayerGroupInspector id="site" />, layerStackState(makeLayerGroup('site', [])));

    expect(screen.queryByText('グループの位置調整')).not.toBeInTheDocument();
  });
});
