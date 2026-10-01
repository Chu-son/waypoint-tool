import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogAPI } from '../api';
import { createDefaultProjectData } from '../stores/migrations/projectMigration';
import {
  makeAnnotationGroup,
  makeManualCustomLayer,
  makeMap,
  makePlugin,
  makePointAnnotation,
  makeWaypoint,
  waypointTree,
} from '../test/fixtures';
import { getAppState, resetAppStore } from '../test/store';
import type { StrictProjectData } from '../types/project';
import { schemaItemId } from '../utils/import/optionSchemaMerge';
import {
  buildProjectImportPlan,
  type ProjectImportCategoryId,
  type ProjectImportSelection,
} from '../utils/import/projectImportPlan';
import { applyProjectImportPlan, getProjectImportContext } from './projectImport';

const incomingProject = (overrides: Partial<StrictProjectData> = {}): StrictProjectData => ({
  ...createDefaultProjectData(),
  ...overrides,
});

const selection = (
  categories: ProjectImportCategoryId[],
  extra: Partial<ProjectImportSelection> = {},
): ProjectImportSelection => ({
  categories: new Set(categories),
  schemaAccepted: new Set(),
  templateActions: {},
  acceptedProfileIds: new Set(),
  ...extra,
});

const importInto = async (incoming: StrictProjectData, sel: ProjectImportSelection) => {
  const plan = buildProjectImportPlan(getProjectImportContext(), incoming, sel);
  return applyProjectImportPlan(plan);
};

