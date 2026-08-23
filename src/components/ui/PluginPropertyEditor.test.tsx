import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginPropertyEditor } from './PluginPropertyEditor';

describe('PluginPropertyEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders float property correctly', () => {
    const prop = { name: 'speed', label: 'Speed', type: 'float', default: 1.0 };
    render(
      <PluginPropertyEditor
        property={prop}
        value={1.5}
        onChange={mockOnChange}
      />
    );

    const input = screen.getByDisplayValue('1.5');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('Speed')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '2.5' } });
    expect(mockOnChange).toHaveBeenCalledWith(2.5);
  });

  it('renders boolean property correctly', () => {
    const prop = { name: 'enable', label: 'Enable', type: 'boolean' };
    render(
      <PluginPropertyEditor
        property={prop}
        value={true}
        onChange={mockOnChange}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    
    fireEvent.click(checkbox);
    expect(mockOnChange).toHaveBeenCalledWith(false);
  });

  it('renders select property correctly', () => {
    const prop = { 
      name: 'mode', 
      label: 'Mode', 
      type: 'string', 
      options: ['Auto', 'Manual'], 
      default: 'Auto' 
    };
    render(
      <PluginPropertyEditor
        property={prop}
        value='Manual'
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('Manual');

    fireEvent.change(select, { target: { value: 'Auto' } });
    expect(mockOnChange).toHaveBeenCalledWith('Auto');
  });

  it('renders string property with description', () => {
    const prop = { 
      name: 'desc', 
      type: 'string', 
      description: 'Help text' 
    };
    render(
      <PluginPropertyEditor
        property={prop}
        value='test'
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Help text')).toBeInTheDocument();
  });

  it('renders color property correctly', () => {
    const prop = {
      name: 'layer_color',
      label: 'Layer Color',
      type: 'color',
      default: '#22c55e',
    };
    render(
      <PluginPropertyEditor
        property={prop}
        value='#3b82f6'
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Layer Color')).toBeInTheDocument();
    const textInput = screen.getByPlaceholderText('#22c55e');
    expect(textInput).toHaveValue('#3b82f6');

    fireEvent.change(textInput, { target: { value: '#ef4444' } });
    expect(mockOnChange).toHaveBeenCalledWith('#ef4444');
  });

  it('renders select property with enum_values correctly', () => {
    const prop = {
      name: 'filter_mode',
      label: 'Filter Mode',
      type: 'enum',
      enum_values: ['remove_obstacles', 'fill_holes', 'both'],
      default: 'remove_obstacles',
    };
    render(
      <PluginPropertyEditor
        property={prop}
        value='fill_holes'
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('fill_holes');
    expect(screen.getByRole('option', { name: 'remove_obstacles' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'fill_holes' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'both' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'both' } });
    expect(mockOnChange).toHaveBeenCalledWith('both');
  });

  it('renders select property with object options with custom labels', () => {
    const prop = {
      name: 'shape',
      label: 'Kernel Shape',
      type: 'string',
      options: [
        { value: 'disk', label: 'Disk (Circular)' },
        { value: 'cross', label: 'Cross (4-Neighbor)' },
        { value: 'square', label: 'Square (8-Neighbor)' },
      ],
      default: 'disk',
    };
    render(
      <PluginPropertyEditor
        property={prop}
        value='disk'
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('disk');
    expect(screen.getByRole('option', { name: 'Disk (Circular)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cross (4-Neighbor)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Square (8-Neighbor)' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'square' } });
    expect(mockOnChange).toHaveBeenCalledWith('square');
  });
});

