import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GroupNodePanel } from './GroupNodePanel';
import { GeneratorNodePanel } from './GeneratorNodePanel';
import { AnnotationGroupPanel } from './AnnotationGroupPanel';
import { renderWithStore } from '../../../test/render';
import { useAppStore } from '../../../stores/appStore';
import { getAppState } from '../../../test/store';
import {
  makeAnnotationGroup,
  makeGenerator,
  makeGroup,
  makePlugin,
  makePluginLayer,
  makePointAnnotation,
  makeTransform,
  makeWaypoint,
  waypointTree,
} from '../../../test/fixtures';

const typeInto = (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
/** The panel fed from the store, as the inspector does, so it sees the group change. */
function LiveAnnotationGroupPanel({ id }: { id: string }) {
  const group = useAppStore((state) => state.annotationGroups[id]);
  return <AnnotationGroupPanel group={group} />;
}

const xyOf = (id: string) => ({ x: getAppState().nodes[id].transform!.x, y: getAppState().nodes[id].transform!.y });

const group = makeGroup('site', ['a', 'b']);
const groupState = () =>
  waypointTree([
    group,
    makeWaypoint('a', { transform: makeTransform(0, 0) }),
    makeWaypoint('b', { transform: makeTransform(2, 0) }),
  ]);

describe('BasePoseSection on a waypoint group', () => {
  it('shows the centre of the waypoints as the reference pose until the group is moved', () => {
    renderWithStore(<GroupNodePanel node={group} />, groupState());

    expect(screen.getByLabelText('基準 X (m)')).toHaveValue('1');
    expect(screen.getByLabelText('基準 Y (m)')).toHaveValue('0');
    expect(screen.getByRole('button', { name: /中身の中心に置き直す/ })).toBeDisabled();
  });

  it('moves the waypoints so that the reference pose lands on the typed value', async () => {
    renderWithStore(<GroupNodePanel node={group} />, groupState());

    typeInto('基準 X (m)', '4');

    await waitFor(() => expect(xyOf('a')).toEqual({ x: 3, y: 0 }));
    expect(xyOf('b')).toEqual({ x: 5, y: 0 });
    expect(screen.getByLabelText('基準 X (m)')).toHaveValue('4');
  });

  it('turns the waypoints around the reference pose', async () => {
    renderWithStore(<GroupNodePanel node={group} />, groupState());

    fireEvent.click(screen.getByRole('button', { name: '+90°' }));

    await waitFor(() => expect(screen.getByLabelText('基準 Yaw (°)')).toHaveValue('90'));
    expect(xyOf('a').x).toBeCloseTo(1);
    expect(xyOf('a').y).toBeCloseTo(-1);
  });

  it('moves with the nudge pad, and one undo puts the waypoints and the numbers back', async () => {
    renderWithStore(<GroupNodePanel node={group} />, groupState());

    fireEvent.click(screen.getByRole('button', { name: /Move right/ }));
    await waitFor(() => expect(xyOf('a').x).toBeCloseTo(0.1));

    act(() => getAppState().undo());

    expect(xyOf('a')).toEqual({ x: 0, y: 0 });
    expect(screen.getByLabelText('基準 X (m)')).toHaveValue('1');
  });

  it('puts the reference pose back on the centre without moving the waypoints', async () => {
    renderWithStore(<GroupNodePanel node={group} />, groupState());
    fireEvent.click(screen.getByRole('button', { name: '+90°' }));
    await waitFor(() => expect(screen.getByLabelText('基準 Yaw (°)')).toHaveValue('90'));
    const moved = xyOf('a');

    fireEvent.click(screen.getByRole('button', { name: /中身の中心に置き直す/ }));

    expect(screen.getByLabelText('基準 Yaw (°)')).toHaveValue('0');
    expect(xyOf('a')).toEqual(moved);
  });

  it('is not shown for a group without waypoints', () => {
    const empty = makeGroup('empty', []);
    renderWithStore(<GroupNodePanel node={empty} />, waypointTree([empty]));

    expect(screen.queryByText('基準位置')).not.toBeInTheDocument();
  });
});

describe('BasePoseSection on a generator', () => {
  const p = makeWaypoint('p', { transform: makeTransform(1, 1) });
  const generatorState = (plugin = makePlugin('gen'), extra = {}) => ({
    ...waypointTree([makeGenerator('gen', [p]), p]),
    plugins: { gen: plugin },
    ...extra,
  });

  it('warns that a plugin without movable inputs regenerates where it was', () => {
    const gen = makeGenerator('gen', [p]);
    renderWithStore(<GeneratorNodePanel node={gen} />, generatorState());

    expect(screen.getByText('再実行すると元の位置に生成されます')).toBeInTheDocument();
  });

  it('says nothing about reruns when the inputs move with it', () => {
    const gen = makeGenerator('gen', [p]);
    renderWithStore(
      <GeneratorNodePanel node={gen} />,
      generatorState(makePlugin('gen', { inputs: [{ id: 'goal', name: 'goal', label: 'Goal', type: 'point' }] })),
    );

    expect(screen.queryByText('再実行すると元の位置に生成されます')).not.toBeInTheDocument();
    expect(screen.queryByText('再実行の結果が変わることがあります')).not.toBeInTheDocument();
  });

  it('tells that other outputs of the same run move along', () => {
    const gen = makeGenerator('gen', [p]);
    renderWithStore(
      <GeneratorNodePanel node={gen} />,
      generatorState(makePlugin('gen'), {
        customLayers: [makePluginLayer('overlay', { source_execution_id: 'run-gen' })],
      }),
    );

    expect(screen.getByText('同じ実行の出力も一緒に動きます')).toBeInTheDocument();
  });
});

describe('BasePoseSection on an annotation group', () => {
  const pointInput = { id: 'goal', name: 'goal', label: 'Goal', type: 'point' as const };
  const generated = makeAnnotationGroup('g', ['dot'], {
    type: 'generator',
    plugin_id: 'gen',
    source_execution_id: 'run',
    generator_params: {
      properties: { spacing: 2 },
      interaction_data: { goal: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
    },
  });
  const state = () => ({
    annotationObjects: { dot: makePointAnnotation('dot', { x: 0, y: 0, group_id: 'g' }) },
    annotationGroups: { g: generated },
    rootAnnotationIds: ['g'],
    plugins: {
      gen: makePlugin('gen', {
        primary_output: 'annotations',
        inputs: [pointInput],
        properties: [{ name: 'spacing', label: 'Spacing', type: 'float', default: 1 }],
      }),
    },
  });

  it('moves the shapes and the input shown in the editor with the group', async () => {
    renderWithStore(<LiveAnnotationGroupPanel id="g" />, state());
    expect(getAppState().pluginInteractionData.goal).toMatchObject({ x: 0, y: 0 });

    typeInto('基準 Y (m)', '3');

    await waitFor(() => expect(getAppState().annotationObjects.dot).toMatchObject({ x: 0, y: 3 }));
    expect(getAppState().pluginInteractionData.goal).toMatchObject({ x: 0, y: 3 });

    act(() => getAppState().undo());
    await waitFor(() => expect(getAppState().pluginInteractionData.goal).toMatchObject({ y: 0 }));
  });

  it('keeps a property being edited when the group moves', async () => {
    renderWithStore(<LiveAnnotationGroupPanel id="g" />, state());
    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '5' } });

    typeInto('基準 Y (m)', '3');

    await waitFor(() => expect(getAppState().annotationObjects.dot).toMatchObject({ y: 3 }));
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  });
});
