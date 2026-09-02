import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeneratorNodePanel } from './GeneratorNodePanel';
import { useAppStore } from '../../../stores/appStore';
import { WaypointNode, PluginInstance } from '../../../types/store';
import { yawToQuaternion } from '../../../utils/transformUtils';

vi.mock('../../../stores/appStore', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
  }),
}));

describe('GeneratorNodePanel', () => {
  const mockPlugin: PluginInstance = {
    id: 'test-gen',
    manifest: {
      name: 'Test Generator',
      version: '1.0.0',
      description: 'Test plugin',
      category: 'waypoint_generator',
      type: 'python',
      executable: 'main.py',
      properties: [],
      inputs: [],
    },
    folder_path: '/path/to/plugin',
    is_builtin: false,
  };

  const mockExecute = vi.fn().mockResolvedValue({
    success: true,
    executionId: 'exec-1',
    parentWaypointId: 'gen-1',
    customLayerIds: [],
  });

  const mockRunWithLoading = vi.fn().mockImplementation(async (_opts, fn) => {
    return await fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore.getState as any).mockReturnValue({
      setPluginActiveProperties: vi.fn(),
      executeGeneratorPlugin: mockExecute,
    });
  });

  it('renders plugin missing warning when plugin is not in store', () => {
    const generatorNode: WaypointNode = {
      id: 'gen-1',
      type: 'generator',
      plugin_id: 'missing-plugin',
    };

    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        plugins: {},
        explodeGenerator: vi.fn(),
        openPluginDataModal: vi.fn(),
        updatePluginInteractionData: vi.fn(),
        pluginInteractionData: {},
        nodes: {},
        decimalPrecision: 2,
        runWithLoading: mockRunWithLoading,
      })
    );

    render(<GeneratorNodePanel node={generatorNode} />);
    expect(screen.getByText('プラグイン未ロード')).toBeInTheDocument();
  });

  it('directly regenerates when there are no manual modifications', async () => {
    const baselineT = { x: 1, y: 2, z: 0, ...yawToQuaternion(0) };
    const generatorNode: WaypointNode = {
      id: 'gen-1',
      type: 'generator',
      plugin_id: 'test-gen',
      children_ids: ['child-1'],
      baseline_waypoints: [{ transform: baselineT }],
    };

    const childNode: WaypointNode = {
      id: 'child-1',
      type: 'manual',
      transform: { ...baselineT },
    };

    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        plugins: { 'test-gen': mockPlugin },
        explodeGenerator: vi.fn(),
        openPluginDataModal: vi.fn(),
        updatePluginInteractionData: vi.fn(),
        pluginInteractionData: {},
        nodes: { 'gen-1': generatorNode, 'child-1': childNode },
        decimalPrecision: 2,
        runWithLoading: mockRunWithLoading,
      })
    );

    render(<GeneratorNodePanel node={generatorNode} />);

    const regenBtn = screen.getByText('Re-Generate Path');
    fireEvent.click(regenBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          plugin: mockPlugin,
          stashToApply: undefined,
        })
      );
    });

    // Conflict modal should NOT appear
    expect(screen.queryByText('手動変更の検知 - 再生成の確認')).not.toBeInTheDocument();
  });

  it('opens conflict modal when manual modifications exist and applies stash when requested', async () => {
    const baselineT = { x: 1, y: 2, z: 0, ...yawToQuaternion(0) };
    const modifiedT = { x: 1.5, y: 2.2, z: 0, ...yawToQuaternion(0.3) };

    const generatorNode: WaypointNode = {
      id: 'gen-1',
      type: 'generator',
      plugin_id: 'test-gen',
      children_ids: ['child-1'],
      baseline_waypoints: [{ transform: baselineT }],
    };

    const childNode: WaypointNode = {
      id: 'child-1',
      type: 'manual',
      transform: modifiedT,
    };

    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        plugins: { 'test-gen': mockPlugin },
        explodeGenerator: vi.fn(),
        openPluginDataModal: vi.fn(),
        updatePluginInteractionData: vi.fn(),
        pluginInteractionData: {},
        nodes: { 'gen-1': generatorNode, 'child-1': childNode },
        decimalPrecision: 2,
        runWithLoading: mockRunWithLoading,
      })
    );

    render(<GeneratorNodePanel node={generatorNode} />);

    // Click Re-Generate Path
    fireEvent.click(screen.getByText('Re-Generate Path'));

    // Conflict modal should appear
    expect(await screen.findByText('手動変更の検知 - 再生成の確認')).toBeInTheDocument();
    expect(screen.getByText('1 箇所')).toBeInTheDocument();

    // Execute has not been called yet (cancelled/paused for user choice)
    expect(mockExecute).not.toHaveBeenCalled();

    // Click "スタッシュして適用"
    fireEvent.click(screen.getByText('スタッシュして適用'));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          plugin: mockPlugin,
          stashToApply: expect.objectContaining({
            0: expect.objectContaining({
              index: 0,
              hasTransformDiff: true,
              deltaX: expect.closeTo(0.5),
              deltaY: expect.closeTo(0.2),
            }),
          }),
        })
      );
    });
  });

  it('discards modifications when requested from conflict modal', async () => {
    const baselineT = { x: 1, y: 2, z: 0, ...yawToQuaternion(0) };
    const modifiedT = { x: 2.0, y: 2.0, z: 0, ...yawToQuaternion(0) };

    const generatorNode: WaypointNode = {
      id: 'gen-1',
      type: 'generator',
      plugin_id: 'test-gen',
      children_ids: ['child-1'],
      baseline_waypoints: [{ transform: baselineT }],
    };

    const childNode: WaypointNode = {
      id: 'child-1',
      type: 'manual',
      transform: modifiedT,
    };

    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        plugins: { 'test-gen': mockPlugin },
        explodeGenerator: vi.fn(),
        openPluginDataModal: vi.fn(),
        updatePluginInteractionData: vi.fn(),
        pluginInteractionData: {},
        nodes: { 'gen-1': generatorNode, 'child-1': childNode },
        decimalPrecision: 2,
        runWithLoading: mockRunWithLoading,
      })
    );

    render(<GeneratorNodePanel node={generatorNode} />);

    fireEvent.click(screen.getByText('Re-Generate Path'));
    expect(await screen.findByText('手動変更の検知 - 再生成の確認')).toBeInTheDocument();

    // Click "編集を破棄して再生成"
    fireEvent.click(screen.getByText('編集を破棄して再生成'));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          plugin: mockPlugin,
          stashToApply: undefined,
        })
      );
    });
  });

  it('cancels regeneration when cancelled from conflict modal', async () => {
    const baselineT = { x: 1, y: 2, z: 0, ...yawToQuaternion(0) };
    const modifiedT = { x: 2.0, y: 2.0, z: 0, ...yawToQuaternion(0) };

    const generatorNode: WaypointNode = {
      id: 'gen-1',
      type: 'generator',
      plugin_id: 'test-gen',
      children_ids: ['child-1'],
      baseline_waypoints: [{ transform: baselineT }],
    };

    const childNode: WaypointNode = {
      id: 'child-1',
      type: 'manual',
      transform: modifiedT,
    };

    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        plugins: { 'test-gen': mockPlugin },
        explodeGenerator: vi.fn(),
        openPluginDataModal: vi.fn(),
        updatePluginInteractionData: vi.fn(),
        pluginInteractionData: {},
        nodes: { 'gen-1': generatorNode, 'child-1': childNode },
        decimalPrecision: 2,
        runWithLoading: mockRunWithLoading,
      })
    );

    render(<GeneratorNodePanel node={generatorNode} />);

    fireEvent.click(screen.getByText('Re-Generate Path'));
    expect(await screen.findByText('手動変更の検知 - 再生成の確認')).toBeInTheDocument();

    // Click "再生成を中断 (キャンセル)"
    fireEvent.click(screen.getByText('再生成を中断 (キャンセル)'));

    await waitFor(() => {
      expect(screen.queryByText('手動変更の検知 - 再生成の確認')).not.toBeInTheDocument();
    });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
