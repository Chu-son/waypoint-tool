import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackendAPI } from '../api';
import type { PluginInstance } from '../types/plugin';
import { getAppState, resetAppStore } from '../test/store';
import {
  makeAnnotationGroup,
  makeCircleAnnotation,
  makeGenerator,
  makeGroup,
  makeLineAnnotation,
  makeOrientedPointAnnotation,
  makePlugin,
  makePluginLayer,
  makePointAnnotation,
  makeRectAnnotation,
  makeTransform,
  makeWaypoint,
  waypointTree,
} from '../test/fixtures';
import { buildProjectData } from './serialization/projectSerializer';
import { basePoseTarget } from './groupMove';
import { migrateAndNormalizeProjectData } from './migrations/projectMigration';
import { detectGeneratorModifications } from '../utils/generatorStashUtils';
import { validateAndParseClipboardEnvelope } from '../utils/mapElementClipboard';
import { quaternionToYaw } from '../utils/transformUtils';
import type { RigidTransform } from '../utils/rigidTransform';
import type { WaypointNode } from '../types/waypoint';
import type { PluginCustomLayer } from '../types/layer';

const shift = (dx: number, dy: number): RigidTransform => ({ dx, dy, dyaw: 0, pivot: { x: 0, y: 0 } });
const quarterTurnAround = (x: number, y: number): RigidTransform => ({
  dx: 0,
  dy: 0,
  dyaw: Math.PI / 2,
  pivot: { x, y },
});
const node = (id: string) => getAppState().nodes[id];
const xyOf = (id: string) => ({ x: node(id).transform!.x, y: node(id).transform!.y });

/** A plugin whose output follows moves: its only input is a clicked point. */
const pointPlugin = makePlugin('gen', { inputs: [{ id: 'goal', name: 'goal', label: 'Goal', type: 'point' }] });
/** A plugin whose output does not follow moves: it only reads another annotation. */
const referencePlugin = makePlugin('ref', {
  inputs: [{ id: 'seed', name: 'seed', label: 'Seed', type: 'annotation' }],
});

