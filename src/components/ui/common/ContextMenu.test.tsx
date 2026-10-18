import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

function setWindow(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

/** jsdom does not lay anything out, so give the menu a size. */
function stubMenuSize(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('ContextMenu', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setWindow(1024, 768);
  });

  it('opens to the left of the pointer when it would run off the right edge', () => {
    setWindow(1000, 800);
    stubMenuSize(200, 100);
    render(
      <ContextMenu x={990} y={50} onClose={() => {}}>
        <ContextMenuItem onSelect={() => {}}>Item</ContextMenuItem>
      </ContextMenu>,
    );

    expect(screen.getByRole('menu')).toHaveStyle({ left: '790px', top: '50px' });
  });

  it('opens above the pointer when it would run off the bottom edge', () => {
    setWindow(1000, 800);
    stubMenuSize(200, 100);
    render(
      <ContextMenu x={50} y={790} onClose={() => {}}>
        <ContextMenuItem onSelect={() => {}}>Item</ContextMenuItem>
      </ContextMenu>,
    );

    expect(screen.getByRole('menu')).toHaveStyle({ left: '50px', top: '690px' });
  });

  it('closes on Escape and after an item is chosen', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <ContextMenu x={10} y={10} onClose={onClose}>
        <ContextMenuItem onSelect={onSelect}>Item</ContextMenuItem>
      </ContextMenu>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Item' }));
    expect(onSelect).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
