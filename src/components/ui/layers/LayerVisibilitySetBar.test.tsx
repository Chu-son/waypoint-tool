import { act, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LayerVisibilitySetBar } from './LayerVisibilitySetBar';
import { DialogAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { layerStackState, makeManualCustomLayer, makeMap } from '../../../test/fixtures';

const stack = () => layerStackState(makeMap('map', { name: 'Base' }), makeManualCustomLayer('wall'));

const picker = () => screen.getByRole('combobox', { name: /layer visibility set/i });
const isVisible = (id: string) =>
  [...getAppState().mapLayers, ...getAppState().customLayers].find((l) => l.id === id)?.visible;

describe('LayerVisibilitySetBar', () => {
  it('shows nothing until there is a layer to show or hide', () => {
    renderWithStore(<LayerVisibilitySetBar />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('saves the current display under a name and selects it', async () => {
    const { user } = renderWithStore(<LayerVisibilitySetBar />, stack());
    act(() => getAppState().updateCustomLayer('wall', { visible: false }));

    await user.click(screen.getByRole('button', { name: /save display as new set/i }));
    await user.keyboard('Localization{Enter}');

    expect(picker()).toHaveDisplayValue('Localization');
    expect(getAppState().layerVisibilitySets[0].visibility).toEqual({ map: true, wall: false });
  });

  it('applies the set that is chosen in the list', async () => {
    const { user } = renderWithStore(<LayerVisibilitySetBar />, stack());
    act(() => {
      getAppState().updateCustomLayer('wall', { visible: false });
      getAppState().saveLayerVisibilitySet('Localization');
      getAppState().updateCustomLayer('wall', { visible: true });
      getAppState().saveLayerVisibilitySet('Navigation');
    });

    await user.selectOptions(picker(), 'Localization');

    expect(isVisible('wall')).toBe(false);

    await user.selectOptions(picker(), 'Navigation');

    expect(isVisible('wall')).toBe(true);
  });

  it('flags a set that does not cover a layer added later, until it is updated', async () => {
    const { user } = renderWithStore(<LayerVisibilitySetBar />, stack());
    act(() => getAppState().saveLayerVisibilitySet('Localization'));
    expect(screen.queryByText(/needs update/i)).not.toBeInTheDocument();

    act(() => getAppState().addMapLayer('New map', { resolution: 0.05 }, 'img', 10, 10));

    expect(screen.getByRole('option', { name: 'Localization (needs update)' })).toBeInTheDocument();
    expect(screen.getByText(/1 layer\(s\) not in this set/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(screen.getByRole('option', { name: 'Localization' })).toBeInTheDocument();
    expect(screen.queryByText(/not in this set/i)).not.toBeInTheDocument();
  });

  it('marks the set in use as modified once the display is changed by hand, and updating it clears that', async () => {
    const { user } = renderWithStore(<LayerVisibilitySetBar />, stack());
    act(() => getAppState().saveLayerVisibilitySet('Navigation'));

    act(() => getAppState().updateCustomLayer('wall', { visible: false }));

    expect(screen.getByRole('option', { name: 'Navigation (modified)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /update set with current display/i }));

    expect(screen.getByRole('option', { name: 'Navigation' })).toBeInTheDocument();
  });

  it('renames the selected set', async () => {
    const { user } = renderWithStore(<LayerVisibilitySetBar />, stack());
    act(() => getAppState().saveLayerVisibilitySet('Nav'));

    await user.click(screen.getByRole('button', { name: /rename set/i }));
    await user.keyboard('{Control>}a{/Control}Navigation{Enter}');

    expect(picker()).toHaveDisplayValue('Navigation');
  });

  it('deletes the selected set after confirmation', async () => {
    vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
    const { user } = renderWithStore(<LayerVisibilitySetBar />, stack());
    act(() => getAppState().saveLayerVisibilitySet('Navigation'));

    await user.click(screen.getByRole('button', { name: /delete set/i }));

    await waitFor(() => expect(getAppState().layerVisibilitySets).toEqual([]));
  });

  it('keeps the set when the deletion is declined', async () => {
    vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
    const { user } = renderWithStore(<LayerVisibilitySetBar />, stack());
    act(() => getAppState().saveLayerVisibilitySet('Navigation'));

    await user.click(screen.getByRole('button', { name: /delete set/i }));

    expect(getAppState().layerVisibilitySets).toHaveLength(1);
  });
});
