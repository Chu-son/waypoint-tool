import { describe, it, expect } from 'vitest';
import type { ExportProfile, ExportTemplate } from '../../types/export';
import type { OptionsSchema } from '../../types/options';
import type { StrictProjectData } from '../../types/project';
import { createDefaultProjectData } from '../../stores/migrations/projectMigration';
import {
  makeAnnotationGroup,
  makeGroup,
  makeManualCustomLayer,
  makeMap,
  makePointAnnotation,
  makeWaypoint,
  waypointTree,
} from '../../test/fixtures';
import { schemaItemId } from './optionSchemaMerge';
import {
  buildProjectImportPlan,
  diffTemplates,
  isPlanEmpty,
  PROJECT_IMPORT_CATEGORIES,
  valueCategoryDiffers,
  type ProjectImportCategoryId,
  type ProjectImportSelection,
} from './projectImportPlan';

const project = (overrides: Partial<StrictProjectData> = {}): StrictProjectData => ({
  ...createDefaultProjectData(),
  ...overrides,
});

const select = (
  categories: ProjectImportCategoryId[],
  extra: Partial<ProjectImportSelection> = {},
): ProjectImportSelection => ({
  categories: new Set(categories),
  schemaAccepted: new Set(),
  templateActions: {},
  acceptedProfileIds: new Set(),
  ...extra,
});

const template = (
  id: string,
  name: string,
  content = 'body',
  overrides: Partial<ExportTemplate> = {},
): ExportTemplate => ({
  id,
  name,
  extension: 'yaml',
  suffix: '',
  content,
  engine: 'jinja',
  ...overrides,
});

const profile = (id: string, name: string, items: ExportProfile['items'] = []): ExportProfile => ({
  id,
  name,
  conflictResolution: 'overwrite',
  items,
});

const ctx = (current: StrictProjectData, currentTemplates: ExportTemplate[] = []) => ({ current, currentTemplates });

describe('buildProjectImportPlan: settings', () => {
  it('replaces only the value categories that were selected', () => {
    const current = project({ path_color: '#111111', decimal_precision: 3 });
    const incoming = project({ path_color: '#222222', decimal_precision: 9, path_width: 0.5 });

    const plan = buildProjectImportPlan(ctx(current), incoming, select(['pathSettings']));

    expect(plan.settingsPatch.path_color).toBe('#222222');
    expect(plan.settingsPatch.path_width).toBe(0.5);
    expect(plan.settingsPatch).not.toHaveProperty('decimal_precision');
  });

  it('is empty when nothing is selected', () => {
    const plan = buildProjectImportPlan(ctx(project()), project({ path_color: '#222222' }), select([]));
    expect(isPlanEmpty(plan)).toBe(true);
  });

  it('detects whether a value category differs from the current project', () => {
    const category = PROJECT_IMPORT_CATEGORIES.find((c) => c.id === 'conditionalStyles')!;
    expect(valueCategoryDiffers(category, project(), project())).toBe(false);
    expect(valueCategoryDiffers(category, project(), project({ conditional_styles_enabled: false }))).toBe(true);
  });

  it('merges only the accepted option schema items', () => {
    const str = (name: string) => ({ name, label: name, type: 'string' as const });
    const current = project({ options_schema: { options: [str('a')], globals: [], definitions: [] } });
    const incoming = project({
      options_schema: { options: [str('a'), str('b'), str('c')], globals: [], definitions: [] },
    });

    const plan = buildProjectImportPlan(
      ctx(current),
      incoming,
      select(['optionSchema'], { schemaAccepted: new Set([schemaItemId('options', 'b')]) }),
    );

    expect(plan.optionsSchema?.options.map((o) => o.name)).toEqual(['a', 'b']);
  });
});

