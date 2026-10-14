import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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

const site = (visible = true) =>
  layerStackState(
    makeLayerGroup('site', [makeMap('mapA', { info: { origin: [1, 2, 0] } })], { name: 'Site', visible }),
  );

const typeInto = (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

describe('LayerGroupInspector: moving the group', () => {
  it('moves what the group holds to the total typed, and shows the total moved so far', async () => {
    renderWithStore(<LayerGroupInspector id="site" />, site());

    typeInto('ΔX (m)', '3');
    typeInto('ΔY (m)', '-1');

    await waitFor(() => expect(originOf('mapA')).toEqual([4, 1, 0]));
    expect(screen.getByLabelText('ΔX (m)')).toHaveValue('3');
    expect(screen.getByLabelText('ΔY (m)')).toHaveValue('-1');

    // A typed value is the new total, not another step.
    typeInto('ΔX (m)', '5');
    await waitFor(() => expect(originOf('mapA')).toEqual([6, 1, 0]));
  });

  it('adds up the nudges in the numbers, and Reset puts everything back', async () => {
    renderWithStore(<LayerGroupInspector id="site" />, site());

    fireEvent.click(screen.getByRole('button', { name: /Move right/ }));
    await waitFor(() => expect(screen.getByLabelText('ΔX (m)')).toHaveValue('0.1'));
    fireEvent.click(screen.getByRole('button', { name: /Move right/ }));
    await waitFor(() => expect(screen.getByLabelText('ΔX (m)')).toHaveValue('0.2'));

    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));

    await waitFor(() => expect(originOf('mapA')[0]).toBeCloseTo(1));
    expect(screen.getByLabelText('ΔX (m)')).toHaveValue('0');
  });

  it('shows the turn in ΔYaw, and undo brings the numbers back with the layers', async () => {
    renderWithStore(<LayerGroupInspector id="site" />, site());

    fireEvent.click(screen.getByRole('button', { name: '+90°' }));
    await waitFor(() => expect(screen.getByLabelText('ΔYaw (°)')).toHaveValue('90'));

    act(() => getAppState().undo());

    expect(originOf('mapA')).toEqual([1, 2, 0]);
    expect(screen.getByLabelText('ΔYaw (°)')).toHaveValue('0');
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

    it('moves the other users of the map too when the user chooses so', async () => {
      const choose = vi.spyOn(DialogAPI, 'choose').mockResolvedValue('yes');
      renderWithStore(<LayerGroupInspector id="site" />, shared());

      typeInto('ΔX (m)', '2');

      await waitFor(() => expect(originOf('copy')).toEqual([2, 0, 0]));
      expect(choose).toHaveBeenCalledWith(expect.stringContaining('Copy'), expect.anything());
    });

    it('moves only the group’s map, unlinked, when the user chooses so', async () => {
      vi.spyOn(DialogAPI, 'choose').mockResolvedValue('no');
      renderWithStore(<LayerGroupInspector id="site" />, shared());

      typeInto('ΔX (m)', '2');

      await waitFor(() => expect(originOf('mapA')).toEqual([2, 0, 0]));
      expect(originOf('copy')).toEqual([0, 0, 0]);
    });

    it('moves nothing when the user cancels', async () => {
      const choose = vi.spyOn(DialogAPI, 'choose').mockResolvedValue('cancel');
      renderWithStore(<LayerGroupInspector id="site" />, shared());

      typeInto('ΔX (m)', '2');

      await waitFor(() => expect(choose).toHaveBeenCalledTimes(1));
      expect(originOf('mapA')).toEqual([0, 0, 0]);
      expect(originOf('copy')).toEqual([0, 0, 0]);
      expect(getAppState().historyPast).toHaveLength(0);
    });

    it('asks once for a burst of nudges, then remembers the answer', async () => {
      const choose = vi.spyOn(DialogAPI, 'choose').mockResolvedValue('yes');
      renderWithStore(<LayerGroupInspector id="site" />, shared());
      const right = screen.getByRole('button', { name: /Move right/ });

      fireEvent.click(right);
      fireEvent.click(right);
      fireEvent.click(right);
      await waitFor(() => expect(originOf('copy')[0]).toBeCloseTo(0.1));

      fireEvent.click(right);
      await waitFor(() => expect(originOf('copy')[0]).toBeCloseTo(0.2));
      expect(choose).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the group is hidden', () => {
    it('moves nothing when the user declines the warning', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
      renderWithStore(<LayerGroupInspector id="site" />, site(false));

      typeInto('ΔX (m)', '3');

      await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
      expect(ask.mock.calls[0][0]).toContain('Site');
      expect(originOf('mapA')).toEqual([1, 2, 0]);
    });

    it('moves after the user accepts, and does not ask again for the next move', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      renderWithStore(<LayerGroupInspector id="site" />, site(false));

      fireEvent.click(screen.getByRole('button', { name: /Move right/ }));
      await waitFor(() => expect(originOf('mapA')[0]).toBeCloseTo(1.1));
      fireEvent.click(screen.getByRole('button', { name: /Move right/ }));
      await waitFor(() => expect(originOf('mapA')[0]).toBeCloseTo(1.2));

      expect(ask).toHaveBeenCalledTimes(1);
    });

    it('does not ask for a shown group', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      renderWithStore(<LayerGroupInspector id="site" />, site());

      fireEvent.click(screen.getByRole('button', { name: /Move right/ }));

      await waitFor(() => expect(originOf('mapA')[0]).toBeCloseTo(1.1));
      expect(ask).not.toHaveBeenCalled();
    });
  });

  it('offers no adjustment for a group that holds nothing to move', () => {
    renderWithStore(<LayerGroupInspector id="site" />, layerStackState(makeLayerGroup('site', [])));

    expect(screen.queryByText('グループの位置調整')).not.toBeInTheDocument();
  });
});
