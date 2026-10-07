import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { GeneratorNodePanel } from './GeneratorNodePanel';
import { BackendAPI, DialogAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makePlugin, makeTransform, makeWaypoint, waypointTree } from '../../../test/fixtures';
import { quaternionToYaw } from '../../../utils/transformUtils';

const CONFLICT_TITLE = '手動変更の検知 - 再生成の確認';
const plugin = makePlugin('test-gen', { name: 'Test Generator', category: 'waypoint_generator' });

/** A generator whose single generated waypoint (baseline 1, 2, yaw 0) now sits at `current`. */
function renderGenerator(current = makeTransform(1, 2, 0)) {
  const generator = makeWaypoint('gen-1', {
    type: 'generator',
    plugin_id: 'test-gen',
    transform: undefined,
    children_ids: ['child-1'],
    baseline_waypoints: [{ transform: makeTransform(1, 2, 0) }],
  });
  return renderWithStore(<GeneratorNodePanel node={generator} />, {
    ...waypointTree([generator, makeWaypoint('child-1', { transform: current })]),
    plugins: { [plugin.id]: plugin },
  });
}

const generatedChild = () => {
  const { nodes } = getAppState();
  const [id] = nodes['gen-1'].children_ids ?? [];
  return nodes[id];
};

describe('GeneratorNodePanel', () => {
  beforeEach(() => {
    vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue([{ x: 1, y: 2, yaw: 0 }]);
  });

  it('warns when the generator plugin is not loaded', () => {
    const orphan = makeWaypoint('gen-1', { type: 'generator', plugin_id: 'missing-plugin' });
    renderWithStore(<GeneratorNodePanel node={orphan} />, waypointTree([orphan]));
    expect(screen.getByText('プラグイン未ロード')).toBeInTheDocument();
  });

  it('regenerates immediately when the generated waypoints were not edited', async () => {
    renderGenerator();

    fireEvent.click(screen.getByText('Re-Generate Path'));

    await waitFor(() => expect(getAppState().nodes['child-1']).toBeUndefined());
    expect(BackendAPI.runPlugin).toHaveBeenCalledTimes(1);
    expect(generatedChild().transform).toMatchObject({ x: 1, y: 2 });
    expect(screen.queryByText(CONFLICT_TITLE)).not.toBeInTheDocument();
  });

  describe('when generated waypoints were edited by hand', () => {
    it('asks before regenerating, and can re-apply the edits to the new result', async () => {
      renderGenerator(makeTransform(1.5, 2.2, 0.3));

      fireEvent.click(screen.getByText('Re-Generate Path'));
      expect(await screen.findByText(CONFLICT_TITLE)).toBeInTheDocument();
      expect(screen.getByText('1 箇所')).toBeInTheDocument();
      expect(BackendAPI.runPlugin).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText('スタッシュして適用'));

      await waitFor(() => expect(getAppState().nodes['child-1']).toBeUndefined());
      const { transform } = generatedChild();
      expect(transform?.x).toBeCloseTo(1.5);
      expect(transform?.y).toBeCloseTo(2.2);
      expect(quaternionToYaw(transform)).toBeCloseTo(0.3);
    });

    it('can discard the edits and regenerate from scratch', async () => {
      renderGenerator(makeTransform(2, 2, 0));

      fireEvent.click(screen.getByText('Re-Generate Path'));
      fireEvent.click(await screen.findByText('編集を破棄して再生成'));

      await waitFor(() => expect(getAppState().nodes['child-1']).toBeUndefined());
      expect(generatedChild().transform).toMatchObject({ x: 1, y: 2 });
    });

    it('can cancel, keeping the edited waypoints', async () => {
      renderGenerator(makeTransform(2, 2, 0));

      fireEvent.click(screen.getByText('Re-Generate Path'));
      fireEvent.click(await screen.findByText('再生成を中断 (キャンセル)'));

      await waitFor(() => expect(screen.queryByText(CONFLICT_TITLE)).not.toBeInTheDocument());
      expect(BackendAPI.runPlugin).not.toHaveBeenCalled();
      expect(getAppState().nodes['child-1'].transform).toMatchObject({ x: 2, y: 2 });
    });
  });

  describe('Restore Original', () => {
    const RESTORE = '元に戻す (Restore Original)';

    /** A generator that replaced one group holding one waypoint; its generated waypoint now sits at `current`. */
    function renderRestorable(current = makeTransform(1, 2, 0), withSnapshot = true) {
      const generator = makeWaypoint('gen-1', {
        type: 'generator',
        plugin_id: 'test-gen',
        transform: undefined,
        children_ids: ['child-1'],
        baseline_waypoints: [{ transform: makeTransform(1, 2, 0) }],
        source_snapshot: withSnapshot
          ? {
              topLevelIds: ['orig-group'],
              nodes: {
                'orig-group': makeWaypoint('orig-group', {
                  type: 'group',
                  name: 'Original Group',
                  transform: undefined,
                  children_ids: ['orig-wp'],
                }),
                'orig-wp': makeWaypoint('orig-wp', { name: 'Original Waypoint' }),
              },
            }
          : undefined,
      });
      return renderWithStore(<GeneratorNodePanel node={generator} />, {
        ...waypointTree([generator, makeWaypoint('child-1', { transform: current })]),
        plugins: { [plugin.id]: plugin },
      });
    }

    const rootNames = () => getAppState().rootNodeIds.map((id) => getAppState().nodes[id].name);

    it('is offered only for generators that kept their original range', () => {
      renderRestorable(makeTransform(1, 2, 0), false);
      expect(screen.queryByText(RESTORE)).not.toBeInTheDocument();
    });

    it('brings the original group back without asking when nothing was edited', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask');
      renderRestorable();

      fireEvent.click(screen.getByText(RESTORE));

      await waitFor(() => expect(rootNames()).toEqual(['Original Group']));
      expect(ask).not.toHaveBeenCalled();
      const group = getAppState().nodes[getAppState().rootNodeIds[0]];
      expect(getAppState().nodes[group.children_ids![0]].name).toBe('Original Waypoint');
    });

    it('asks before throwing away hand edits, and keeps the generator if declined', async () => {
      const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
      renderRestorable(makeTransform(5, 5, 0));

      fireEvent.click(screen.getByText(RESTORE));

      await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
      expect(getAppState().rootNodeIds).toEqual(['gen-1']);
    });

    it('restores after the user confirms discarding hand edits', async () => {
      vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
      renderRestorable(makeTransform(5, 5, 0));

      fireEvent.click(screen.getByText(RESTORE));

      await waitFor(() => expect(rootNames()).toEqual(['Original Group']));
    });
  });
});
