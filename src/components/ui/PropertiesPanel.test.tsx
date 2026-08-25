import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { useAppStore } from '../../stores/appStore';
import { BackendAPI } from '../../api';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Eye: () => <div data-testid="eye-icon" />,
  EyeOff: () => <div data-testid="eye-off-icon" />,
  Play: () => <div data-testid="play-icon" />,
  Settings2: () => <div data-testid="settings-icon" />,
  RefreshCcw: () => <div data-testid="refresh-icon" />,
  BoxSelect: () => <div data-testid="box-select-icon" />,
  Code2: () => <div data-testid="code2-icon" />,
  Maximize2: () => <div data-testid="maximize2-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
  Check: () => <div data-testid="check-icon" />,
}));

// Mock Store
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

// Mock API
vi.mock('../../api', () => ({
  BackendAPI: {
    runPlugin: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'new-uuid',
}));

describe('PropertiesPanel', () => {
  const mockUpdateNode = vi.fn();
  const mockRemoveNodes = vi.fn();
  const mockToggleAttributeVisibility = vi.fn();
  const mockAddNode = vi.fn();

  const mockManualNode = {
    id: 'node-1',
    type: 'manual',
    transform: { x: 1.0, y: 2.0, z: 0.0, qx: 0, qy: 0, qz: 0, qw: 1 },
    options: { 'custom-attr': 'val' }
  };

  const mockGeneratorNode = {
    id: 'gen-1',
    type: 'generator',
    plugin_id: 'plugin-1',
    generator_params: {
      properties: { count: 5 },
      interaction_data: { start: { x: 0, y: 0 } }
    },
    children_ids: ['child-1']
  };

  const mockPlugin = {
    id: 'plugin-1',
    manifest: {
      name: 'Test Generator',
      properties: [{ name: 'count', type: 'float', label: 'Count' }],
      inputs: [{ name: 'start', type: 'point', label: 'Start Point' }]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      selectedNodeIds: [],
      nodes: {},
      rootNodeIds: [],
      optionsSchema: null,
      visibleAttributes: ['index', 'transform'],
      indexStartIndex: 0,
      decimalPrecision: 2,
      plugins: {},
      pluginSettings: [],
      updateNode: mockUpdateNode,
      removeNodes: mockRemoveNodes,
      toggleAttributeVisibility: mockToggleAttributeVisibility,
      updatePluginInteractionData: vi.fn(),
      pluginInteractionData: {},
    }));
    
    // Mock getState for non-hook access (used inside handleRegenerate and status sync)
    (useAppStore.getState as any) = vi.fn().mockReturnValue({
        clearPluginInteractionData: vi.fn(),
        setPluginActiveProperties: vi.fn(),
        addNode: mockAddNode,
        nodes: { 'gen-1': mockGeneratorNode },
        runInHistoryTransaction: (fn: () => void) => fn(),
        beginHistoryTransaction: vi.fn(),
        endHistoryTransaction: vi.fn(),
        executeGeneratorPlugin: vi.fn().mockImplementation(async (params) => {
          await BackendAPI.runPlugin(params.plugin, { properties: params.properties, interaction_data: params.interactionData }, 'python3');
          mockRemoveNodes(['child-1']);
          mockAddNode();
          mockUpdateNode('gen-1', { generator_params: { properties: { count: 5 } } });
          return { success: true, executionId: 'exec-1', parentWaypointId: 'gen-1', customLayerIds: [] };
        }),
    });
  });

  it('renders "No item selected" when selection is empty', () => {
    render(<PropertiesPanel />);
    expect(screen.getByText(/no item selected/i)).toBeInTheDocument();
  });

  it('renders properties for a single manual node and updates X', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      selectedNodeIds: ['node-1'],
      nodes: { 'node-1': mockManualNode },
      rootNodeIds: ['node-1'],
      visibleAttributes: ['index', 'transform'],
      indexStartIndex: 0,
      decimalPrecision: 2,
      updateNode: mockUpdateNode,
      toggleAttributeVisibility: mockToggleAttributeVisibility,
    }));

    render(<PropertiesPanel />);
    expect(screen.getByText(/Waypoint \[0\]/i)).toBeInTheDocument();
    
    const xInput = screen.getByDisplayValue('1');
    fireEvent.change(xInput, { target: { value: '15' } });
    fireEvent.blur(xInput);

    expect(mockUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({
      transform: expect.objectContaining({ x: 15 })
    }));
  });

  it('renders generator node and handles re-generation flow', async () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      selectedNodeIds: ['gen-1'],
      nodes: { 'gen-1': mockGeneratorNode },
      rootNodeIds: ['gen-1'],
      plugins: { 'plugin-1': mockPlugin },
      pluginSettings: [],
      visibleAttributes: [],
      decimalPrecision: 2,
      updateNode: mockUpdateNode,
      removeNodes: mockRemoveNodes,
      updatePluginInteractionData: vi.fn(),
      pluginInteractionData: { start: { x: 0, y: 0 } },
      runWithLoading: async (_: any, fn: any) => await fn(),
    }));

    (BackendAPI.runPlugin as any).mockResolvedValue([{ x: 10, y: 10, yaw: 0 }]);

    render(<PropertiesPanel />);
    expect(screen.getByText('Generator Node')).toBeInTheDocument();
    expect(screen.getByText('Test Generator')).toBeInTheDocument();

    const regenBtn = screen.getByText(/re-generate path/i);
    fireEvent.click(regenBtn);

    await waitFor(() => {
      expect(BackendAPI.runPlugin).toHaveBeenCalled();
    });

    expect(mockRemoveNodes).toHaveBeenCalledWith(['child-1']);
    expect(mockAddNode).toHaveBeenCalled();
    expect(mockUpdateNode).toHaveBeenCalledWith('gen-1', expect.objectContaining({
        generator_params: expect.objectContaining({
            properties: { count: 5 }
        })
    }));
  });

  it('renders options from schema for manual node', () => {
      const schema = {
          options: [{ name: 'speed', label: 'Target Speed', type: 'float', default: 0.5 }]
      };
      (useAppStore as any).mockImplementation((selector: any) => selector({
        selectedNodeIds: ['node-1'],
        nodes: { 'node-1': mockManualNode },
        rootNodeIds: ['node-1'],
        optionsSchema: schema,
        visibleAttributes: [],
        indexStartIndex: 0,
        decimalPrecision: 2,
        updateNode: mockUpdateNode,
        toggleAttributeVisibility: vi.fn(),
      }));

      (useAppStore.getState as any).mockReturnValue({
        nodes: { 'node-1': mockManualNode },
        toggleAttributeVisibility: vi.fn(),
        clearPluginInteractionData: vi.fn(),
        setPluginActiveProperties: vi.fn(),
        runInHistoryTransaction: (fn: () => void) => fn(),
        beginHistoryTransaction: vi.fn(),
        endHistoryTransaction: vi.fn(),
      });

      render(<PropertiesPanel />);
      expect(screen.getByText('Target Speed')).toBeInTheDocument();
      
      const speedInput = screen.getByDisplayValue('0.5');
      fireEvent.change(speedInput, { target: { value: '1.2' } });
      // updateNode is called on change for custom options
      expect(mockUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({
          options: expect.objectContaining({ speed: 1.2 })
      }));
  });

  it('renders multiple selection view', () => {
    (useAppStore as any).mockImplementation((selector: any) => selector({
      selectedNodeIds: ['node-1', 'node-2'],
      nodes: { 
        'node-1': mockManualNode,
        'node-2': { ...mockManualNode, id: 'node-2' }
      },
      rootNodeIds: ['node-1', 'node-2'],
      visibleAttributes: [],
      indexStartIndex: 0,
      decimalPrecision: 2,
    }));

    render(<PropertiesPanel />);
    expect(screen.getByText(/multiple selected \(2\)/i)).toBeInTheDocument();
  });
});
