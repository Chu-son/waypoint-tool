import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginInputEditor } from './PluginInputEditor';
import { useAppStore } from '../../stores/appStore';

describe('PluginInputEditor', () => {
  const mockOnUpdate = vi.fn();

  const baseProps = {
    onUpdate: mockOnUpdate,
    decimalPrecision: 2,
  };

  const pointInput = {
    id: 'pt-1',
    name: 'start_point',
    label: 'Start Point',
    type: 'point',
    required: true,
    description: 'Select the starting point',
  };

  const rectInput = {
    id: 'rect-1',
    name: 'sweep_area',
    label: 'Sweep Area',
    type: 'rectangle',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Creation Mode', () => {
    it('renders point input empty state correctly', () => {
      render(
        <PluginInputEditor
          {...baseProps}
          input={pointInput}
          interactionData={null}
          mode="creation"
          isActive={true}
          hasData={false}
        />
      );

      expect(screen.getByText('Start Point')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByText('Select the starting point')).toBeInTheDocument();
      expect(screen.getByText(/Click on map to place/i)).toBeInTheDocument();
      expect(screen.getByText('Click on map to define')).toBeInTheDocument();
    });

    it('renders point input data and allows numerical editing', () => {
      render(
        <PluginInputEditor
          {...baseProps}
          input={pointInput}
          interactionData={{ x: 1.23, y: 4.56 }}
          mode="creation"
          isActive={true}
          hasData={true}
        />
      );

      const xInput = screen.getByDisplayValue('1.23');
      screen.getByDisplayValue('4.56'); // Ensure it exists

      fireEvent.change(xInput, { target: { value: '2' } });
      expect(mockOnUpdate).toHaveBeenCalledWith({ x: 2, y: 4.56 });
    });

    it('renders rectangle input empty state correctly', () => {
      render(
        <PluginInputEditor
          {...baseProps}
          input={rectInput}
          interactionData={null}
          mode="creation"
          isActive={true}
        />
      );

      expect(screen.getByText('Click and drag on map to draw')).toBeInTheDocument();
    });

    it('renders rectangle data and allows editing', () => {
      const rectData = {
        center: { x: 0, y: 0 },
        width: 10,
        height: 5,
        yaw: Math.PI / 4, // 45 degrees
      };

      render(
        <PluginInputEditor
          {...baseProps}
          input={rectInput}
          interactionData={rectData}
          mode="creation"
          isActive={true}
        />
      );

      expect(screen.getByDisplayValue('10')).toBeInTheDocument(); // Width
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();  // Height
      expect(screen.getByDisplayValue('45')).toBeInTheDocument();   // Yaw in degrees

      const widthInput = screen.getByDisplayValue('10');
      fireEvent.change(widthInput, { target: { value: '15' } });
      expect(mockOnUpdate).toHaveBeenCalledWith({ ...rectData, width: 15 });
    });
  });

  describe('Edit Mode', () => {
    it('renders edit mode for point correctly', () => {
      render(
        <PluginInputEditor
          {...baseProps}
          input={pointInput}
          interactionData={{ x: 10, y: 20 }}
          mode="edit"
        />
      );

      expect(screen.getByText('(Point)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
      expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    });

    it('renders edit mode for rectangle correctly', () => {
      render(
        <PluginInputEditor
          {...baseProps}
          input={rectInput}
          interactionData={{ center: { x: 5, y: 5 }, width: 8, height: 4, yaw: 0 }}
          mode="edit"
        />
      );

      expect(screen.getByText('(Rectangle Area)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('8')).toBeInTheDocument();
      expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    });
  });

  describe('Points List Type (type: "points")', () => {
    const pointsInput = {
      id: 'pts-1',
      name: 'seed_points',
      label: 'Seed Points',
      type: 'points',
      min_points: 1,
      max_points: 10,
    };

    it('renders points input empty state in creation mode', () => {
      render(
        <PluginInputEditor
          {...baseProps}
          input={pointsInput}
          interactionData={[]}
          mode="creation"
          isActive={true}
          hasData={false}
        />
      );

      expect(screen.getByText('Seed Points')).toBeInTheDocument();
      expect(screen.getAllByText(/Click on map to add points/i).length).toBeGreaterThan(0);
      expect(screen.getByText('0 points')).toBeInTheDocument();
      expect(screen.getByText('/ 10 max')).toBeInTheDocument();
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('renders points list and allows editing coordinates', () => {
      const initialPoints = [
        { id: 'pt-1', x: 1.0, y: 2.0 },
        { id: 'pt-2', x: 3.5, y: 4.5 },
      ];

      render(
        <PluginInputEditor
          {...baseProps}
          input={pointsInput}
          interactionData={initialPoints}
          mode="creation"
          isActive={true}
          hasData={true}
        />
      );

      expect(screen.getByText('2 points')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('4.5')).toBeInTheDocument();

      const firstX = screen.getByDisplayValue('1');
      fireEvent.change(firstX, { target: { value: '1.5' } });

      expect(mockOnUpdate).toHaveBeenCalledWith([
        { id: 'pt-1', x: 1.5, y: 2.0 },
        { id: 'pt-2', x: 3.5, y: 4.5 },
      ]);
    });

    it('allows removing a specific point and clearing all', () => {
      const initialPoints = [
        { id: 'pt-1', x: 1.0, y: 2.0 },
        { id: 'pt-2', x: 3.5, y: 4.5 },
      ];

      render(
        <PluginInputEditor
          {...baseProps}
          input={pointsInput}
          interactionData={initialPoints}
          mode="edit"
        />
      );

      expect(screen.getByText('(Points List)')).toBeInTheDocument();

      // Clear all
      const clearBtn = screen.getByText('Clear All');
      fireEvent.click(clearBtn);
      expect(mockOnUpdate).toHaveBeenCalledWith([]);

      // Remove single
      const removeButtons = screen.getAllByTitle('Remove this point');
      fireEvent.click(removeButtons[0]);
      expect(mockOnUpdate).toHaveBeenCalledWith([
        { id: 'pt-2', x: 3.5, y: 4.5 },
      ]);
    });

    it('allows adding point manually via Add button', () => {
      render(
        <PluginInputEditor
          {...baseProps}
          input={pointsInput}
          interactionData={[]}
          mode="creation"
          isActive={true}
        />
      );

      const addBtn = screen.getByText('Add');
      fireEvent.click(addBtn);

      expect(mockOnUpdate).toHaveBeenCalled();
      const updatedArg = mockOnUpdate.mock.calls[0][0];
      expect(updatedArg).toHaveLength(1);
      expect(updatedArg[0]).toMatchObject({ x: 0, y: 0 });
    });

    it('renders custom_layer single select correctly', () => {
      const customLayerInput = {
        id: 'layer-1',
        name: 'target_layer',
        label: 'Target Custom Layer',
        type: 'custom_layer',
      };

      const mockLayers = [
        { id: 'cl-1', name: 'Obstacle Layer', type: 'manual' },
        { id: 'cl-2', name: 'Drivable Area', type: 'plugin' },
      ];

      // Mock useAppStore for customLayers
      const originalState = (useAppStore as any).getState();
      (useAppStore as any).setState({ ...originalState, customLayers: mockLayers });

      render(
        <PluginInputEditor
          {...baseProps}
          input={customLayerInput}
          interactionData={mockLayers[0]}
          mode="creation"
          isActive={true}
        />
      );

      expect(screen.getByText('Target Custom Layer')).toBeInTheDocument();
      expect(screen.getByText('Obstacle Layer (manual)')).toBeInTheDocument();
    });

    it('renders custom_layer multiple list and handles add and remove', () => {
      const customLayerMultipleInput = {
        id: 'layers-input',
        name: 'selected_layers',
        label: 'Selected Custom Layers',
        type: 'custom_layer',
        multiple: true,
      };

      const mockLayers = [
        { id: 'cl-1', name: 'Obstacle Layer', type: 'manual' },
        { id: 'cl-2', name: 'Drivable Area', type: 'plugin' },
      ];

      const originalState = (useAppStore as any).getState();
      (useAppStore as any).setState({ ...originalState, customLayers: mockLayers });

      render(
        <PluginInputEditor
          {...baseProps}
          input={customLayerMultipleInput}
          interactionData={[mockLayers[0]]}
          mode="creation"
          isActive={true}
        />
      );

      expect(screen.getByText('Obstacle Layer')).toBeInTheDocument();

      // Test remove
      const removeBtn = screen.getByTitle('削除');
      fireEvent.click(removeBtn);
      expect(mockOnUpdate).toHaveBeenCalledWith([]);

      // Test select and add
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'cl-2' } });

      const addBtn = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addBtn);
      expect(mockOnUpdate).toHaveBeenCalledWith([mockLayers[0], mockLayers[1]]);
    });
  });
});