describe('moving a waypoint group', () => {
  beforeEach(() => {
    const a = makeWaypoint('a', { transform: makeTransform(1, 0, 0, 2) });
    const b = makeWaypoint('b', { transform: makeTransform(3, 0) });
    const g1 = makeWaypoint('g1', { transform: makeTransform(1, 2) });
    resetAppStore({
      ...waypointTree([
        makeGroup('site', ['a', 'inner']),
        a,
        makeGroup('inner', ['b', 'gen']),
        b,
        makeGenerator('gen', [g1], {
          generator_params: { properties: {}, interaction_data: { goal: { x: 1, y: 2, qx: 0, qy: 0, qz: 0, qw: 1 } } },
        }),
        g1,
        makeWaypoint('outside', { transform: makeTransform(9, 9) }),
      ]),
      plugins: { gen: pointPlugin, ref: referencePlugin },
    });
  });

  it('moves everything inside at any depth and nothing outside, keeping heights', () => {
    expect(getAppState().transformNodeGroup('site', shift(10, -1))).toBe(true);

    expect(xyOf('a')).toEqual({ x: 11, y: -1 });
    expect(node('a').transform!.z).toBe(2);
    expect(xyOf('b')).toEqual({ x: 13, y: -1 });
    expect(xyOf('g1')).toEqual({ x: 11, y: 1 });
    expect(xyOf('outside')).toEqual({ x: 9, y: 9 });
  });

  it('turns positions and headings around the pivot', () => {
    getAppState().transformNodeGroup('site', quarterTurnAround(1, 0));

    expect(xyOf('b').x).toBeCloseTo(1);
    expect(xyOf('b').y).toBeCloseTo(2);
    expect(quaternionToYaw(node('b').transform)).toBeCloseTo(Math.PI / 2);
  });

  it('keeps the reference pose of the moved group, starting from the centre of its waypoints', () => {
    getAppState().transformNodeGroup('site', shift(1, 1));

    // Waypoints span x 1..3, y 0..2 before the move: centre (2, 1).
    expect(node('site').base_pose).toEqual({ x: 3, y: 2, yaw: 0 });
  });

  it('leaves inner groups without a stored reference pose as they are, and moves stored ones', () => {
    getAppState().updateNode('gen', { base_pose: { x: 1, y: 2, yaw: 0.5 } });

    getAppState().transformNodeGroup('site', shift(1, 0));

    expect(node('inner').base_pose).toBeUndefined();
    expect(node('gen').base_pose).toEqual({ x: 2, y: 2, yaw: 0.5 });
  });

  it('moves the inputs of a generator inside, so it counts as unedited and reruns at the new place', () => {
    getAppState().transformNodeGroup('site', shift(1, 1));

    expect(detectGeneratorModifications(node('gen'), getAppState().nodes).hasModifications).toBe(false);
    expect(node('gen').generator_params!.interaction_data.goal).toMatchObject({ x: 2, y: 3 });
  });

  it('keeps the move of a generator whose inputs cannot move as a hand edit', () => {
    getAppState().updateNode('gen', { plugin_id: 'ref' });

    getAppState().transformNodeGroup('site', shift(1, 1));

    expect(detectGeneratorModifications(node('gen'), getAppState().nodes).modifiedCount).toBe(1);
  });

  it('moves the points of a pipeline output but leaves its inputs to the pipeline', () => {
    getAppState().updateNode('gen', { pipeline_metadata: { pipeline_id: 'p' } as WaypointNode['pipeline_metadata'] });

    getAppState().transformNodeGroup('site', shift(1, 1));

    expect(xyOf('g1')).toEqual({ x: 2, y: 3 });
    expect(node('gen').generator_params!.interaction_data.goal).toMatchObject({ x: 1, y: 2 });
  });

  it('is one undo step, and the earlier history stays as it was', () => {
    getAppState().transformNodeGroup('site', shift(1, 0));
    const [beforeFirstMove] = getAppState().historyPast;
    getAppState().transformNodeGroup('site', shift(1, 0));

    expect(beforeFirstMove.nodes.gen.baseline_waypoints![0].transform.x).toBe(1);
    expect(beforeFirstMove.nodes.gen.generator_params!.interaction_data.goal.x).toBe(1);

    getAppState().undo();
    getAppState().undo();
    expect(xyOf('a')).toEqual({ x: 1, y: 0 });
    expect(node('site').base_pose).toBeUndefined();
  });

  it('leaves the annotations and layers as they were (same objects), as nothing there moves', () => {
    const before = getAppState();

    getAppState().transformNodeGroup('site', shift(1, 0));

    expect(getAppState().annotationObjects).toBe(before.annotationObjects);
    expect(getAppState().annotationGroups).toBe(before.annotationGroups);
    expect(getAppState().customLayers).toBe(before.customLayers);
  });

  it('records history only when asked, so a held nudge is one step', () => {
    getAppState().transformNodeGroup('site', shift(1, 0));
    getAppState().transformNodeGroup('site', shift(1, 0), { recordHistory: false });

    expect(getAppState().historyPast).toHaveLength(1);
    getAppState().undo();
    expect(xyOf('a')).toEqual({ x: 1, y: 0 });
  });

  it('refuses a move that changes nothing', () => {
    resetAppStore({
      ...getAppState(),
      ...waypointTree([...Object.values(getAppState().nodes), makeGroup('empty', [])]),
    });

    expect(getAppState().transformNodeGroup('site', shift(0, 0))).toBe(false);
    expect(getAppState().transformNodeGroup('empty', shift(1, 0))).toBe(false);
    expect(getAppState().transformNodeGroup('missing', shift(1, 0))).toBe(false);
    expect(getAppState().historyPast).toHaveLength(0);
  });

  it('can put the reference pose back on the centre of the waypoints without moving them', () => {
    getAppState().transformNodeGroup('site', quarterTurnAround(0, 0));

    getAppState().clearNodeBasePose('site');

    expect(node('site').base_pose).toBeUndefined();
    expect(xyOf('a').y).toBeCloseTo(1);
    getAppState().undo();
    expect(node('site').base_pose!.yaw).toBeCloseTo(Math.PI / 2);
  });

  it('keeps the reference pose in the project file, and drops a malformed one when reading', () => {
    getAppState().transformNodeGroup('site', shift(1, 1));
    const saved = buildProjectData(getAppState());

    resetAppStore();
    getAppState().setProjectData(saved);
    expect(node('site').base_pose).toEqual({ x: 3, y: 2, yaw: 0 });

    const broken = migrateAndNormalizeProjectData({
      ...saved,
      nodes: { ...saved.nodes, site: { ...saved.nodes.site, base_pose: { x: 'far', y: 0, yaw: 0 } } },
    });
    expect(broken.nodes.site.base_pose).toBeUndefined();
  });
});