describe('buildProjectImportPlan: data gets fresh ids', () => {
  const sharedTree = waypointTree([makeGroup('g', ['w1']), makeWaypoint('w1'), makeWaypoint('w2')]);

  it('adds waypoints under new ids even when the source is a copy of this project', () => {
    const copy = project({ nodes: sharedTree.nodes, root_node_ids: sharedTree.rootNodeIds });
    const plan = buildProjectImportPlan(ctx(copy), copy, select(['waypoints']));

    const newIds = Object.keys(plan.data.nodes);
    expect(newIds).toHaveLength(3);
    expect(newIds.some((id) => id in copy.nodes)).toBe(false);
    expect(plan.data.rootNodeIds).toHaveLength(2);
    const group = Object.values(plan.data.nodes).find((n) => n.type === 'manual_group')!;
    expect(group.children_ids).toHaveLength(1);
    expect(plan.data.nodes[group.children_ids![0]]).toBeDefined();
  });

  it('moves a generation id consistently across waypoints and annotations', () => {
    const incoming = project({
      nodes: {
        a: makeWaypoint('a', { source_execution_id: 'exec-1' }),
        b: makeWaypoint('b', { source_execution_id: 'exec-1' }),
      },
      root_node_ids: ['a', 'b'],
      annotation_objects: [makePointAnnotation('p', { source_execution_id: 'exec-1' })],
      root_annotation_ids: ['p'],
    });

    const plan = buildProjectImportPlan(ctx(project()), incoming, select(['waypoints', 'annotations']));

    const ids = new Set([
      ...Object.values(plan.data.nodes).map((n) => n.source_execution_id),
      plan.data.annotationObjects[0].source_execution_id,
    ]);
    expect(ids.size).toBe(1);
    expect(ids.has('exec-1')).toBe(false);
  });

  it('keeps annotation group membership after renumbering', () => {
    const incoming = project({
      annotation_objects: [makePointAnnotation('p', { group_id: 'grp' })],
      annotation_groups: { grp: makeAnnotationGroup('grp', ['p']) },
      root_annotation_ids: ['grp'],
    });

    const plan = buildProjectImportPlan(ctx(project()), incoming, select(['annotations']));

    const [group] = Object.values(plan.data.annotationGroups);
    const [point] = plan.data.annotationObjects;
    expect(group.id).not.toBe('grp');
    expect(group.children_ids).toEqual([point.id]);
    expect(point.group_id).toBe(group.id);
    expect(plan.data.rootAnnotationIds).toEqual([group.id]);
  });

  it('renumbers maps, layers and visibility sets and keeps them pointing at each other', () => {
    const base = makeMap('m1');
    const custom = makeManualCustomLayer('c1');
    const incoming = project({
      map_sources: [base.source],
      map_layers: [base.layer],
      custom_layers: [custom],
      layer_order: ['c1', 'm1'],
      layer_visibility_sets: [{ id: 's1', name: 'Set', visibility: { m1: true, c1: false, gone: true } }],
    });

    const plan = buildProjectImportPlan(ctx(project()), incoming, select(['maps']));

    const [source] = plan.data.mapSources;
    const [layer] = plan.data.mapLayers;
    const [customLayer] = plan.data.customLayers;
    expect(layer.sourceId).toBe(source.id);
    expect(source.id).not.toBe(base.source.id);
    expect(plan.data.layerOrder).toEqual([customLayer.id, layer.id]);
    expect(plan.data.layerVisibilitySets[0].visibility).toEqual({ [layer.id]: true, [customLayer.id]: false });
  });
});

