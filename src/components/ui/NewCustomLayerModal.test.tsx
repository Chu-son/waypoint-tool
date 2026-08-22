import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewCustomLayerModal } from './NewCustomLayerModal';
import { useAppStore } from '../../stores/appStore';
import { PluginInstance } from '../../types/store';

describe('NewCustomLayerModal', () => {
  const mockPlugin: PluginInstance = {
    id: 'test-layer-plugin',
    folder_path: '/plugins/test-layer-plugin',
    is_builtin: true,
    manifest: {
      name: 'Costmap Inflator',
      category: 'map_layer_generator',
      type: 'python',
      executable: 'main.py',
      description: 'Inflates obstacles',
      properties: [],
      inputs: [],
    },
  };

  beforeEach(() => {
    useAppStore.setState({
      plugins: { 'test-layer-plugin': mockPlugin },
      customLayers: [],
      activeCustomLayerId: null,
      rightPanelActiveTab: 'layers',
    });
  });

  it('creates manual custom layer and switches to inspector', () => {
    const handleClose = vi.fn();
    render(<NewCustomLayerModal isOpen={true} onClose={handleClose} />);

    expect(screen.getByText('Create Custom Layer')).toBeInTheDocument();
    expect(screen.getByText('Manual Vector Layer')).toBeInTheDocument();

    const createManualBtn = screen.getByText('Create Manual Layer');
    fireEvent.click(createManualBtn);

    expect(useAppStore.getState().customLayers).toHaveLength(1);
    expect(useAppStore.getState().customLayers[0].type).toBe('manual');
    expect(useAppStore.getState().rightPanelActiveTab).toBe('inspector');
    expect(handleClose).toHaveBeenCalled();
  });

  it('selects plugin generator and switches to inspector', () => {
    const handleClose = vi.fn();
    render(<NewCustomLayerModal isOpen={true} onClose={handleClose} />);

    expect(screen.getByText('Costmap Inflator')).toBeInTheDocument();

    const selectBtn = screen.getByText('Select');
    fireEvent.click(selectBtn);

    expect(useAppStore.getState().activeCustomLayerId).toBe('new');
    expect(useAppStore.getState().activePluginId).toBe('test-layer-plugin');
    expect(useAppStore.getState().rightPanelActiveTab).toBe('inspector');
    expect(handleClose).toHaveBeenCalled();
  });
});