describe('moving a generator that replaced a range of waypoints', () => {
  beforeEach(() => {
    const out = makeWaypoint('out', { transform: makeTransform(5, 0) });
    const kept = makeWaypoint('kept', { transform: makeTransform(1, 0) });
    const innerOut = makeWaypoint('innerOut', { transform: makeTransform(2, 0) });
    const nested = makeGenerator('nested', [innerOut]);
    resetAppStore({
      ...waypointTree([
        makeGenerator('range', [out], {
          source_snapshot: { topLevelIds: ['kept', 'nested'], nodes: { kept, nested, innerOut } },
        }),
        out,
      ]),
      plugins: { gen: pointPlugin },
    });
  });

  it('moves the kept original points too, so restoring puts them at the new place unedited', () => {
    getAppState().transformNodeGroup('range', shift(0, 3));

    getAppState().restoreGeneratorSource('range');

    const nodes = Object.values(getAppState().nodes);
    const restoredPoint = nodes.find((n) => n.type === 'manual' && n.transform!.x === 1)!;
    expect(restoredPoint.transform!.y).toBe(3);
    const restoredNested = nodes.find((n) => n.type === 'generator')!;
    expect(detectGeneratorModifications(restoredNested, getAppState().nodes).hasModifications).toBe(false);
  });
});

describe('outputs of the same plugin run', () => {
  const sharedParams = { properties: {}, interaction_data: { goal: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } } };

  beforeEach(() => {
    const p = makeWaypoint('p', { transform: makeTransform(0, 0) });
    resetAppStore({
      ...waypointTree([makeGenerator('gen', [p], { source_execution_id: 'run', generator_params: sharedParams }), p]),
      annotationObjects: { dot: makePointAnnotation('dot', { group_id: 'anno' }) },
      annotationGroups: {
        anno: makeAnnotationGroup('anno', ['dot'], {
          type: 'generator',
          plugin_id: 'gen',
          source_execution_id: 'run',
          generator_params: sharedParams,
        }),
      },
      rootAnnotationIds: ['anno'],
      customLayers: [
        makePluginLayer('overlay', {
          source_execution_id: 'run',
          info: { resolution: 0.05, origin: [1, 1, 0], width: 10, height: 10 },
          interaction_data: { goal: { x: 0, y: 0 } },
        }),
        makePluginLayer('otherRun', { source_execution_id: 'other' }),
      ],
      plugins: { gen: pointPlugin },
    });
  });

  it('move together from either side, with their inputs', () => {
    getAppState().transformAnnotationGroup('anno', shift(2, 0));

    expect(xyOf('p')).toEqual({ x: 2, y: 0 });
    expect(getAppState().annotationObjects.dot).toMatchObject({ x: 2, y: 0 });
    const [overlay, other] = getAppState().customLayers as PluginCustomLayer[];
    expect(overlay.info.origin).toEqual([3, 1, 0]);
    expect(overlay.interaction_data!.goal).toMatchObject({ x: 2, y: 0 });
    expect(other.info.origin).toEqual([0, 0, 0]);
  });

  it.each([
    ['duplicated', () => getAppState().duplicateNodes(['gen'])],
    [
      'pasted',
      () =>
        getAppState().pasteWaypoints({
          elementType: 'waypoint',
          topLevelIds: ['gen'],
          nodes: { gen: node('gen'), p: node('p') },
        }),
    ],
  ])('do not include a %s copy, which moves on its own', (_, copy) => {
    const [copyId] = copy();

    getAppState().transformNodeGroup(copyId, shift(5, 0));

    expect(xyOf('p')).toEqual({ x: 0, y: 0 });
    expect(getAppState().annotationObjects.dot).toMatchObject({ x: 0 });
    expect((getAppState().customLayers[0] as PluginCustomLayer).info.origin).toEqual([1, 1, 0]);
  });

  it('keep a generator that was cut and pasted back in its run', () => {
    const clipboard = {
      elementType: 'waypoint' as const,
      topLevelIds: ['gen'],
      nodes: { gen: node('gen'), p: node('p') },
    };
    getAppState().removeNodes(['gen']);
    const [pastedId] = getAppState().pasteWaypoints(clipboard);

    getAppState().transformNodeGroup(pastedId, shift(5, 0));

    expect(getAppState().annotationObjects.dot).toMatchObject({ x: 5 });
  });

  it('do not include a copy of the annotation group', () => {
    const [copyId] = getAppState().duplicateAnnotations(['anno']);

    getAppState().transformAnnotationGroup(copyId, shift(5, 0));

    expect(xyOf('p')).toEqual({ x: 0, y: 0 });
    expect(getAppState().annotationObjects.dot).toMatchObject({ x: 0 });
  });

  it('still share one moved copy of the inputs they shared', () => {
    getAppState().transformNodeGroup('gen', shift(1, 0));

    const fromGenerator = node('gen').generator_params!;
    expect(fromGenerator.interaction_data.goal).toMatchObject({ x: 1 });
    expect(getAppState().annotationGroups.anno.generator_params).toBe(fromGenerator);
    expect(sharedParams.interaction_data.goal.x).toBe(0);
  });
});

