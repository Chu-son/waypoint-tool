import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Kbd } from './Kbd';

describe('Kbd', () => {
  it('renders children with default linear styling classes', () => {
    render(<Kbd>Ctrl</Kbd>);
    const kbd = screen.getByText('Ctrl');
    expect(kbd).toBeInTheDocument();
    expect(kbd.tagName.toLowerCase()).toBe('kbd');
    expect(kbd.className).toContain('font-mono');
    expect(kbd.className).toContain('border-border-base');
  });

  it('merges custom className properly', () => {
    render(<Kbd className="custom-test-class">Esc</Kbd>);
    const kbd = screen.getByText('Esc');
    expect(kbd.className).toContain('custom-test-class');
  });
});
