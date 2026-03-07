import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginInputEditor } from './PluginInputEditor';

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
});
