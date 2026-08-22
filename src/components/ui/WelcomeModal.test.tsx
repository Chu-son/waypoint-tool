import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WelcomeModal } from './WelcomeModal';
import { useAppStore } from '../../stores/appStore';

vi.mock('../../api', () => ({
  BackendAPI: {
    loadProject: vi.fn(),
  },
  DialogAPI: {
    open: vi.fn(),
    save: vi.fn(),
    ask: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.1.0'),
}));

describe('WelcomeModal UI', () => {
  beforeEach(() => {
    useAppStore.setState({
      isWelcomeModalOpen: true,
      isInitialLaunch: true,
      isDirty: false,
      recentProjects: [],
      rootNodeIds: ['node-1'],
      nodes: { 'node-1': { id: 'node-1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } } },
    });
    vi.clearAllMocks();
  });

  it('renders welcome modal correctly on initial launch without close button', async () => {
    render(<WelcomeModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Waypoint Tool')).toBeInTheDocument();
    expect(screen.getByText('ようこそ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新規プロジェクト/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /プロジェクトを開く/i })).toBeInTheDocument();
    expect(screen.getByText('最近開いたプロジェクト')).toBeInTheDocument();
    expect(screen.getByText('最近開いたプロジェクトの履歴はありません')).toBeInTheDocument();

    // Close button (X) should not be present during initial launch
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('shows close button when not initial launch and allows closing', async () => {
    useAppStore.setState({ isInitialLaunch: false });
    const onCloseMock = vi.fn();

    render(<WelcomeModal isOpen={true} onClose={onCloseMock} />);

    const closeBtn = screen.getByLabelText('Close');
    expect(closeBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(useAppStore.getState().isWelcomeModalOpen).toBe(false);
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('creates new project on clicking "新規プロジェクト"', async () => {
    render(<WelcomeModal isOpen={true} onClose={vi.fn()} />);

    const newBtn = screen.getByRole('button', { name: /新規プロジェクト/i });
    act(() => {
      fireEvent.click(newBtn);
    });

    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.rootNodeIds.length).toBe(0);
      expect(state.isInitialLaunch).toBe(false);
      expect(state.isWelcomeModalOpen).toBe(false);
    });
  });

  it('handles "プロジェクトを開く..." successfully', async () => {
    const { DialogAPI, BackendAPI } = await import('../../api');
    vi.mocked(DialogAPI.open).mockResolvedValue('/path/to/project.wptroj');
    vi.mocked(BackendAPI.loadProject).mockResolvedValue({
      root_node_ids: ['loaded-1'],
      nodes: { 'loaded-1': { id: 'loaded-1', type: 'manual' } },
    } as any);

    render(<WelcomeModal isOpen={true} onClose={vi.fn()} />);

    const openBtn = screen.getByRole('button', { name: /プロジェクトを開く/i });
    await act(async () => {
      fireEvent.click(openBtn);
    });

    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.rootNodeIds).toEqual(['loaded-1']);
      expect(state.isInitialLaunch).toBe(false);
      expect(state.isWelcomeModalOpen).toBe(false);
      expect(state.recentProjects.length).toBe(1);
      expect(state.recentProjects[0].path).toBe('/path/to/project.wptroj');
    });
  });

  it('renders recent projects and loads project when clicked', async () => {
    const { BackendAPI } = await import('../../api');
    vi.mocked(BackendAPI.loadProject).mockResolvedValue({
      root_node_ids: ['recent-node'],
      nodes: { 'recent-node': { id: 'recent-node', type: 'manual' } },
    } as any);

    useAppStore.setState({
      recentProjects: [
        { path: '/path/to/robot_route.wptroj', name: 'robot_route', lastOpened: Date.now() }
      ]
    });

    render(<WelcomeModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('robot_route')).toBeInTheDocument();
    expect(screen.getByText('/path/to/robot_route.wptroj')).toBeInTheDocument();

    const recentItemBtn = screen.getByText('robot_route').closest('button')!;
    await act(async () => {
      fireEvent.click(recentItemBtn);
    });

    await waitFor(() => {
      const state = useAppStore.getState();
      expect(BackendAPI.loadProject).toHaveBeenCalledWith('/path/to/robot_route.wptroj');
      expect(state.rootNodeIds).toEqual(['recent-node']);
      expect(state.isInitialLaunch).toBe(false);
      expect(state.isWelcomeModalOpen).toBe(false);
    });
  });

  it('confirms discarding changes when isDirty is true', async () => {
    const { DialogAPI } = await import('../../api');
    useAppStore.setState({ isDirty: true });
    vi.mocked(DialogAPI.ask).mockResolvedValue(false); // User cancels

    render(<WelcomeModal isOpen={true} onClose={vi.fn()} />);

    const newBtn = screen.getByRole('button', { name: /新規プロジェクト/i });
    await act(async () => {
      fireEvent.click(newBtn);
    });

    expect(DialogAPI.ask).toHaveBeenCalled();
    // Modal should remain open because user canceled
    expect(useAppStore.getState().isWelcomeModalOpen).toBe(true);
    expect(useAppStore.getState().rootNodeIds.length).toBe(1);
  });
});
