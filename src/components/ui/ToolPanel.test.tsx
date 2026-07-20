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

describe('ToolPanel', () => {
  const mockSetActiveTool = vi.fn();
  const mockSetActivePlugin = vi.fn();
  const mockSetExportModalOpen = vi.fn();
  const mockSetSettingsModalOpen = vi.fn();

  const mockPlugins = {
    'p1': { id: 'p1', manifest: { name: 'Plugin 1', icon: 'Sparkles' } },
    'p2': { id: 'p2', manifest: { name: 'Plugin 2', icon: 'Wand2' } },
    'p-overflow': { id: 'p-overflow', manifest: { name: 'Plugin Overflow', icon: 'Puzzle' } },
  };

  const mockPluginSettings = [
    { id: 'p1', enabled: true, order: 0 },
    { id: 'p2', enabled: true, order: 1 },
    { id: 'p-overflow', enabled: true, order: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      activeTool: 'select',
      activePluginId: null,
      plugins: {},
      pluginSettings: [],
      toolPanelMaxColumns: 1,
      isExportModalOpen: false,
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
      setExportModalOpen: mockSetExportModalOpen,
      setSettingsModalOpen: mockSetSettingsModalOpen,
    }));
    
    // Default window height for 2 rows of plugins (maxRows will be around 2-3)
    // window.innerHeight - 300 / 48
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 500 });
  });

  it('renders basic tools and handles switching', () => {
    render(<ToolPanel />);
    const addBtn = screen.getByTitle(/add waypoint/i);
    fireEvent.click(addBtn);

    expect(mockSetActiveTool).toHaveBeenCalledWith('add_point');
    expect(mockSetActivePlugin).toHaveBeenCalledWith(null);
  });

  it('renders enabled plugins in the grid', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      activeTool: 'select',
      plugins: mockPlugins,
      pluginSettings: mockPluginSettings,
      toolPanelMaxColumns: 1,
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
    }));

    render(<ToolPanel />);
    expect(screen.getByTitle('Plugin 1')).toBeInTheDocument();
    expect(screen.getByTitle('Plugin 2')).toBeInTheDocument();
  });

  it('handles plugin switching', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      activeTool: 'select',
      plugins: mockPlugins,
      pluginSettings: mockPluginSettings,
      toolPanelMaxColumns: 1,
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
    }));

    render(<ToolPanel />);
    const p1Btn = screen.getByTitle('Plugin 1');
    fireEvent.click(p1Btn);

    expect(mockSetActiveTool).toHaveBeenCalledWith('add_generator');
    expect(mockSetActivePlugin).toHaveBeenCalledWith('p1');
  });

  it('handles overflow plugins in more menu', () => {
    // Force small height to trigger overflow
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 350 });
    // available = 350 - 300 = 50. rows = 50/48 = 1.
    
    (useAppStore as any).mockImplementation((selector: any) => selector({
      activeTool: 'select',
      plugins: mockPlugins,
      pluginSettings: mockPluginSettings,
      toolPanelMaxColumns: 1,
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
    }));

    render(<ToolPanel />);
    
    // Plugin 1 is visible, Plugin 2 and overflow are in More menu
    expect(screen.getByTitle('Plugin 1')).toBeInTheDocument();
    expect(screen.queryByTitle('Plugin 2')).not.toBeInTheDocument();

    const moreBtn = screen.getByTitle(/more plugins/i);
    fireEvent.click(moreBtn);

    expect(screen.getByText('Plugin 2')).toBeInTheDocument();
    expect(screen.getByText('Plugin Overflow')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Plugin 2'));
    expect(mockSetActivePlugin).toHaveBeenCalledWith('p2');
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
