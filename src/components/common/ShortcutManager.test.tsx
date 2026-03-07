import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShortcutManager } from './ShortcutManager';
import { useAppStore } from '../../stores/appStore';

// Mock useAppStore
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('ShortcutManager', () => {
  const mockRemoveNodes = vi.fn();
  const mockSelectAllNodes = vi.fn();
  const mockSetExportModalOpen = vi.fn();
  const mockLoadProject = vi.fn();
  const mockSaveProject = vi.fn();
  const mockSetRightPanelActiveTab = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockReturnValue({
      selectedNodeIds: [],
      activeTool: 'select',
      removeNodes: mockRemoveNodes,
      selectAllNodes: mockSelectAllNodes,
      setExportModalOpen: mockSetExportModalOpen,
      loadProject: mockLoadProject,
      saveProject: mockSaveProject,
      setRightPanelActiveTab: mockSetRightPanelActiveTab,
    });
    // Add a setState mock to the function itself as ShortcutManager uses useAppStore.setState
    (useAppStore as any).setState = vi.fn();
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
    
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(mockSaveProject).toHaveBeenCalled();
  });

  it('triggers loadProject on Ctrl+O', () => {
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    expect(mockLoadProject).toHaveBeenCalled();
  });

  it('triggers setExportModalOpen on Ctrl+E', () => {
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
    expect(mockSetExportModalOpen).toHaveBeenCalledWith(true);
  });

  it('resets selection and tool on Escape', () => {
    (useAppStore as any).mockReturnValue({
      selectedNodeIds: ['node-1'],
      activeTool: 'add',
      setRightPanelActiveTab: mockSetRightPanelActiveTab,
    });
    render(<ShortcutManager />);
    
    fireEvent.keyDown(window, { key: 'Escape' });
    
    expect(useAppStore.setState).toHaveBeenCalled();
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
