import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingOverlay } from './LoadingOverlay';
import { BackgroundLoadingBadge } from './BackgroundLoadingBadge';
import { useAppStore } from '../../../stores/appStore';

describe('LoadingOverlay & BackgroundLoadingBadge', () => {
  beforeEach(() => {
    useAppStore.setState({ activeLoadingTasks: {} });
  });

  it('LoadingOverlay renders nothing when activeLoadingTasks is empty', () => {
    const { container } = render(<LoadingOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('LoadingOverlay renders message and detail for blocking tasks', () => {
    useAppStore.setState({
      activeLoadingTasks: {
        'task-1': {
          id: 'task-1',
          message: 'プラグインを実行中...',
          detail: 'Waypoints Generator',
          blocking: true,
          createdAt: Date.now(),
        },
      },
    });

    render(<LoadingOverlay />);
    expect(screen.getByText('プラグインを実行中...')).toBeInTheDocument();
    expect(screen.getByText('Waypoints Generator')).toBeInTheDocument();
  });

  it('LoadingOverlay does not render when only non-blocking tasks exist', () => {
    useAppStore.setState({
      activeLoadingTasks: {
        'bg-1': {
          id: 'bg-1',
          message: '経路を計算中...',
          blocking: false,
          createdAt: Date.now(),
        },
      },
    });

    const { container } = render(<LoadingOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('BackgroundLoadingBadge renders when non-blocking task exists', () => {
    useAppStore.setState({
      activeLoadingTasks: {
        'bg-1': {
          id: 'bg-1',
          message: '経路を計算中...',
          blocking: false,
          createdAt: Date.now(),
        },
      },
    });

    render(<BackgroundLoadingBadge />);
    expect(screen.getByText('経路を計算中...')).toBeInTheDocument();
  });

  it('BackgroundLoadingBadge hides when a blocking task is also active', () => {
    useAppStore.setState({
      activeLoadingTasks: {
        'bg-1': {
          id: 'bg-1',
          message: '経路を計算中...',
          blocking: false,
          createdAt: Date.now(),
        },
        'task-1': {
          id: 'task-1',
          message: 'エクスポート中...',
          blocking: true,
          createdAt: Date.now(),
        },
      },
    });

    const { container } = render(<BackgroundLoadingBadge />);
    expect(container.firstChild).toBeNull();
  });
});
