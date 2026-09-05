import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShortcutManager } from './ShortcutManager';
import { useAppStore } from '../../stores/appStore';
import { DialogAPI } from '../../api';

// Mock useAppStore and DialogAPI
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../api', () => ({
  DialogAPI: {
    ask: vi.fn().mockResolvedValue(true),
  },
}));

describe('ShortcutManager', () => {
  const mockRemoveNodes = vi.fn();
  const mockSelectAllNodes = vi.fn();
  const mockSelectNodes = vi.fn();
  const mockSetExportModalOpen = vi.fn();
  const mockLoadProject = vi.fn();
  const mockSaveProject = vi.fn();
  const mockSaveProjectAs = vi.fn();
  const mockResetProject = vi.fn();
  const mockSetRightPanelActiveTab = vi.fn();
  const mockSetActiveTool = vi.fn();
  const mockSetActivePlugin = vi.fn();
  const mockClearPluginInteractionData = vi.fn();
  const mockSetAnnotationEditMode = vi.fn();
  const mockSetMapEditMode = vi.fn();
  const mockSetShowOccupancyHighlight = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).getState = vi.fn().mockReturnValue({ isDirty: false });
    (useAppStore as any).mockReturnValue({
      selectedNodeIds: [],
      activeTool: 'select',
      removeNodes: mockRemoveNodes,
      selectAllNodes: mockSelectAllNodes,
      selectNodes: mockSelectNodes,
      setExportModalOpen: mockSetExportModalOpen,
      loadProject: mockLoadProject,
      saveProject: mockSaveProject,
      saveProjectAs: mockSaveProjectAs,
      resetProject: mockResetProject,
      setRightPanelActiveTab: mockSetRightPanelActiveTab,
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
      clearPluginInteractionData: mockClearPluginInteractionData,
      setAnnotationEditMode: mockSetAnnotationEditMode,
      setMapEditMode: mockSetMapEditMode,
      setShowOccupancyHighlight: mockSetShowOccupancyHighlight,
      showOccupancyHighlight: false,
    });
  });

  it('triggers removeNodes on Delete key when nodes are selected', () => {
    (useAppStore as any).mockReturnValue({
      selectedNodeIds: ['node-1'],
      removeNodes: mockRemoveNodes,
    });
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(mockRemoveNodes).toHaveBeenCalledWith(['node-1']);
  });

  it('triggers selectAllNodes on Ctrl+A', () => {
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(mockSelectAllNodes).toHaveBeenCalled();
  });

  it('triggers saveProject on Ctrl+S', () => {
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 's', ctrlKey: true, shiftKey: false });
    expect(mockSaveProject).toHaveBeenCalled();
    expect(mockSaveProjectAs).not.toHaveBeenCalled();
  });

  it('triggers saveProjectAs on Ctrl+Shift+S', () => {
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 's', ctrlKey: true, shiftKey: true });
    expect(mockSaveProjectAs).toHaveBeenCalled();
    expect(mockSaveProject).not.toHaveBeenCalled();
  });

  it('triggers loadProject on Ctrl+O', async () => {
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    await waitFor(() => {
      expect(mockLoadProject).toHaveBeenCalled();
    });
  });

  it('triggers resetProject on Ctrl+N', async () => {
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    await waitFor(() => {
      expect(mockResetProject).toHaveBeenCalled();
    });
  });

  it('blocks resetProject on Ctrl+N when dirty and user cancels', async () => {
    (useAppStore as any).getState = vi.fn().mockReturnValue({ isDirty: true });
    (DialogAPI.ask as any).mockResolvedValueOnce(false);
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    await waitFor(() => {
      expect(DialogAPI.ask).toHaveBeenCalled();
    });
    expect(mockResetProject).not.toHaveBeenCalled();
  });

  it('blocks loadProject on Ctrl+O when dirty and user cancels', async () => {
    (useAppStore as any).getState = vi.fn().mockReturnValue({ isDirty: true });
    (DialogAPI.ask as any).mockResolvedValueOnce(false);
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    await waitFor(() => {
      expect(DialogAPI.ask).toHaveBeenCalled();
    });
    expect(mockLoadProject).not.toHaveBeenCalled();
  });

  it('switches tool via V and P shortcuts', () => {
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'v' });
    expect(mockSetActiveTool).toHaveBeenCalledWith('select');

    fireEvent.keyDown(window, { key: 'p' });
    expect(mockSetActiveTool).toHaveBeenCalledWith('add_point');
  });

  it('triggers setExportModalOpen on Ctrl+E', () => {
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
    expect(mockSetExportModalOpen).toHaveBeenCalledWith(true);
  });

  it('triggers handleGlobalEscape on Escape key', () => {
    const mockHandleGlobalEscape = vi.fn().mockReturnValue(true);
    (useAppStore as any).mockReturnValue({
      handleGlobalEscape: mockHandleGlobalEscape,
    });
    render(<ShortcutManager />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockHandleGlobalEscape).toHaveBeenCalledTimes(1);
  });

  it('resets selection and tool on Escape when handleGlobalEscape is absent (fallback)', () => {
    (useAppStore as any).mockReturnValue({
      selectedNodeIds: ['node-1'],
      activeTool: 'add',
      selectNodes: mockSelectNodes,
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
      clearPluginInteractionData: mockClearPluginInteractionData,
      setAnnotationEditMode: mockSetAnnotationEditMode,
      setMapEditMode: mockSetMapEditMode,
      setRightPanelActiveTab: mockSetRightPanelActiveTab,
    });
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'Escape' });
    
    expect(mockSelectNodes).toHaveBeenCalledWith([]);
    expect(mockSetActiveTool).toHaveBeenCalledWith('select');
    expect(mockSetActivePlugin).toHaveBeenCalledWith(null);
    expect(mockClearPluginInteractionData).toHaveBeenCalled();
    expect(mockSetAnnotationEditMode).toHaveBeenCalledWith(false);
    expect(mockSetMapEditMode).toHaveBeenCalledWith(false);
    expect(mockSetRightPanelActiveTab).toHaveBeenCalledWith('layers');
  });

  it('ignores shortcuts when focused on INPUT', () => {
    render(<ShortcutManager />);
    
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(window, { key: 'Delete' });
    expect(mockRemoveNodes).not.toHaveBeenCalled();
    
    document.body.removeChild(input);
  });
});