describe('importing from another project', () => {
  beforeEach(() => {
    vi.spyOn(DialogAPI, 'message').mockResolvedValue(undefined);
    resetAppStore({ ...waypointTree([makeWaypoint('mine')]), isDirty: false });
  });

  it('adds the selected waypoints next to the existing ones and marks the project modified', async () => {
    const incoming = incomingProject({ nodes: { theirs: makeWaypoint('theirs') }, root_node_ids: ['theirs'] });

    await importInto(incoming, selection(['waypoints']));

    const state = getAppState();
    expect(state.rootNodeIds).toHaveLength(2);
    expect(state.rootNodeIds[0]).toBe('mine');
    expect(state.nodes[state.rootNodeIds[1]].name).toBe('theirs');
    expect(state.isDirty).toBe(true);
  });

  it('undoes the imported waypoints and annotations in one step', async () => {
    const incoming = incomingProject({
      nodes: { a: makeWaypoint('a'), b: makeWaypoint('b') },
      root_node_ids: ['a', 'b'],
      annotation_objects: [makePointAnnotation('p', { group_id: 'g' })],
      annotation_groups: { g: makeAnnotationGroup('g', ['p']) },
      root_annotation_ids: ['g'],
      custom_layers: [makeManualCustomLayer('c')],
    });
    await importInto(incoming, selection(['waypoints', 'annotations']));
    expect(Object.keys(getAppState().nodes)).toHaveLength(3);

    getAppState().undo();

    const state = getAppState();
    expect(state.rootNodeIds).toEqual(['mine']);
    expect(Object.keys(state.annotationObjects)).toEqual([]);
    expect(state.annotationGroups).toEqual({});
    expect(state.rootAnnotationIds).toEqual([]);
  });

  it('does not let Undo revert the imported settings', async () => {
    const incoming = incomingProject({
      path_color: '#abcdef',
      nodes: { a: makeWaypoint('a') },
      root_node_ids: ['a'],
    });
    await importInto(incoming, selection(['pathSettings', 'waypoints']));

    getAppState().undo();

    expect(getAppState().pathColor).toBe('#abcdef');
    expect(getAppState().rootNodeIds).toEqual(['mine']);
  });

  it('puts imported maps on top of the layer stack under fresh ids', async () => {
    const own = makeMap('own');
    resetAppStore({ mapSources: [own.source], mapLayers: [own.layer], layerOrder: ['own'] });
    const theirs = makeMap('own'); // same ids as the project we import into
    const incoming = incomingProject({
      map_sources: [theirs.source],
      map_layers: [theirs.layer],
      layer_order: ['own'],
    });

    await importInto(incoming, selection(['maps']));

    const state = getAppState();
    expect(state.mapLayers).toHaveLength(2);
    expect(state.mapSources).toHaveLength(2);
    const imported = state.mapLayers.find((l) => l.id !== 'own')!;
    expect(state.layerOrder).toEqual([imported.id, 'own']);
    expect(state.mapSources.some((s) => s.id === imported.sourceId)).toBe(true);
  });

  it('leaves the project untouched when the option schema cannot be applied', async () => {
    const incoming = incomingProject({
      options_schema: {
        options: [{ name: 'p', label: 'P', type: 'ref', ref: 'Missing' }],
        globals: [],
        definitions: [],
      },
      nodes: { a: makeWaypoint('a') },
      root_node_ids: ['a'],
    });

    const applied = await importInto(
      incoming,
      selection(['optionSchema', 'waypoints'], { schemaAccepted: new Set([schemaItemId('options', 'p')]) }),
    );

    expect(applied).toBe(false);
    expect(getAppState().rootNodeIds).toEqual(['mine']);
    expect(getAppState().optionsSchema).toBeNull();
  });

  it('applies the accepted schema items and the waypoints that use them', async () => {
    const incoming = incomingProject({
      options_schema: {
        options: [
          { name: 'speed', label: 'Speed', type: 'float' },
          { name: 'skip', label: 'Skip', type: 'string' },
        ],
        globals: [],
        definitions: [],
      },
      nodes: { a: makeWaypoint('a', { options: { speed: 1.5 } }) },
      root_node_ids: ['a'],
    });

    await importInto(
      incoming,
      selection(['optionSchema', 'waypoints'], { schemaAccepted: new Set([schemaItemId('options', 'speed')]) }),
    );

    const state = getAppState();
    expect(state.optionsSchema?.options.map((o) => o.name)).toEqual(['speed']);
    expect(Object.values(state.nodes).some((n) => n.options?.speed === 1.5)).toBe(true);
  });

  it('adds and overwrites templates and keeps the active export profile', async () => {
    const existing = {
      id: 't1',
      name: 'Shared',
      extension: 'yaml',
      suffix: '',
      content: 'old',
      scope: 'local' as const,
    };
    resetAppStore({ exportTemplates: [existing], activeExportProfileId: 'default_profile' });
    const incoming = incomingProject({
      export_templates: [
        { id: 'x1', name: 'Shared', extension: 'yaml', suffix: '', content: 'new', engine: 'jinja' },
        { id: 'x2', name: 'Brand new', extension: 'csv', suffix: '', content: 'c', engine: 'jinja' },
      ],
      export_profiles: [{ id: 'pp', name: 'Imported', conflictResolution: 'overwrite', items: [] }],
    });

    await importInto(incoming, selection(['templates', 'exportProfiles'], { acceptedProfileIds: new Set(['pp']) }));

    const state = getAppState();
    expect(state.exportTemplates.find((t) => t.id === 't1')?.content).toBe('new');
    expect(state.exportTemplates.find((t) => t.name === 'Brand new')?.scope).toBe('local');
    expect(state.exportProfiles.some((p) => p.name === 'Imported')).toBe(true);
    expect(state.activeExportProfileId).toBe('default_profile');
  });

  it('warns about a plugin that is not installed on this machine', async () => {
    resetAppStore({ plugins: { other: makePlugin('other') } });
    const incoming = incomingProject({ active_path_calculator_plugin_id: 'missing_plugin' });
    const plan = buildProjectImportPlan(getProjectImportContext(), incoming, selection(['pathSettings']));

    expect(plan.warnings.join('\n')).toContain('missing_plugin');
  });
});
