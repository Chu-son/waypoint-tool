import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal, ModalContent } from './Modal';
import { useAppStore } from '../../../stores/appStore';

beforeEach(() => {
  useAppStore.setState({ activeLoadingTasks: {} });
});

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

  it('stays open on Escape while a blocking task runs, and closes again once it is done', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        <ModalContent>body</ModalContent>
      </Modal>,
    );
    const id = useAppStore.getState().startLoading({ message: 'エクスポートを実行中...', blocking: true });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    useAppStore.getState().stopLoading(id);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still closes on Escape while only a background task runs', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        <ModalContent>body</ModalContent>
      </Modal>,
    );
    useAppStore.getState().startLoading({ message: '経路を計算中...', blocking: false });

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