describe('buildProjectImportPlan: templates', () => {
  const current = project();

  it('classifies incoming templates against current ones by name', () => {
    const items = diffTemplates(
      [template('t1', 'Same'), template('t2', 'Edited', 'old')],
      [template('x1', 'Same'), template('x2', 'Edited', 'new'), template('x3', 'Fresh')],
    );
    expect(items.map((i) => i.status)).toEqual(['unchanged', 'changed', 'added']);
  });

  it('overwrites a same-name template in place, keeping its id and scope', () => {
    const existing = template('t1', 'T', 'old', { scope: 'global' });
    const incoming = project({ export_templates: [template('x1', 'T', 'new')] });

    const plan = buildProjectImportPlan(ctx(current, [existing]), incoming, select(['templates']));

    expect(plan.templates.update).toHaveLength(1);
    expect(plan.templates.update[0]).toMatchObject({
      id: 't1',
      template: { id: 't1', content: 'new', scope: 'global' },
    });
    expect(plan.templates.add).toHaveLength(0);
  });

  it('adds a new local template and marks a same-name addition as imported', () => {
    const existing = template('t1', 'T', 'old');
    const incoming = project({ export_templates: [template('x1', 'T', 'new'), template('x2', 'Other')] });

    const plan = buildProjectImportPlan(
      ctx(current, [existing]),
      incoming,
      select(['templates'], { templateActions: { x1: 'add' } }),
    );

    expect(plan.templates.add.map((t) => [t.name, t.scope])).toEqual([
      ['T (Imported)', 'local'],
      ['Other', 'local'],
    ]);
    expect(plan.templates.add.every((t) => t.id !== 'x1' && t.id !== 'x2')).toBe(true);
  });

  it('leaves a template alone when skipped', () => {
    const existing = template('t1', 'T', 'old');
    const incoming = project({ export_templates: [template('x1', 'T', 'new')] });

    const plan = buildProjectImportPlan(
      ctx(current, [existing]),
      incoming,
      select(['templates'], { templateActions: { x1: 'skip' } }),
    );

    expect(plan.templates).toEqual({ add: [], update: [] });
  });
});

describe('buildProjectImportPlan: export profiles', () => {
  const item = (overrides: Partial<ExportProfile['items'][number]>): ExportProfile['items'][number] => ({
    id: 'i',
    type: 'waypoint_template',
    sourceId: 'x1',
    relativePathPattern: '{name}.yaml',
    enabled: true,
    ...overrides,
  });

  it('points a profile item at the template it was imported as', () => {
    const incoming = project({
      export_templates: [template('x1', 'Fresh')],
      export_profiles: [profile('p1', 'Profile', [item({ sourceId: 'x1' })])],
    });

    const plan = buildProjectImportPlan(
      ctx(project()),
      incoming,
      select(['templates', 'exportProfiles'], { acceptedProfileIds: new Set(['p1']) }),
    );

    const [added] = plan.exportProfiles.add;
    expect(added.id).not.toBe('p1');
    expect(added.items[0].sourceId).toBe(plan.templates.add[0].id);
    expect(added.items[0].enabled).toBe(true);
    expect(added.items[0].id).not.toBe('i');
  });

  it('disables an item whose template is not available and says so', () => {
    const incoming = project({ export_profiles: [profile('p1', 'Profile', [item({ sourceId: 'missing' })])] });

    const plan = buildProjectImportPlan(
      ctx(project()),
      incoming,
      select(['exportProfiles'], { acceptedProfileIds: new Set(['p1']) }),
    );

    expect(plan.exportProfiles.add[0].items[0].enabled).toBe(false);
    expect(plan.warnings.join('\n')).toContain('Profile');
  });

  it('keeps a reference to a template that already exists here (e.g. a global one)', () => {
    const incoming = project({ export_profiles: [profile('p1', 'Profile', [item({ sourceId: 'global-1' })])] });

    const plan = buildProjectImportPlan(
      ctx(project(), [template('global-1', 'Global', 'b', { scope: 'global' })]),
      incoming,
      select(['exportProfiles'], { acceptedProfileIds: new Set(['p1']) }),
    );

    expect(plan.exportProfiles.add[0].items[0]).toMatchObject({ sourceId: 'global-1', enabled: true });
  });

  it('resolves regions and visibility sets that are imported along with it', () => {
    const base = makeMap('m1');
    const incoming = project({
      map_sources: [base.source],
      map_layers: [base.layer],
      layer_order: ['m1'],
      layer_visibility_sets: [{ id: 's1', name: 'Set', visibility: { m1: true } }],
      export_regions: [{ id: 'r1', name: 'Region', visible: true, rect: { x: 0, y: 0, width: 1, height: 1 } }],
      export_profiles: [
        profile('p1', 'Profile', [item({ type: 'map_region', sourceId: 'r1', visibilitySetId: 's1' })]),
      ],
    });

    const plan = buildProjectImportPlan(
      ctx(project()),
      incoming,
      select(['maps', 'exportRegions', 'exportProfiles'], { acceptedProfileIds: new Set(['p1']) }),
    );

    expect(plan.exportProfiles.add[0].items[0]).toMatchObject({
      sourceId: plan.data.exportRegions[0].id,
      visibilitySetId: plan.data.layerVisibilitySets[0].id,
      enabled: true,
    });
  });

  it('falls back to the current display when the visibility set cannot be found', () => {
    const incoming = project({
      export_profiles: [
        profile('p1', 'Profile', [item({ type: 'map_all_regions', sourceId: 'all', visibilitySetId: 'gone' })]),
      ],
    });

    const plan = buildProjectImportPlan(
      ctx(project()),
      incoming,
      select(['exportProfiles'], { acceptedProfileIds: new Set(['p1']) }),
    );

    expect(plan.exportProfiles.add[0].items[0].visibilitySetId).toBeUndefined();
    expect(plan.warnings).toHaveLength(1);
  });

  it('updates a same-name profile in place and ignores profiles that were not accepted', () => {
    const current = project({ export_profiles: [profile('cur', 'Profile'), profile('cur2', 'Other')] });
    const incoming = project({
      export_profiles: [{ ...profile('p1', 'Profile'), description: 'changed' }, profile('p2', 'Skipped')],
    });

    const plan = buildProjectImportPlan(
      ctx(current),
      incoming,
      select(['exportProfiles'], { acceptedProfileIds: new Set(['p1']) }),
    );

    expect(plan.exportProfiles.update).toHaveLength(1);
    expect(plan.exportProfiles.update[0]).toMatchObject({ id: 'cur', profile: { id: 'cur', description: 'changed' } });
    expect(plan.exportProfiles.add).toHaveLength(0);
  });
});

