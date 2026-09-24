import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NumericInput } from './NumericInput';

describe('NumericInput', () => {
  it('renders initial value correctly formatted', () => {
    render(<NumericInput value={0.3} onChange={vi.fn()} precision={3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('0.3');
  });

  it('allows clearing text completely during editing without reverting immediately', () => {
    const handleChange = vi.fn();
    render(<NumericInput value={0.3} onChange={handleChange} precision={3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');

    // onChange is not called with invalid/empty number
    expect(handleChange).not.toHaveBeenCalled();

    // typing a new number
    fireEvent.change(input, { target: { value: '0.45' } });
    expect(input.value).toBe('0.45');
    expect(handleChange).toHaveBeenCalledWith(0.45);
  });

  it('allows typing minus sign and negative numbers', () => {
    const handleChange = vi.fn();
    render(<NumericInput value={0.5} onChange={handleChange} precision={3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '-' } });
    expect(input.value).toBe('-');

    fireEvent.change(input, { target: { value: '-0.2' } });
    expect(input.value).toBe('-0.2');
    expect(handleChange).toHaveBeenCalledWith(-0.2);
  });

  it('reverts to the last valid value on blur if left empty or invalid', () => {
    const handleChange = vi.fn();
    render(<NumericInput value={0.3} onChange={handleChange} precision={3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input.value).toBe('0.3');
  });

  it('clamps to min and max on commit', () => {
    const handleChange = vi.fn();
    function TestComponent() {
      const [val, setVal] = useState(0.3);
      return (
        <NumericInput
          value={val}
          onChange={(v) => {
            setVal(v);
            handleChange(v);
          }}
          min={0.1}
          max={1.0}
          precision={3}
        />
      );
    }
    render(<TestComponent />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0.05' } });
    fireEvent.blur(input);

    expect(handleChange).toHaveBeenCalledWith(0.1);
    expect(input.value).toBe('0.1');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.blur(input);

    expect(handleChange).toHaveBeenCalledWith(1.0);
    expect(input.value).toBe('1');
  });

  it('commits on Enter key press', () => {
    const handleChange = vi.fn();
    render(<NumericInput value={0.3} onChange={handleChange} precision={3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0.8' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith(0.8);
    expect(input.value).toBe('0.8');
  });
});
