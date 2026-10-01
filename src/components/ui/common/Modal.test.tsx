import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal, ModalContent } from './Modal';

describe('Modal', () => {
  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        <ModalContent>body</ModalContent>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the topmost modal when several are stacked', () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <Modal isOpen onClose={closeBottom}>
          <ModalContent>bottom</ModalContent>
        </Modal>
        <Modal isOpen onClose={closeTop}>
          <ModalContent>top</ModalContent>
        </Modal>
      </>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBottom).not.toHaveBeenCalled();
  });

  it('hands Escape back to the modal underneath once the top one is gone', () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();
    const ui = (topOpen: boolean) => (
      <>
        <Modal isOpen onClose={closeBottom}>
          <ModalContent>bottom</ModalContent>
        </Modal>
        <Modal isOpen={topOpen} onClose={closeTop}>
          <ModalContent>top</ModalContent>
        </Modal>
      </>
    );
    const { rerender } = render(ui(true));
    expect(screen.getByText('top')).toBeInTheDocument();

    rerender(ui(false));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(closeBottom).toHaveBeenCalledTimes(1);
    expect(closeTop).not.toHaveBeenCalled();
  });

  it('ignores keys other than Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        <ModalContent>body</ModalContent>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
