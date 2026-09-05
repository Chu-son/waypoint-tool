import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore } from '../appStore';
import { BackendAPI, DialogAPI } from '../../api';

describe('projectSlice - currentProjectPath & save behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Reset store state
    useAppStore.getState().resetProject();
    useAppStore.setState({
      currentProjectPath: null,
      isDirty: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with currentProjectPath as null', () => {
    expect(useAppStore.getState().currentProjectPath).toBeNull();
  });

  it('updates currentProjectPath via setCurrentProjectPath', () => {
    useAppStore.getState().setCurrentProjectPath('/path/to/project.wptroj');
    expect(useAppStore.getState().currentProjectPath).toBe('/path/to/project.wptroj');
  });

  it('resets currentProjectPath to null on resetProject', () => {
    useAppStore.setState({ currentProjectPath: '/path/to/project.wptroj' });
    useAppStore.getState().resetProject();
    expect(useAppStore.getState().currentProjectPath).toBeNull();
  });

  it('sets currentProjectPath on loadProjectFromPath', async () => {
    vi.spyOn(BackendAPI, 'loadProject').mockResolvedValueOnce({
      nodes: {},
      root_node_ids: [],
    });

    const success = await useAppStore.getState().loadProjectFromPath('/test/dir/sample.wptroj');
    expect(success).toBe(true);
    expect(useAppStore.getState().currentProjectPath).toBe('/test/dir/sample.wptroj');
    expect(useAppStore.getState().isDirty).toBe(false);
  });

  describe('saveProjectAs', () => {
    it('opens file dialog and saves to selected path with .wptroj extension', async () => {
      const saveDialogSpy = vi.spyOn(DialogAPI, 'save').mockResolvedValueOnce('/saved/path/my_project');
      const saveBackendSpy = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValueOnce();

      useAppStore.setState({ isDirty: true });
      await useAppStore.getState().saveProjectAs();

      expect(saveDialogSpy).toHaveBeenCalled();
      expect(saveBackendSpy).toHaveBeenCalledWith('/saved/path/my_project.wptroj', expect.any(Object));
      expect(useAppStore.getState().currentProjectPath).toBe('/saved/path/my_project.wptroj');
      expect(useAppStore.getState().isDirty).toBe(false);
    });

    it('does nothing when save dialog is cancelled', async () => {
      const saveDialogSpy = vi.spyOn(DialogAPI, 'save').mockResolvedValueOnce(null);
      const saveBackendSpy = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValueOnce();

      useAppStore.setState({ isDirty: true });
      await useAppStore.getState().saveProjectAs();

      expect(saveDialogSpy).toHaveBeenCalled();
      expect(saveBackendSpy).not.toHaveBeenCalled();
      expect(useAppStore.getState().currentProjectPath).toBeNull();
      expect(useAppStore.getState().isDirty).toBe(true);
    });
  });

  describe('saveProject (overwrite)', () => {
    it('falls back to saveProjectAs when currentProjectPath is not set', async () => {
      const saveDialogSpy = vi.spyOn(DialogAPI, 'save').mockResolvedValueOnce('/first/save.wptroj');
      const askSpy = vi.spyOn(DialogAPI, 'ask');
      const saveBackendSpy = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValueOnce();

      expect(useAppStore.getState().currentProjectPath).toBeNull();

      await useAppStore.getState().saveProject();

      // Should not ask for overwrite confirmation because there is no existing file
      expect(askSpy).not.toHaveBeenCalled();
      // Should open save dialog
      expect(saveDialogSpy).toHaveBeenCalled();
      expect(saveBackendSpy).toHaveBeenCalledWith('/first/save.wptroj', expect.any(Object));
      expect(useAppStore.getState().currentProjectPath).toBe('/first/save.wptroj');
    });

    it('shows confirmation dialog and overwrites currentProjectPath without file dialog when confirmed', async () => {
      const existingPath = '/existing/project.wptroj';
      useAppStore.setState({ currentProjectPath: existingPath, isDirty: true });

      const saveDialogSpy = vi.spyOn(DialogAPI, 'save');
      const askSpy = vi.spyOn(DialogAPI, 'ask').mockResolvedValueOnce(true);
      const saveBackendSpy = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValueOnce();

      await useAppStore.getState().saveProject();

      // Should show overwrite confirmation dialog
      expect(askSpy).toHaveBeenCalledWith(
        expect.stringContaining(existingPath),
        expect.objectContaining({
          title: '上書き保存の確認',
        })
      );
      // Should NOT show file save dialog
      expect(saveDialogSpy).not.toHaveBeenCalled();
      // Should save directly to existingPath
      expect(saveBackendSpy).toHaveBeenCalledWith(existingPath, expect.any(Object));
      expect(useAppStore.getState().currentProjectPath).toBe(existingPath);
      expect(useAppStore.getState().isDirty).toBe(false);
    });

    it('aborts overwrite when confirmation dialog is cancelled', async () => {
      const existingPath = '/existing/project.wptroj';
      useAppStore.setState({ currentProjectPath: existingPath, isDirty: true });

      const saveDialogSpy = vi.spyOn(DialogAPI, 'save');
      const askSpy = vi.spyOn(DialogAPI, 'ask').mockResolvedValueOnce(false);
      const saveBackendSpy = vi.spyOn(BackendAPI, 'saveProject').mockResolvedValueOnce();

      await useAppStore.getState().saveProject();

      expect(askSpy).toHaveBeenCalled();
      expect(saveDialogSpy).not.toHaveBeenCalled();
      expect(saveBackendSpy).not.toHaveBeenCalled();
      expect(useAppStore.getState().currentProjectPath).toBe(existingPath);
      expect(useAppStore.getState().isDirty).toBe(true);
    });

    it('invokes abortCanvasGestures on resetProject and setProjectData', () => {
      const abortSpy = vi.fn().mockReturnValue(true);
      const unregister = useAppStore.getState().registerCanvasAbortHandler(abortSpy);

      useAppStore.getState().resetProject();
      expect(abortSpy).toHaveBeenCalledTimes(1);

      useAppStore.getState().setProjectData({
        root_node_ids: [],
        nodes: {},
        map_layers: [],
        custom_layers: [],
        annotation_objects: [],
        export_regions: [],
        options_schema: null,
        export_templates: [],
        default_export_formats: [],
      });
      expect(abortSpy).toHaveBeenCalledTimes(2);

      unregister();
    });
  });
});
