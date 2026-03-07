import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

describe('KeyboardShortcutsModal', () => {
  it('renders correctly when open', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Open Project')).toBeInTheDocument();
    expect(screen.getByText('Save Project')).toBeInTheDocument();
    expect(screen.getByText('Delete Selected')).toBeInTheDocument();
  });

  it('is not rendered when isOpen is false', () => {
    const { container } = render(<KeyboardShortcutsModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when the X button is clicked', () => {
    const mockOnClose = vi.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={mockOnClose} />);
    
    fireEvent.click(screen.getByText('Close'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when Esc key is pressed', () => {
    const mockOnClose = vi.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={mockOnClose} />);
    
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });
});
