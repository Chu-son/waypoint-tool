import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginParamsPanel } from './PluginParamsPanel';
import { useAppStore } from '../../stores/appStore';
import { BackendAPI } from '../../api';

// Mock the store
vi.mock('../../stores/appStore', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
  }),
}));

// Mock the API
vi.mock('../../api', () => ({
  BackendAPI: {
    runPlugin: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'new-uuid',
}));

// Mock lucide-react to avoid icon rendering issues in tests
vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="play-icon" />,
  Settings2: () => <div data-testid="settings-icon" />,
  X: () => <div data-testid="close-icon" />,
  AlertCircle: () => <div data-testid="alert-icon" />,
  RefreshCcw: () => <div data-testid="refresh-icon" />,
}));

describe('PluginParamsPanel', () => {
  const mockPlugin = {
    id: 'test-plugin',
    manifest: {
      name: 'Test Generator',
      description: 'A test plugin',
      type: 'python',
      inputs: [
        { id: 'in-1', name: 'start', type: 'point', label: 'Start Point', required: true }
      ],
      properties: [
        { name: 'count', type: 'integer', default: 5, label: 'Count' }
      ]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      activeTool: 'add_generator',
      activePluginId: 'test-plugin',
      plugins: { 'test-plugin': mockPlugin },
      pluginSettings: [{ id: 'test-plugin', enabled: true }],
      pluginInteractionData: {},
      activeInputIndex: 0,
      nodes: {},
      selectedNodeIds: [],
      decimalPrecision: 2,
    }));

    (useAppStore.getState as any).mockReturnValue({
      addNode: vi.fn(),
      selectNodes: vi.fn(),
      setActiveTool: vi.fn(),
      setPluginActiveProperties: vi.fn(),
    });
  });

  it('renders nothing if activeTool is not add_generator', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      activeTool: 'select',
      activePluginId: 'test-plugin',
      plugins: { 'test-plugin': mockPlugin },
    }));
    const { container } = render(<PluginParamsPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders plugin name and inputs correctly', () => {
    render(<PluginParamsPanel />);
    expect(screen.getByText('Test Generator')).toBeInTheDocument();
    expect(screen.getByText('Start Point')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
  });

  it('disables generate button if script requires selection but none is present', () => {
    const pluginWithSelect = {
        ...mockPlugin,
        manifest: { ...mockPlugin.manifest, needs: ['selected_points'] }
    };
    (useAppStore as any).mockImplementation((selector: any) => selector({
      activeTool: 'add_generator',
      activePluginId: 'test-plugin',
      plugins: { 'test-plugin': pluginWithSelect },
      selectedNodeIds: [],
      pluginInteractionData: {},
      pluginSettings: [],
      activeInputIndex: 0,
    }));

    render(<PluginParamsPanel />);
    const executeBtn = screen.getByRole('button', { name: /generate path/i });
    expect(executeBtn).toBeDisabled();
  });

  it('calls BackendAPI.runPlugin and adds nodes on success', async () => {
    const mockAddNode = vi.fn();
    const mockSelectNodes = vi.fn();
    const mockSetActiveTool = vi.fn();

    (useAppStore.getState as any).mockReturnValue({
      addNode: mockAddNode,
      selectNodes: mockSelectNodes,
      setActiveTool: mockSetActiveTool,
      setPluginActiveProperties: vi.fn(),
    });

    (BackendAPI.runPlugin as any).mockResolvedValue([
      { x: 10, y: 20, yaw: 0 }
    ]);

    render(<PluginParamsPanel />);
    const executeBtn = screen.getByText('Generate Path');
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(BackendAPI.runPlugin).toHaveBeenCalled();
    });

    expect(mockAddNode).toHaveBeenCalled(); // Should be called for parent and children
    expect(mockSelectNodes).toHaveBeenCalledWith(['new-uuid']);
    expect(mockSetActiveTool).toHaveBeenCalledWith('select');
  });
});
