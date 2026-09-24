import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatusBar } from './StatusBar';
import { BackendAPI, DialogAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState, PAST_WELCOME } from '../../../test/store';
import { makeMapLayer, makeTransform, makeWaypoint, waypointTree } from '../../../test/fixtures';
import type { AppState } from '../../../stores/appStore';

const renderStatusBar = (state: Partial<AppState> = {}) =>
  renderWithStore(<StatusBar />, {
    ...PAST_WELCOME,
    ...waypointTree([
      makeWaypoint('wp-1', { name: 'wp_01', transform: makeTransform(0, 0) }),
      makeWaypoint('wp-2', { name: 'wp_02', transform: makeTransform(3, 4) }),
    ]),
    cursorPosition: { x: 1.234, y: 5.678 },
    mapScale: 1.5,
    mapLayers: [makeMapLayer('map-1')],
    enableSnapping: true,
    ...state,
  });

describe('StatusBar', () => {
  it('shows the tool, cursor position, zoom, resolution and snapping state', () => {
    renderStatusBar();
    expect(screen.getByText('選択ツール')).toBeInTheDocument();
    expect(screen.getByText(/1.234m/)).toBeInTheDocument();
    expect(screen.getByText('150%')).toBeInTheDocument();
    expect(screen.getByText('0.050m/px')).toBeInTheDocument();
    expect(screen.getByText('Snap')).toBeInTheDocument();
  });

  it('returns from waypoint-add mode to select mode via the Esc button', () => {
    renderStatusBar();
    act(() => getAppState().transitionToMode({ mode: 'waypoint_add' }));
    expect(screen.getByText('ウェイポイント追加')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle(/Escキーまたはクリックで 選択モードへ復帰/i));

    expect(getAppState().appMode.mode).toBe('select');
    expect(screen.getByText('選択ツール')).toBeInTheDocument();
  });

  it('shows the selected waypoint and clears the selection via the Esc button', () => {
    renderStatusBar();
    act(() => getAppState().selectNodes(['wp-1']));
    expect(screen.getByText(/ノード選択中 "wp_01"/)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle(/Escキーまたはクリックで 選択を解除/i));

    expect(getAppState().selectedNodeIds).toEqual([]);
  });

  it('toggles snapping', () => {
    renderStatusBar();
    fireEvent.click(screen.getByRole('button', { name: /snap/i }));
    expect(getAppState().enableSnapping).toBe(false);
  });

  it('requests a fit-to-maps from the Fit button', () => {
    renderStatusBar({ shouldFitToMaps: 0 });
    fireEvent.click(screen.getByRole('button', { name: /fit/i }));
    expect(getAppState().shouldFitToMaps).toBeGreaterThan(0);
  });

  it('saves the project from the unsaved-changes badge', async () => {
    vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
    const save = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValue();
    renderStatusBar({ isDirty: true, currentProjectPath: '/work/site.wptroj' });

    fireEvent.click(screen.getByRole('button', { name: /未保存/i }));

    await waitFor(() => expect(save).toHaveBeenCalledWith('/work/site.wptroj', expect.anything()));
  });
});