describe('moving an annotation group', () => {
  beforeEach(() => {
    resetAppStore({
      annotationObjects: {
        pt: makePointAnnotation('pt', { x: 1, y: 0, group_id: 'g' }),
        dir: makeOrientedPointAnnotation('dir', { x: 0, y: 1, yaw: 0.2, group_id: 'inner' }),
        ln: makeLineAnnotation('ln', { x1: 0, y1: 0, x2: 2, y2: 0, group_id: 'inner' }),
        box: makeRectAnnotation('box', { cx: 1, cy: 1, angle: 0.1, group_id: 'g' }),
        ring: makeCircleAnnotation('ring', { cx: -1, cy: 0, radius: 2, group_id: 'g' }),
        away: makePointAnnotation('away', { x: 9, y: 9 }),
      },
      annotationGroups: {
        g: makeAnnotationGroup('g', ['pt', 'inner', 'box', 'ring']),
        inner: makeAnnotationGroup('inner', ['dir', 'ln'], { parent_id: 'g' }),
      },
      rootAnnotationIds: ['g', 'away'],
    });
  });

  it('moves every shape inside, at any depth, and nothing outside', () => {
    getAppState().transformAnnotationGroup('g', shift(1, 2));

    const objects = getAppState().annotationObjects;
    expect(objects.pt).toMatchObject({ x: 2, y: 2 });
    expect(objects.dir).toMatchObject({ x: 1, y: 3, yaw: 0.2 });
    expect(objects.ln).toMatchObject({ x1: 1, y1: 2, x2: 3, y2: 2 });
    expect(objects.box).toMatchObject({ cx: 2, cy: 3, angle: 0.1 });
    expect(objects.ring).toMatchObject({ cx: 0, cy: 2, radius: 2 });
    expect(objects.away).toMatchObject({ x: 9, y: 9 });
  });

  it('turns headings and angles with the group', () => {
    getAppState().transformAnnotationGroup('g', quarterTurnAround(0, 0));

    const objects = getAppState().annotationObjects;
    expect((objects.dir as { yaw: number }).yaw).toBeCloseTo(0.2 + Math.PI / 2);
    expect((objects.box as { angle: number }).angle).toBeCloseTo(0.1 + Math.PI / 2);
  });

  it('keeps the reference pose, starting from the centre of its shapes', () => {
    getAppState().transformAnnotationGroup('g', shift(1, 0));

    // Shapes span x -3..2 (the circle reaches -3), y -2..2: centre (-0.5, 0).
    expect(getAppState().annotationGroups.g.base_pose).toEqual({ x: 0.5, y: 0, yaw: 0 });
    expect(getAppState().annotationGroups.inner.base_pose).toBeUndefined();
  });

  it('leaves the waypoints as they were (same object), as none of them moves', () => {
    const before = getAppState().nodes;

    getAppState().transformAnnotationGroup('g', shift(1, 0));

    expect(getAppState().nodes).toBe(before);
  });

  it('is one undo step', () => {
    getAppState().transformAnnotationGroup('g', shift(1, 0));

    getAppState().undo();

    expect(getAppState().annotationObjects.pt).toMatchObject({ x: 1, y: 0 });
    expect(getAppState().annotationGroups.g.base_pose).toBeUndefined();
  });

  it('drops a malformed reference pose pasted from the clipboard', () => {
    const pasted = validateAndParseClipboardEnvelope(
      JSON.stringify({
        schema: 'waypoint-tool/map-element-clipboard',
        version: 1,
        timestamp: 0,
        payload: {
          elementType: 'annotation',
          topLevelIds: ['g'],
          annotationObjects: {},
          annotationGroups: { g: { ...makeAnnotationGroup('g', []), base_pose: { x: 1, y: null, yaw: 0 } } },
        },
      }),
    );

    expect(pasted?.elementType === 'annotation' && pasted.annotationGroups.g.base_pose).toBeUndefined();
  });
});

