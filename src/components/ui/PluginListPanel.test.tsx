import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginListPanel } from './PluginListPanel';
import { useAppStore } from '../../stores/appStore';

// Mock the store
vi.mock('../../stores/appStore', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
  }),
}));

// Mock lucide icons
vi.mock('lucide-react', () => ({
  Puzzle: () => <div data-testid="puzzle-icon" />,
  Search: () => <div data-testid="search-icon" />,
  ExternalLink: () => <div data-testid="link-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  Workflow: () => <div data-testid="workflow-icon" />,
}));

describe('PluginListPanel', () => {
  const mockPlugins = {
    'plugin-1': {
      id: 'plugin-1',
      manifest: { name: 'Line Sweep', description: 'Draws lines', category: 'path' }
    },
    'plugin-2': {
      id: 'plugin-2',
      manifest: { name: 'Rectangle Sweep', description: 'Draws area', category: 'area' }
    }
  };

  const mockSettings = [
    { id: 'plugin-1', enabled: true },
    { id: 'plugin-2', enabled: true }
  ];

  const mockSetActiveTool = vi.fn();
  const mockSetActivePlugin = vi.fn();
  const mockSetSettingsModalOpen = vi.fn();
  const mockSelectNodes = vi.fn();
  const mockSetRightPanelActiveTab = vi.fn();
  const mockSetRightPanelOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => selector({
      plugins: mockPlugins,
      pluginSettings: mockSettings,
      activePluginId: null,
      activeTool: 'select',
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
      setSettingsModalOpen: mockSetSettingsModalOpen,
      selectNodes: mockSelectNodes,
      setRightPanelActiveTab: mockSetRightPanelActiveTab,
      setRightPanelOpen: mockSetRightPanelOpen,
    }));

    (useAppStore.getState as any).mockReturnValue({
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
      setSettingsModalOpen: mockSetSettingsModalOpen,
      selectNodes: mockSelectNodes,
      setRightPanelActiveTab: mockSetRightPanelActiveTab,
      setRightPanelOpen: mockSetRightPanelOpen,
    });
  });

  it('renders all enabled plugins', () => {
    render(<PluginListPanel />);
    expect(screen.getByText('Line Sweep')).toBeInTheDocument();
    expect(screen.getByText('Rectangle Sweep')).toBeInTheDocument();
  });

  it('switches tool and selects plugin on click', () => {
    render(<PluginListPanel />);
    const pluginTitle = screen.getByText('Line Sweep');
    fireEvent.click(pluginTitle);

    expect(mockSetActivePlugin).toHaveBeenCalledWith('plugin-1');
    expect(mockSetActiveTool).toHaveBeenCalledWith('add_generator');
  });

  it('navigates to settings modal on icon click', () => {
    render(<PluginListPanel />);
    const settingsBtn = screen.getByTitle('Open Settings');
    fireEvent.click(settingsBtn);

    expect(mockSetSettingsModalOpen).toHaveBeenCalledWith(true, 'plugins');
  });

  it('renders safely without throwing when pluginSettings is malformed (e.g. object or null)', () => {
    useAppStore.setState({
      pluginSettings: { corrupted: true } as any,
    });
    expect(() => render(<PluginListPanel />)).not.toThrow();
  });

  it('filters pipelines and renders pipeline badge and dependency issue warning', () => {
    const pipelinePlugins = {
      'p-1': {
        id: 'p-1',
        manifest: { name: 'Step 1 Plugin', version: '1.0.0', type: 'python', category: 'path' }
      },
      'pipeline-test': {
        id: 'pipeline-test',
        manifest: {
          name: 'My Pipeline',
          type: 'pipeline',
          pipeline: {
            steps: [
              { step_id: 'step1', plugin_id: 'p-1' },
              { step_id: 'step2', plugin_id: 'missing-plugin' }
            ]
          }
        }
      }
    };
    const settings = [
      { id: 'p-1', enabled: true },
      { id: 'pipeline-test', enabled: true }
    ];

    (useAppStore as any).mockImplementation((selector: any) => selector({
      plugins: pipelinePlugins,
      pluginSettings: settings,
      activePluginId: null,
      activeTool: 'select',
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
      setSettingsModalOpen: mockSetSettingsModalOpen,
      selectNodes: mockSelectNodes,
      setRightPanelActiveTab: mockSetRightPanelActiveTab,
      setRightPanelOpen: mockSetRightPanelOpen,
    }));

    render(<PluginListPanel />);

    // Click Pipelines tab
    const pipelineTab = screen.getByRole('button', { name: 'Pipelines' });
    expect(pipelineTab.querySelector('[data-testid="workflow-icon"]')).toBeInTheDocument();
    fireEvent.click(pipelineTab);

    expect(screen.getByText('My Pipeline')).toBeInTheDocument();
    expect(screen.queryByText('Step 1 Plugin')).not.toBeInTheDocument();
    expect(screen.getByText('pipeline')).toBeInTheDocument();
    // Because 'missing-plugin' is missing, dependency issue indicator is displayed
    expect(screen.getByText('Issue')).toBeInTheDocument();
  });
});
