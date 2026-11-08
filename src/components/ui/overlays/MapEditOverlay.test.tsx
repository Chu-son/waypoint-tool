import { act, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MapEditOverlay } from './MapEditOverlay';
import { renderWithStore } from '../../../test/render';
import { getAppState, PAST_WELCOME } from '../../../test/store';
import { layerStackState, makeManualCustomLayer } from '../../../test/fixtures';

const shape = { id: 's', type: 'rect', cx: 0, cy: 0, width: 1, height: 1, angle: 0, fillValue: 10 } as const;

const renderOverlay = () =>
  renderWithStore(<MapEditOverlay />, {
    ...PAST_WELCOME,
    ...layerStackState(makeManualCustomLayer('wall', { editObjects: [shape] })),
    isMapEditMode: true,
    activeCustomLayerId: 'wall',
    selection: { type: 'layers', ids: ['wall'], selectedObjectId: 's' },
    selectedEditObjectId: 's',
  });

const shapes = () => {
  const [layer] = getAppState().customLayers;
  return layer.type === 'manual' ? layer.editObjects : [];
};

describe('MapEditOverlay', () => {
  it('undoes a whole drag of the fill value in one step', () => {
    renderOverlay();
    const slider = screen.getByRole('slider');

    fireEvent.pointerDown(slider, { button: 0 });
    fireEvent.change(slider, { target: { value: '100' } });
    fireEvent.change(slider, { target: { value: '200' } });
    fireEvent.pointerUp(window);
    expect(shapes()[0].fillValue).toBe(200);
    expect(getAppState().historyPast).toHaveLength(1);
    act(() => getAppState().undo());

    expect(shapes()[0].fillValue).toBe(10);
  });

  it('records nothing when the fill value is set to what it already is', () => {
    renderOverlay();
    fireEvent.click(screen.getByTitle('障害物 (黒: 0)'));
    expect(getAppState().historyPast).toHaveLength(1);

    fireEvent.click(screen.getByTitle('障害物 (黒: 0)'));

    expect(getAppState().historyPast).toHaveLength(1);
  });

  it('restores a deleted shape and its selection with one undo', () => {
    renderOverlay();

    fireEvent.click(screen.getByTitle('選択中のオブジェクトを削除 (Delete / Backspace)'));
    expect(shapes()).toEqual([]);
    expect(getAppState().selectedEditObjectId).toBeNull();
    expect(getAppState().historyPast).toHaveLength(1);
    act(() => getAppState().undo());

    expect(shapes()).toEqual([shape]);
    expect(getAppState().selectedEditObjectId).toBe('s');
  });
});
