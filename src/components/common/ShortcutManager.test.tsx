import { act, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShortcutManager } from './ShortcutManager';
import { BackendAPI, DialogAPI } from '../../api';
import { renderWithStore } from '../../test/render';
import { getAppState, PAST_WELCOME } from '../../test/store';
import { makeWaypoint, waypointTree } from '../../test/fixtures';
import type { AppState } from '../../stores/appStore';

const press = (key: string, modifiers: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(window, { key, ...modifiers });

const twoWaypoints = () => waypointTree([makeWaypoint('node-1'), makeWaypoint('node-2')]);

const renderShortcuts = (state: Partial<AppState> = {}) =>
  renderWithStore(<ShortcutManager />, { ...PAST_WELCOME, ...state });

describe('ShortcutManager', () => {
  it('Delete removes the selected waypoints', () => {
    renderShortcuts({ ...twoWaypoints(), selectedNodeIds: ['node-1'] });

    press('Delete');

    expect(getAppState().rootNodeIds).toEqual(['node-2']);
    expect(getAppState().nodes['node-1']).toBeUndefined();
  });

  it('Ctrl+A selects every waypoint', () => {
    renderShortcuts(twoWaypoints());

    press('a', { ctrlKey: true });

    expect(getAppState().selectedNodeIds).toEqual(['node-1', 'node-2']);
  });

  it('Ctrl+S overwrites the current project file after confirmation', async () => {
    vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
    const save = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValue();
    renderShortcuts({ currentProjectPath: '/work/site.wptroj' });

    press('s', { ctrlKey: true });

    await waitFor(() => expect(save).toHaveBeenCalledWith('/work/site.wptroj', expect.anything()));
  });

  it('Ctrl+Shift+S asks for a new location even when the project has a path', async () => {
    const saveDialog = vi.spyOn(DialogAPI, 'save').mockResolvedValue('/work/copy');
    const save = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValue();
    renderShortcuts({ currentProjectPath: '/work/site.wptroj' });

    press('s', { ctrlKey: true, shiftKey: true });

    await waitFor(() => expect(save).toHaveBeenCalledWith('/work/copy.wptroj', expect.anything()));
    expect(saveDialog).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+O opens the project file picker', async () => {
    const open = vi.spyOn(DialogAPI, 'open').mockResolvedValue(null);
    renderShortcuts();

    press('o', { ctrlKey: true });

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
  });

  it('Ctrl+N starts a new project', async () => {
    renderShortcuts(twoWaypoints());

    press('n', { ctrlKey: true });

    await waitFor(() => expect(getAppState().rootNodeIds).toEqual([]));
  });

  describe('with unsaved changes', () => {
    it('Ctrl+N keeps the project when the user declines to discard changes', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
      renderShortcuts({ ...twoWaypoints(), isDirty: true });

      press('n', { ctrlKey: true });

      await waitFor(() => expect(ask).toHaveBeenCalled());
      expect(getAppState().rootNodeIds).toEqual(['node-1', 'node-2']);
    });

    it('Ctrl+O does not open a project when the user declines to discard changes', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
      const open = vi.spyOn(DialogAPI, 'open');
      renderShortcuts({ isDirty: true });

      press('o', { ctrlKey: true });

      await waitFor(() => expect(ask).toHaveBeenCalled());
      expect(open).not.toHaveBeenCalled();
    });
  });

  it('V and P switch between the select and add-waypoint tools', () => {
    renderShortcuts();

    press('p');
    expect(getAppState().activeTool).toBe('add_point');
    expect(getAppState().appMode.mode).toBe('waypoint_add');

    press('v');
    expect(getAppState().activeTool).toBe('select');
    expect(getAppState().appMode.mode).toBe('select');
  });

  it('Ctrl+E opens the export dialog', () => {
    renderShortcuts();

    press('e', { ctrlKey: true });

    expect(getAppState().isExportModalOpen).toBe(true);
  });

  it('Escape clears the current selection', () => {
    renderShortcuts(twoWaypoints());
    act(() => getAppState().selectNodes(['node-1']));

    press('Escape');

    expect(getAppState().selectedNodeIds).toEqual([]);
  });

  it('ignores shortcuts while typing in a text field', () => {
    renderShortcuts({ ...twoWaypoints(), selectedNodeIds: ['node-1'] });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    press('Delete');

    expect(getAppState().rootNodeIds).toEqual(['node-1', 'node-2']);
    input.remove();
  });

  it('ignores shortcuts other than Escape while a modal is open', () => {
    renderShortcuts({
      ...twoWaypoints(),
      selectedNodeIds: ['node-1'],
      modalStack: ['settings'],
      isSettingsModalOpen: true,
    });

    press('Delete');
    press('a', { ctrlKey: true });

    expect(getAppState().rootNodeIds).toEqual(['node-1', 'node-2']);
    expect(getAppState().selectedNodeIds).toEqual(['node-1']);
  });
});
