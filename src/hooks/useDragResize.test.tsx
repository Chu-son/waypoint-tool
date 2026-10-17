import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDragResize } from './useDragResize';

function Handle({ width, direction, onCommit }: { width: number; direction: 1 | -1; onCommit: (w: number) => void }) {
  const resize = useDragResize({ width, direction, onCommit });
  return (
    <div>
      <div data-testid="handle" onMouseDown={resize.onMouseDown} />
      <span data-testid="width">{resize.width}</span>
    </div>
  );
}

const shownWidth = () => Number(screen.getByTestId('width').textContent);

describe('useDragResize', () => {
  it('follows the pointer while dragging and commits once on mouse up', () => {
    const onCommit = vi.fn();
    render(<Handle width={300} direction={1} onCommit={onCommit} />);

    fireEvent.mouseDown(screen.getByTestId('handle'), { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 130 });
    expect(shownWidth()).toBe(330);
    fireEvent.mouseMove(document, { clientX: 150 });
    expect(shownWidth()).toBe(350);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.mouseUp(document);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(350);
  });

  it('widens to the left for a pane on the right edge', () => {
    const onCommit = vi.fn();
    render(<Handle width={300} direction={-1} onCommit={onCommit} />);

    fireEvent.mouseDown(screen.getByTestId('handle'), { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 450 });
    fireEvent.mouseUp(document);

    expect(onCommit).toHaveBeenCalledWith(350);
  });

  it('clamps the width to the allowed range', () => {
    const onCommit = vi.fn();
    render(<Handle width={300} direction={1} onCommit={onCommit} />);

    fireEvent.mouseDown(screen.getByTestId('handle'), { clientX: 0 });
    fireEvent.mouseMove(document, { clientX: 5000 });
    expect(shownWidth()).toBe(800);
    fireEvent.mouseMove(document, { clientX: -5000 });
    expect(shownWidth()).toBe(200);
    fireEvent.mouseUp(document);

    expect(onCommit).toHaveBeenCalledWith(200);
  });

  it('restores the cursor and stops listening after mouse up', () => {
    document.body.style.cursor = '';
    const onCommit = vi.fn();
    render(<Handle width={300} direction={1} onCommit={onCommit} />);

    fireEvent.mouseDown(screen.getByTestId('handle'), { clientX: 0 });
    expect(document.body.style.cursor).toBe('col-resize');
    fireEvent.mouseUp(document);
    expect(document.body.style.cursor).toBe('');

    fireEvent.mouseMove(document, { clientX: 100 });
    expect(shownWidth()).toBe(300);
  });

  it('does not commit when the pointer did not move', () => {
    const onCommit = vi.fn();
    render(<Handle width={300} direction={1} onCommit={onCommit} />);

    fireEvent.mouseDown(screen.getByTestId('handle'), { clientX: 10 });
    fireEvent.mouseUp(document);

    expect(onCommit).not.toHaveBeenCalled();
  });
});