describe('buildProjectImportPlan: presets and plugins', () => {
  const schemaWithPreset: OptionsSchema = {
    options: [{ name: 'mode', label: 'Mode', type: 'string', presets: [{ name: 'fast', value: 'F' }] }],
    globals: [],
    definitions: [],
  };
  const incoming = project({
    options_schema: schemaWithPreset,
    nodes: { w: makeWaypoint('w', { options: { mode: { $preset: 'fast' } } }) },
    root_node_ids: ['w'],
  });

  it('expands a preset reference the destination schema does not define', () => {
    const plan = buildProjectImportPlan(ctx(project()), incoming, select(['waypoints']));

    const [node] = Object.values(plan.data.nodes);
    expect(node.options).toEqual({ mode: 'F' });
    expect(plan.warnings.join('\n')).toContain('プリセット');
  });

  it('keeps the preset reference when the destination schema has it', () => {
    const current = project({ options_schema: schemaWithPreset });

    const plan = buildProjectImportPlan(ctx(current), incoming, select(['waypoints']));

    const [node] = Object.values(plan.data.nodes);
    expect(node.options).toEqual({ mode: { $preset: 'fast' } });
  });

  it('warns about plugins that are not installed', () => {
    const withPlugin = project({
      nodes: { g: makeGroup('g', [], { type: 'generator', plugin_id: 'my_plugin' }) },
      root_node_ids: ['g'],
    });

    const plan = buildProjectImportPlan(
      { current: project(), currentTemplates: [], installedPluginIds: new Set(['other']) },
      withPlugin,
      select(['waypoints']),
    );

    expect(plan.warnings.join('\n')).toContain('my_plugin');
  });
});
