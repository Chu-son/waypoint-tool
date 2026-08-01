import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolPanel } from './ToolPanel';
import { useAppStore } from '../../stores/appStore';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  MousePointer2: () => <div data-testid="select-icon" />,
  Hand: () => <div data-testid="hand-icon" />,
  Plus: () => <div data-testid="add-icon" />,
  Download: () => <div data-testid="download-icon" />,
  Upload: () => <div data-testid="upload-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  MoreHorizontal: () => <div data-testid="more-icon" />,
  Puzzle: () => <div data-testid="puzzle-icon" />,
  Sparkles: () => <div data-testid="sparkles-icon" />,
  Map: () => <div data-testid="map-icon" />,
  PenTool: () => <div data-testid="pentool-icon" />,
  Wand2: () => <div data-testid="wand-icon" />,
  Image: () => <div data-testid="image-icon" />,
  Crop: () => <div data-testid="crop-icon" />,
}));

// Mock Store
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

// Mock Child Components
vi.mock('./ExportModal', () => ({
  ExportModal: ({ isOpen }: any) => isOpen ? <div data-testid="export-modal" /> : null,
}));
vi.mock('./ImportModal', () => ({
  ImportModal: ({ isOpen }: any) => isOpen ? <div data-testid="import-modal" /> : null,
}));

describe('ToolPanel', () => {
  const mockSetActiveTool = vi.fn();
  const mockSetActivePlugin = vi.fn();
  const mockSetExportModalOpen = vi.fn();
  const mockSetImportModalOpen = vi.fn();
  const mockSetSettingsModalOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      activeTool: 'select',
      activePluginId: null,
      plugins: {},
      pluginSettings: [],
      isExportModalOpen: false,
      isImportModalOpen: false,
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
      setExportModalOpen: mockSetExportModalOpen,
      setImportModalOpen: mockSetImportModalOpen,
      setSettingsModalOpen: mockSetSettingsModalOpen,
    }));
  });

  it('renders basic tools and handles switching', () => {
    render(<ToolPanel />);
    const addBtn = screen.getByTitle(/add waypoint/i);
    fireEvent.click(addBtn);

    expect(mockSetActiveTool).toHaveBeenCalledWith('add_point');
    expect(mockSetActivePlugin).toHaveBeenCalledWith(null);
  });

  it('opens export modal and settings modal', () => {
    render(<ToolPanel />);
    
    const exportBtn = screen.getByTitle(/export waypoints/i);
    fireEvent.click(exportBtn);
    expect(mockSetExportModalOpen).toHaveBeenCalledWith(true);

    const settingsBtn = screen.getByTitle(/settings/i);
    fireEvent.click(settingsBtn);
    expect(mockSetSettingsModalOpen).toHaveBeenCalledWith(true, 'general');
  });
});
