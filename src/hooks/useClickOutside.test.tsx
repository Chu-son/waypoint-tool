import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { useClickOutside } from './useClickOutside';

function Menu({ onClose, open = true }: { onClose: () => void; open?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, open);
  return (
    <div>
      <div ref={ref}>
        <button>inside</button>
      </div>
      <button>outside</button>
    </div>
  );
}

describe('useClickOutside', () => {
  it('fires when the mouse is pressed outside the element', () => {
    const onClose = vi.fn();
    render(<Menu onClose={onClose} />);

    fireEvent.mouseDown(screen.getByText('outside'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores presses inside the element', () => {
    const onClose = vi.fn();
    render(<Menu onClose={onClose} />);

    fireEvent.mouseDown(screen.getByText('inside'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const onClose = vi.fn();
    render(<Menu onClose={onClose} open={false} />);

    fireEvent.mouseDown(screen.getByText('outside'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
