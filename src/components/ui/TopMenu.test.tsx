import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopMenu } from './TopMenu';
import { useAppStore } from '../../stores/appStore';
import { DialogAPI } from '../../api';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  MousePointer2: () => <div data-testid="mouse-icon" />,
  Minus: () => <div data-testid="minus-icon" />,
  Square: () => <div data-testid="square-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

// Mock Store
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

// Mock API
vi.mock('../../api', () => ({
  DialogAPI: {
    ask: vi.fn(),
  },
}));

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/window
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setDecorations: vi.fn(),
  }),
}));

describe('TopMenu', () => {
  const mockLoadProject = vi.fn();
  const mockSaveProject = vi.fn();
  const mockSetExportModalOpen = vi.fn();
  const mockSetSettingsModalOpen = vi.fn();
  const mockSetShowPaths = vi.fn();
  const mockSetShowGrid = vi.fn();
  const mockSelectAllNodes = vi.fn();
  const mockRemoveNodes = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      selectedNodeIds: [],
      showPaths: true,
      showGrid: true,
      isDirty: false,
      isLeftPanelOpen: true,
      isRightPanelOpen: true,
      showProperties: true,
      loadProject: mockLoadProject,
      saveProject: mockSaveProject,
      setExportModalOpen: mockSetExportModalOpen,
      setSettingsModalOpen: mockSetSettingsModalOpen,
      setShortcutsModalOpen: vi.fn(),
      setShowPaths: mockSetShowPaths,
      setShowGrid: mockSetShowGrid,
      selectAllNodes: mockSelectAllNodes,
      removeNodes: mockRemoveNodes,
      setLeftPanelOpen: vi.fn(),
      setRightPanelOpen: vi.fn(),
      setShowProperties: vi.fn(),
      resetWindowLayout: vi.fn(),
      triggerFitToMaps: vi.fn(),
    }));

    // Mock getState for non-hook access (handleExit)
    (useAppStore.getState as any) = vi.fn().mockReturnValue({
        isDirty: false,
        setIsDirty: vi.fn(),
    });
  });

  it('renders application name and main menu categories', () => {
    render(<TopMenu />);
    expect(screen.getByText('Waypoint Tool')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('opens "File" menu and handles "Open Project"', () => {
    render(<TopMenu />);
    const fileBtn = screen.getByText('File');
    fireEvent.click(fileBtn);

    const openBtn = screen.getByText(/open project/i);
    expect(openBtn).toBeInTheDocument();
    fireEvent.click(openBtn);

    expect(mockLoadProject).toHaveBeenCalled();
  });

  it('handles dirty state exit confirmation', async () => {
    (useAppStore.getState as any).mockReturnValue({
        isDirty: true,
        setIsDirty: vi.fn(),
    });
    (DialogAPI.ask as any).mockResolvedValue(false); // User cancels exit

    render(<TopMenu />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Exit'));

    await waitFor(() => {
      expect(DialogAPI.ask).toHaveBeenCalled();
    });
    // invoke("force_exit") should NOT be called if canceled
  });

  it('toggles View options', () => {
    render(<TopMenu />);
    fireEvent.click(screen.getByText('View'));
    
    const pathsBtn = screen.getByText(/Show Paths/i);
    fireEvent.click(pathsBtn);
    expect(mockSetShowPaths).toHaveBeenCalled();
  });

  it('handles "Edit" menu actions', async () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
        selectedNodeIds: ['n1'],
        removeNodes: mockRemoveNodes,
        selectAllNodes: mockSelectAllNodes,
    }));

    render(<TopMenu />);
    
    // Select All
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeInTheDocument();
    }, { timeout: 2000 });
    fireEvent.click(screen.getByText('Select All'));
    expect(mockSelectAllNodes).toHaveBeenCalled();

    // Delete Selected - Menu might close after click, so open it again
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => {
      expect(screen.getByText('Delete Selected')).toBeInTheDocument();
    }, { timeout: 2000 });
    fireEvent.click(screen.getByText('Delete Selected'));
    expect(mockRemoveNodes).toHaveBeenCalledWith(['n1']);
  });

  it('switches menu on hover when one is open', () => {
    render(<TopMenu />);
    
    const fileBtn = screen.getByText('File');
    const editBtn = screen.getByText('Edit');

    fireEvent.click(fileBtn);
    expect(screen.getByText(/^Open Project...$/i)).toBeInTheDocument();

    fireEvent.mouseEnter(editBtn);
    expect(screen.queryByText(/^Open Project...$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Select All$/i)).toBeInTheDocument();
  });
});
