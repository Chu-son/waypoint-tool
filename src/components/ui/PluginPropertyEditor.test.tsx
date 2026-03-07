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
});
