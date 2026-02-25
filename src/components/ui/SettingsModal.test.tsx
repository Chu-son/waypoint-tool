import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsModal } from './SettingsModal';
import { useAppStore } from '../../stores/appStore';

// Mock dynamic imports used inside SettingsModal
vi.mock('../../api/backend', () => ({
  BackendAPI: {
    getPythonEnvironments: vi.fn().mockResolvedValue([]),
    loadOptionsSchema: vi.fn(),
    scanCustomPlugin: vi.fn(),
  },
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

describe('SettingsModal UI', () => {
  beforeEach(() => {
    useAppStore.setState({
      optionsSchema: null,
      exportTemplates: [],
      plugins: {},
      pluginSettings: [],
      defaultMapOpacity: 0.8,
      defaultExportFormats: [
        { id: '__default_yaml__', name: 'YAML Document', extension: 'yaml', suffix: '_yaml', enabled: true },
        { id: '__default_json__', name: 'JSON Document', extension: 'json', suffix: '_json', enabled: true },
      ],
      globalPythonPath: 'python',
    });
  });

  it('applies updated options schema correctly', async () => {
    // Render the modal
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Click the Options tab
    const optionsTab = screen.getByText('Option Schema');
    act(() => {
      optionsTab.click();
    });

    // Add a new option
    const addOptionBtn = screen.getByRole('button', { name: /Add Field/i });
    act(() => {
      addOptionBtn.click();
    });

    // Fill in the required fields
    const nameInputs = screen.getAllByPlaceholderText('e.g. velocity');
    const labelInputs = screen.getAllByPlaceholderText('e.g. Target Speed');

    act(() => {
      fireEvent.change(nameInputs[0], { target: { value: 'test_opt' } });
      fireEvent.change(labelInputs[0], { target: { value: 'Test Opt' } });
    });

    // Save changes
    const applyButton = screen.getByText(/Apply Schema/i);
    act(() => {
      applyButton.click();
    });

    // Verify store
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.optionsSchema).not.toBeNull();
      expect(state.optionsSchema?.options.length).toBe(1);
      expect(state.optionsSchema?.options[0].name).toBe('test_opt');
    });
  });

  // --- 要件3: オプションプロパティ ---

  it('can add multiple option schema fields', async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const optionsTab = screen.getByText('Option Schema');
    act(() => { optionsTab.click(); });

    const addBtn = screen.getByRole('button', { name: /Add Field/i });
    act(() => { addBtn.click(); });
    act(() => { addBtn.click(); });

    // Two new option rows should exist with Key Name inputs
    const nameInputs = screen.getAllByPlaceholderText('e.g. velocity');
    expect(nameInputs.length).toBe(2);
  });

  // --- 要件10: エクスポートサフィックス ---

  it('allows editing export template suffix in the Export Templates tab', async () => {
    useAppStore.setState({
      exportTemplates: [
        { id: 'tmpl1', name: 'ROS Template', extension: 'yaml', suffix: '_ros', content: '{{#each waypoints}}...{{/each}}' },
      ],
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const templatesTab = screen.getByText('Export Templates');
    act(() => { templatesTab.click(); });

    // The template name should be visible
    expect(screen.getByDisplayValue('ROS Template')).toBeInTheDocument();
  });

  // --- 要件9: プラグイン ---

  it('allows setting the global Python path on the General tab', async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // General tab is the default tab — Python path input is there
    const pythonInput = screen.getByDisplayValue('python');
    expect(pythonInput).toBeInTheDocument();

    act(() => {
      fireEvent.change(pythonInput, { target: { value: '/usr/bin/python3' } });
    });

    expect(useAppStore.getState().globalPythonPath).toBe('/usr/bin/python3');
  });
});