describe('running a moved generator again', () => {
  const sent = (call: number) => vi.mocked(BackendAPI.runPlugin).mock.calls[call][1] as Record<string, any>;
  const rerun = (plugin: PluginInstance, genId: string) =>
    getAppState().executeGeneratorPlugin({
      plugin,
      properties: {},
      // What the generator panel loads into its input editor.
      interactionData: getAppState().nodes[genId].generator_params!.interaction_data,
      existingExecutionId: getAppState().nodes[genId].source_execution_id,
      targetParentWaypointId: genId,
    });

  beforeEach(() => {
    vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue({ waypoints: [{ x: 0, y: 0 }] });
  });

  it('hands the plugin the moved inputs', async () => {
    resetAppStore({ plugins: { gen: pointPlugin } });
    const first = await getAppState().executeGeneratorPlugin({
      plugin: pointPlugin,
      properties: {},
      interactionData: { goal: { x: 1, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
    });
    const genId = first.parentWaypointId!;

    getAppState().transformNodeGroup(genId, shift(5, 2));
    await rerun(pointPlugin, genId);

    expect(sent(1).interaction_data.goal).toMatchObject({ x: 6, y: 2 });
  });

  it('hands a waypoint-range plugin the moved original points', async () => {
    const ranged = makePlugin('ranged', { needs: ['waypoint_range'], inputs: [] });
    resetAppStore({
      ...waypointTree([
        makeWaypoint('s', { transform: makeTransform(0, 0) }),
        makeWaypoint('e', { transform: makeTransform(2, 0) }),
      ]),
      plugins: { ranged },
    });
    const first = await getAppState().executeGeneratorPlugin({
      plugin: ranged,
      properties: {},
      placement: { type: 'replace_ids', ids: ['s', 'e'] },
    });
    const genId = first.parentWaypointId!;

    getAppState().transformNodeGroup(genId, shift(0, 3));
    await rerun(ranged, genId);

    expect(sent(1).waypoint_range.map((p: { transform: { y: number } }) => p.transform.y)).toEqual([3, 3]);
  });
});

describe('basePoseTarget', () => {
  beforeEach(() => {
    resetAppStore({
      ...waypointTree([makeGroup('g', ['a', 'b']), makeWaypoint('a'), makeWaypoint('b')]),
      annotationObjects: { dot: makePointAnnotation('dot', { group_id: 'ag' }) },
      annotationGroups: { ag: makeAnnotationGroup('ag', ['dot']) },
      rootAnnotationIds: ['ag'],
    });
  });

  it('is the waypoint group selected with its contents', () => {
    getAppState().selectNodes(['g']);

    expect(basePoseTarget(getAppState())).toEqual({ domain: 'node', id: 'g' });
  });

  it('is nothing for a few waypoints picked inside a group', () => {
    getAppState().selectNodes(['a', 'b']);

    expect(basePoseTarget(getAppState())).toBeNull();
  });

  it('is the one annotation group selected', () => {
    getAppState().selectAnnotationObjects(['ag']);

    expect(basePoseTarget(getAppState())).toEqual({ domain: 'annotation', id: 'ag' });
  });

  it('is nothing while a mode shows its own inspector', () => {
    getAppState().selectNodes(['g']);
    resetAppStore({ ...getAppState(), appMode: { mode: 'annotation_edit', subTool: 'select', targetGroupId: null } });

    expect(basePoseTarget(getAppState())).toBeNull();
  });
});
