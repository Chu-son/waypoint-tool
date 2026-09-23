import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopMenu } from './TopMenu';
import { AppAPI, BackendAPI, DialogAPI } from '../../api';
import { renderWithStore } from '../../test/render';
import { getAppState, PAST_WELCOME } from '../../test/store';
import { makePointAnnotation, makeWaypoint, waypointTree } from '../../test/fixtures';
import type { AppState } from '../../stores/appStore';

const renderMenu = (state: Partial<AppState> = {}) => renderWithStore(<TopMenu />, { ...PAST_WELCOME, ...state });

const openMenu = (name: 'File' | 'Edit' | 'View' | 'Help') => fireEvent.click(screen.getByRole('button', { name }));

describe('TopMenu', () => {
  it('shows the application name and the main menus', () => {
    renderMenu();
    expect(screen.getByText('Waypoint Tool')).toBeInTheDocument();
    for (const menu of ['File', 'Edit', 'View', 'Help']) {
      expect(screen.getByText(menu)).toBeInTheDocument();
    }
  });

  describe('File menu', () => {
    it('Open Project shows the project file picker', async () => {
      const open = vi.spyOn(DialogAPI, 'open').mockResolvedValue(null);
      renderMenu();

      openMenu('File');
      fireEvent.click(screen.getByText(/open project/i));

      await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    });

    it('Save Project overwrites the current file after confirmation', async () => {
      vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      const save = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValue();
      renderMenu({ currentProjectPath: '/work/site.wptroj' });

      openMenu('File');
      fireEvent.click(screen.getByText(/^Save Project$/i));

      await waitFor(() => expect(save).toHaveBeenCalledWith('/work/site.wptroj', expect.anything()));
    });

    it('Save Project As asks for a new location', async () => {
      vi.spyOn(DialogAPI, 'save').mockResolvedValue('/work/copy');
      const save = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValue();
      renderMenu({ currentProjectPath: '/work/site.wptroj' });

      openMenu('File');
      fireEvent.click(screen.getByText(/Save Project As\.\.\./i));

      await waitFor(() => expect(save).toHaveBeenCalledWith('/work/copy.wptroj', expect.anything()));
    });

    it('Exit does not quit when the user keeps unsaved changes', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
      const forceExit = vi.spyOn(AppAPI, 'forceExit');
      renderMenu({ isDirty: true });

      openMenu('File');
      fireEvent.click(screen.getByText('Exit'));

      await waitFor(() => expect(ask).toHaveBeenCalled());
      expect(forceExit).not.toHaveBeenCalled();
      expect(getAppState().isDirty).toBe(true);
    });

    it('Exit quits after the user agrees to discard unsaved changes', async () => {
      vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      const forceExit = vi.spyOn(AppAPI, 'forceExit').mockResolvedValue();
      renderMenu({ isDirty: true });

      openMenu('File');
      fireEvent.click(screen.getByText('Exit'));

      await waitFor(() => expect(forceExit).toHaveBeenCalledTimes(1));
    });
  });

  it('View menu toggles path display', () => {
    renderMenu({ showPaths: true });

    openMenu('View');
    fireEvent.click(screen.getByText(/Show Paths/i));

    expect(getAppState().showPaths).toBe(false);
  });

  describe('Edit menu', () => {
    const threeWaypoints = () => waypointTree([makeWaypoint('n1'), makeWaypoint('n2'), makeWaypoint('n3')]);

    it('Select All selects every waypoint', async () => {
      renderMenu(threeWaypoints());

      openMenu('Edit');
      fireEvent.click(await screen.findByText('Select All'));

      expect(getAppState().selectedNodeIds).toEqual(['n1', 'n2', 'n3']);
    });

    it('Deselect All clears the selection', async () => {
      renderMenu(threeWaypoints());
      act(() => getAppState().selectNodes(['n1']));

      openMenu('Edit');
      fireEvent.click(await screen.findByText('Deselect All'));

      expect(getAppState().selectedNodeIds).toEqual([]);
      expect(getAppState().selection).toEqual({ type: 'none' });
    });

    it('Delete Selected removes the selected waypoints', async () => {
      renderMenu(threeWaypoints());
      act(() => getAppState().selectNodes(['n1']));

      openMenu('Edit');
      fireEvent.click(await screen.findByText('Delete Selected'));

      expect(getAppState().rootNodeIds).toEqual(['n2', 'n3']);
    });

    it('Delete Selected removes the selected annotations', async () => {
      renderMenu({
        annotationObjects: { 'annot-1': makePointAnnotation('annot-1'), 'annot-2': makePointAnnotation('annot-2') },
        rootAnnotationIds: ['annot-1', 'annot-2'],
        annotationOrder: ['annot-1', 'annot-2'],
      });
      act(() => getAppState().setSelection({ type: 'annotations', ids: ['annot-1'] }));

      openMenu('Edit');
      fireEvent.click(await screen.findByText('Delete Selected'));

      expect(getAppState().annotationObjects['annot-1']).toBeUndefined();
      expect(getAppState().annotationObjects['annot-2']).toBeDefined();
    });
  });

  it('switches to another menu on hover while one is open', () => {
    renderMenu();

    fireEvent.click(screen.getByText('File'));
    expect(screen.getByText(/^Open Project...$/i)).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByText('Edit'));
    expect(screen.queryByText(/^Open Project...$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Select All$/i)).toBeInTheDocument();
  });

  describe('project title', () => {
    it('shows "Untitled" for a new project without an unsaved marker', () => {
      renderMenu();
      expect(screen.getByText('Untitled')).toBeInTheDocument();
      expect(screen.queryByTestId('dirty-indicator')).not.toBeInTheDocument();
    });

    it('shows the project file name', () => {
      renderMenu({ currentProjectPath: '/path/to/my_route_project.wptroj' });
      expect(screen.getByText('my_route_project')).toBeInTheDocument();
      expect(screen.queryByTestId('dirty-indicator')).not.toBeInTheDocument();
    });

    it('marks unsaved changes', () => {
      renderMenu({ currentProjectPath: '/path/to/my_route_project.wptroj', isDirty: true });
      expect(screen.getByTestId('dirty-indicator')).toBeInTheDocument();
    });
  });
});
