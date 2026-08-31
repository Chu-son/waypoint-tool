import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimplifiedControls } from './SimplifiedControls';
import { useAppStore } from '../../../stores/appStore';
import * as workflowActions from '../../../utils/workflowActions';

describe('SimplifiedControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders single actionButton for backward compatibility', () => {
    const executeSpy = vi.spyOn(workflowActions, 'executeWorkflowAction').mockResolvedValue();

    render(
      <SimplifiedControls
        actionButton={{
          label: 'Run Single Action',
          action: 'reset_project',
        }}
      />
    );

    const btn = screen.getByRole('button', { name: /Run Single Action/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(executeSpy).toHaveBeenCalledWith('reset_project', undefined);
  });

  it('renders multiple actionButtons with icons and descriptions', () => {
    const executeSpy = vi.spyOn(workflowActions, 'executeWorkflowAction').mockResolvedValue();

    render(
      <SimplifiedControls
        actionButtons={[
          {
            label: 'Action One',
            action: 'reset_project',
            icon: 'FilePlus',
            description: 'This is description one',
            variant: 'secondary',
          },
          {
            label: 'Action Two',
            action: 'open_project_dialog',
            icon: 'FolderOpen',
            description: 'This is description two',
            variant: 'primary',
          },
        ]}
        buttonsLayout="column"
      />
    );

    expect(screen.getByText('Action One')).toBeInTheDocument();
    expect(screen.getByText('This is description one')).toBeInTheDocument();
    expect(screen.getByText('Action Two')).toBeInTheDocument();
    expect(screen.getByText('This is description two')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Action Two/i }));
    expect(executeSpy).toHaveBeenCalledWith('open_project_dialog', undefined);
  });

  it('renders plugin inputs editor when showPluginInputs is true', () => {
    const mockPlugin: any = {
      id: 'drivable_area_layer_generator',
      manifest: {
        name: 'Drivable Area Layer Generator',
        inputs: [
          { id: 'sweep_rect', label: 'Cleaning Area (Rectangle)', type: 'rectangle' },
        ],
      },
    };

    useAppStore.setState({
      plugins: { drivable_area_layer_generator: mockPlugin },
      activePluginId: 'drivable_area_layer_generator',
    });

    render(
      <SimplifiedControls
        pluginTarget="drivable_area_layer_generator"
        showPluginInputs={true}
      />
    );

    expect(screen.getByText(/Cleaning Area \(Rectangle\)/i)).toBeInTheDocument();
  });

  it('selects plugin input slot on click and activates add_generator tool', () => {
    const mockPlugin: any = {
      id: 'drivable_area_layer_generator',
      manifest: {
        name: 'Drivable Area Layer Generator',
        inputs: [
          { id: 'sweep_rect', label: 'Cleaning Area', type: 'rectangle' },
          { id: 'seed_points', label: 'Seed Points', type: 'points' },
        ],
      },
    };

    useAppStore.setState({
      plugins: { drivable_area_layer_generator: mockPlugin },
      activePluginId: 'drivable_area_layer_generator',
      activeInputIndex: 0,
      activeTool: 'select',
      isAnnotationEditMode: true,
    });

    render(
      <SimplifiedControls
        pluginTarget="drivable_area_layer_generator"
        showPluginInputs={true}
      />
    );

    // Initial mount with showPluginInputs should auto-activate add_generator and exit annotation edit mode
    expect(useAppStore.getState().activeTool).toBe('add_generator');
    expect(useAppStore.getState().isAnnotationEditMode).toBe(false);

    // Click second input slot (Seed Points)
    const seedSlot = screen.getByText('Seed Points');
    fireEvent.click(seedSlot);

    expect(useAppStore.getState().activeInputIndex).toBe(1);
    expect(useAppStore.getState().activeTool).toBe('add_generator');
    expect(useAppStore.getState().isAnnotationEditMode).toBe(false);
  });
});
