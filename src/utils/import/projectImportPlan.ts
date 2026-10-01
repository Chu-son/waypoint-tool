import { v4 as uuidv4 } from 'uuid';
import type { AnnotationGroup, AnnotationObject } from '../../types/annotation';
import type { ExportProfile, ExportTargetItem, ExportTemplate } from '../../types/export';
import type { CustomLayer, ExportRegion, LayerVisibilitySet, MapSource, ProjectMapLayer } from '../../types/layer';
import type { OptionsSchema, OptionValue, WaypointOptions } from '../../types/options';
import type { StrictProjectData } from '../../types/project';
import type { WaypointNode } from '../../types/waypoint';
import { diffByKey, type ItemDiff } from '../diff/itemDiff';
import { deepEqual } from '../optionValues';
import { collectPresetScopes, inlineRemovedPresets } from '../optionPresets';
import {
  createExecutionIdRemapper,
  remapAnnotations,
  remapExportRegions,
  remapMaps,
  remapNodes,
  type ExecutionIdRemapper,
} from './idRemap';
import { diffOptionsSchema, mergeOptionsSchema } from './optionSchemaMerge';

export type ProjectImportCategoryId =
  | 'optionSchema'
  | 'templates'
  | 'exportProfiles'
  | 'exportFormat'
  | 'robotFootprint'
  | 'pathSettings'
  | 'conditionalStyles'
  | 'mapDisplay'
  | 'geoMap'
  | 'waypoints'
  | 'maps'
  | 'annotations'
  | 'exportRegions';

/**
 * - `items`: 項目ごとに取り込むかを選ぶ（スキーマ、テンプレート、プロファイル）。
 * - `value`: カテゴリ全体を、今の値で置き換えるかどうかを選ぶ。
 * - `additive`: 取り込み元のデータを今のプロジェクトへ追加する（差分は出さない）。
 */
export type ProjectImportMode = 'items' | 'value' | 'additive';

export interface ProjectImportCategory {
  id: ProjectImportCategoryId;
  label: string;
  description: string;
  kind: 'settings' | 'data';
  mode: ProjectImportMode;
  /** `value` のカテゴリが置き換えるプロジェクトデータのキー。 */
  keys?: readonly (keyof StrictProjectData)[];
}

export const PROJECT_IMPORT_CATEGORIES: readonly ProjectImportCategory[] = [
  {
    id: 'optionSchema',
    label: 'Option Schema',
    description: 'オプション・グローバル値・型定義',
    kind: 'settings',
    mode: 'items',
  },
  {
    id: 'templates',
    label: 'Export Templates',
    description: 'プロジェクトのエクスポートテンプレート',
    kind: 'settings',
    mode: 'items',
  },
  {
    id: 'exportProfiles',
    label: 'Export Profiles',
    description: '出力先と出力対象の組み合わせ',
    kind: 'settings',
    mode: 'items',
  },
  {
    id: 'exportFormat',
    label: 'Export Format',
    description: '既定の書式、開始インデックス、小数桁数、整数の float 出力',
    kind: 'settings',
    mode: 'value',
    keys: ['default_export_formats', 'index_start_index', 'export_integers_as_float', 'decimal_precision'],
  },
  {
    id: 'robotFootprint',
    label: 'Robot Footprint',
    description: 'ロボットの外形',
    kind: 'settings',
    mode: 'value',
    keys: ['robot_footprint'],
  },
  {
    id: 'pathSettings',
    label: 'Path Settings',
    description: '経路計算プラグインと経路の表示',
    kind: 'settings',
    mode: 'value',
    keys: [
      'active_path_calculator_plugin_id',
      'path_calculator_params',
      'auto_recalculate_path',
      'path_color',
      'path_width',
      'path_opacity',
      'sync_path_width_with_footprint',
    ],
  },
  {
    id: 'conditionalStyles',
    label: 'Conditional Styles',
    description: '条件付きスタイルのルール',
    kind: 'settings',
    mode: 'value',
    keys: ['conditional_styles', 'conditional_styles_enabled'],
  },
  {
    id: 'mapDisplay',
    label: 'Map Display',
    description: '占有グリッドのしきい値と既定の地図の不透明度',
    kind: 'settings',
    mode: 'value',
    keys: ['occupancy_settings', 'default_map_opacity'],
  },
  {
    id: 'geoMap',
    label: 'Background Map',
    description: '背景地図（OSM／衛星画像）の設定',
    kind: 'settings',
    mode: 'value',
    keys: ['geo_map'],
  },
  {
    id: 'waypoints',
    label: 'Waypoints',
    description: 'ウェイポイントとグループ',
    kind: 'data',
    mode: 'additive',
  },
  {
    id: 'maps',
    label: 'Maps & Layers',
    description: 'マップ、カスタムレイヤー、レイヤー表示セット',
    kind: 'data',
    mode: 'additive',
  },
  {
    id: 'annotations',
    label: 'Annotations',
    description: 'アノテーションとグループ',
    kind: 'data',
    mode: 'additive',
  },
  {
    id: 'exportRegions',
    label: 'Export Regions',
    description: 'マップ出力の範囲',
    kind: 'data',
    mode: 'additive',
  },
];

export const getProjectImportCategory = (id: ProjectImportCategoryId): ProjectImportCategory =>
  PROJECT_IMPORT_CATEGORIES.find((c) => c.id === id)!;

/** `value` カテゴリの対象キーと値。差分表示と、取り込むパッチの両方に使う。 */
export function pickCategoryValue(
  category: ProjectImportCategory,
  data: StrictProjectData,
): Partial<StrictProjectData> {
  const out: Record<string, unknown> = {};
  (category.keys ?? []).forEach((key) => {
    out[key] = data[key];
  });
  return out as Partial<StrictProjectData>;
}

/** 取り込み元にそのカテゴリのデータがいくつあるか。0 のカテゴリは取り込むものが無い。 */
export function countIncoming(id: ProjectImportCategoryId, data: StrictProjectData): number {
  switch (id) {
    case 'optionSchema':
      return data.options_schema
        ? data.options_schema.options.length +
            data.options_schema.globals.length +
            (data.options_schema.definitions?.length ?? 0)
        : 0;
    case 'templates':
      return data.export_templates.length;
    case 'exportProfiles':
      return data.export_profiles.length;
    case 'waypoints':
      return Object.keys(data.nodes).length;
    case 'maps':
      return data.map_layers.length + data.custom_layers.length;
    case 'annotations':
      return data.annotation_objects.length;
    case 'exportRegions':
      return data.export_regions.length;
    default:
      return 1;
  }
}

/** `value` カテゴリが今の値と異なるか。 */
export function valueCategoryDiffers(
  category: ProjectImportCategory,
  current: StrictProjectData,
  incoming: StrictProjectData,
): boolean {
  return !deepEqual(pickCategoryValue(category, current), pickCategoryValue(category, incoming));
}

// ---------------------------------------------------------------------------
// テンプレート・プロファイルの項目差分
// ---------------------------------------------------------------------------

export type TemplateAction = 'overwrite' | 'add' | 'skip';

export interface TemplateImportItem {
  incoming: ExportTemplate;
  /** 同じ名前の今のテンプレート（グローバル・ローカルのどちらも対象）。 */
  match?: ExportTemplate;
  status: 'added' | 'changed' | 'unchanged';
}

const comparableTemplate = (t: ExportTemplate) => ({
  name: t.name,
  extension: t.extension,
  suffix: t.suffix,
  content: t.content,
  engine: t.engine ?? 'handlebars',
  importMapping: t.importMapping,
});

/** 取り込み元のテンプレートを名前で今のテンプレートと突き合わせる。 */
export function diffTemplates(
  currentTemplates: readonly ExportTemplate[],
  incoming: readonly ExportTemplate[],
): TemplateImportItem[] {
  return incoming.map((t) => {
    const match = currentTemplates.find((c) => c.name === t.name);
    if (!match) return { incoming: t, status: 'added' };
    const same = deepEqual(comparableTemplate(match), comparableTemplate(t));
    return { incoming: t, match, status: same ? 'unchanged' : 'changed' };
  });
}

export const defaultTemplateAction = (item: TemplateImportItem): TemplateAction =>
  item.status === 'added' ? 'add' : item.status === 'changed' ? 'overwrite' : 'skip';

/** 取り込み元のプロファイルを名前で今のプロファイルと突き合わせる。 */
export function diffProfiles(current: readonly ExportProfile[], incoming: readonly ExportProfile[]) {
  return diffByKey(current, incoming, (p) => p.name).filter(
    (d): d is ItemDiff<ExportProfile> => d.status !== 'removed',
  );
}

// ---------------------------------------------------------------------------
// 取り込み計画
// ---------------------------------------------------------------------------

export interface ProjectImportSelection {
  categories: ReadonlySet<ProjectImportCategoryId>;
  /** `optionSchema` で取り込む項目の ID（`schemaItemId`）。 */
  schemaAccepted: ReadonlySet<string>;
  /** 取り込み元のテンプレート ID → 処置。指定が無ければ既定（`defaultTemplateAction`）。 */
  templateActions: Readonly<Record<string, TemplateAction>>;
  /** 取り込むプロファイルの、取り込み元での ID。 */
  acceptedProfileIds: ReadonlySet<string>;
}

export interface ProjectImportContext {
  /** 今のプロジェクト（`buildProjectData` の結果）。 */
  current: StrictProjectData;
  /** 今使えるすべてのテンプレート（グローバルとローカル）。 */
  currentTemplates: readonly ExportTemplate[];
  /** インストール済みプラグインの ID。渡すと、無いプラグインを使うデータに警告を出す。 */
  installedPluginIds?: ReadonlySet<string>;
}

export interface ProjectImportPlan {
  /** `value` カテゴリが置き換えるプロジェクトデータ。 */
  settingsPatch: Partial<StrictProjectData>;
  /** マージ後のオプションスキーマ。`optionSchema` を選ばなかった（または取り込むものが無い）ときは null。 */
  optionsSchema: OptionsSchema | null;
  templates: { add: ExportTemplate[]; update: { id: string; template: ExportTemplate }[] };
  exportProfiles: { add: ExportProfile[]; update: { id: string; profile: ExportProfile }[] };
  data: {
    nodes: Record<string, WaypointNode>;
    rootNodeIds: string[];
    mapSources: MapSource[];
    mapLayers: ProjectMapLayer[];
    customLayers: CustomLayer[];
    layerOrder: string[];
    layerVisibilitySets: LayerVisibilitySet[];
    annotationObjects: AnnotationObject[];
    annotationGroups: Record<string, AnnotationGroup>;
    rootAnnotationIds: string[];
    exportRegions: ExportRegion[];
  };
  warnings: string[];
}

const RESERVED_REGION_SOURCE_IDS = new Set(['default', 'all']);

export function buildProjectImportPlan(
  ctx: ProjectImportContext,
  incoming: StrictProjectData,
  selection: ProjectImportSelection,
): ProjectImportPlan {
  const { current, currentTemplates } = ctx;
  const has = (id: ProjectImportCategoryId) => selection.categories.has(id);
  const warnings: string[] = [];
  const remapExec: ExecutionIdRemapper = createExecutionIdRemapper();

  const plan: ProjectImportPlan = {
    settingsPatch: {},
    optionsSchema: null,
    templates: { add: [], update: [] },
    exportProfiles: { add: [], update: [] },
    data: {
      nodes: {},
      rootNodeIds: [],
      mapSources: [],
      mapLayers: [],
      customLayers: [],
      layerOrder: [],
      layerVisibilitySets: [],
      annotationObjects: [],
      annotationGroups: {},
      rootAnnotationIds: [],
      exportRegions: [],
    },
    warnings,
  };

  // 1. 値ごと置き換える設定
  PROJECT_IMPORT_CATEGORIES.filter((c) => c.mode === 'value' && has(c.id)).forEach((c) => {
    Object.assign(plan.settingsPatch, pickCategoryValue(c, incoming));
  });

  // 2. オプションスキーマ
  if (has('optionSchema') && incoming.options_schema) {
    const diffs = diffOptionsSchema(current.options_schema, incoming.options_schema);
    plan.optionsSchema = mergeOptionsSchema(diffs, selection.schemaAccepted);
  }
  const finalSchema = plan.optionsSchema ?? current.options_schema;

  // 3. テンプレート。プロファイルが参照できるよう、取り込み元の ID → 取り込み後の ID を作る。
  const templateIdMap = new Map<string, string>();
  diffTemplates(currentTemplates, incoming.export_templates).forEach((item) => {
    const action = has('templates')
      ? (selection.templateActions[item.incoming.id] ?? defaultTemplateAction(item))
      : 'skip';
    if (action === 'add') {
      const id = uuidv4();
      const name = item.match ? `${item.incoming.name} (Imported)` : item.incoming.name;
      plan.templates.add.push({ ...structuredClone(item.incoming), id, name, scope: 'local' });
      templateIdMap.set(item.incoming.id, id);
    } else if (action === 'overwrite' && item.match) {
      plan.templates.update.push({
        id: item.match.id,
        template: { ...structuredClone(item.incoming), id: item.match.id, scope: item.match.scope },
      });
      templateIdMap.set(item.incoming.id, item.match.id);
    } else if (item.match) {
      templateIdMap.set(item.incoming.id, item.match.id);
    }
  });

  // 4. データ（ID を振り直して追加する）
  if (has('waypoints')) {
    const remapped = remapNodes(incoming.root_node_ids, incoming.nodes, remapExec);
    plan.data.nodes = remapped.nodes;
    plan.data.rootNodeIds = remapped.rootNodeIds;
  }
  if (has('annotations')) {
    const remapped = remapAnnotations(
      incoming.annotation_objects,
      incoming.annotation_groups,
      incoming.root_annotation_ids,
      remapExec,
    );
    plan.data.annotationObjects = remapped.objects;
    plan.data.annotationGroups = remapped.groups;
    plan.data.rootAnnotationIds = remapped.rootIds;
  }

  const regionIdMap = new Map<string, string>();
  if (has('exportRegions')) {
    const remapped = remapExportRegions(incoming.export_regions);
    plan.data.exportRegions = remapped.regions;
    remapped.idMap.forEach((v, k) => regionIdMap.set(k, v));
  } else {
    incoming.export_regions.forEach((r) => {
      const match = current.export_regions.find((c) => c.name === r.name);
      if (match) regionIdMap.set(r.id, match.id);
    });
  }

  const visibilitySetIdMap = new Map<string, string>();
  if (has('maps')) {
    const remapped = remapMaps(
      incoming.map_sources,
      incoming.map_layers,
      incoming.custom_layers,
      incoming.layer_order,
      incoming.layer_visibility_sets,
      remapExec,
    );
    plan.data.mapSources = remapped.mapSources;
    plan.data.mapLayers = remapped.mapLayers;
    plan.data.customLayers = remapped.customLayers;
    plan.data.layerOrder = remapped.layerOrder;
    plan.data.layerVisibilitySets = remapped.layerVisibilitySets;
    remapped.visibilitySetIdMap.forEach((v, k) => visibilitySetIdMap.set(k, v));
  } else {
    incoming.layer_visibility_sets.forEach((s) => {
      const match = current.layer_visibility_sets.find((c) => c.name === s.name);
      if (match) visibilitySetIdMap.set(s.id, match.id);
    });
  }

  // 5. エクスポートプロファイル。参照先は取り込み後の ID に付け替える。解決できない参照は無効にして知らせる。
  if (has('exportProfiles')) {
    const currentTemplateIds = new Set(currentTemplates.map((t) => t.id));
    const remapItem = (profileName: string, item: ExportTargetItem): ExportTargetItem => {
      const next: ExportTargetItem = { ...item, id: uuidv4() };
      const disable = (what: string) => {
        next.enabled = false;
        warnings.push(`プロファイル「${profileName}」の項目を無効にしました（${what}が見つかりません）。`);
      };
      if (item.type === 'waypoint_template') {
        const mapped =
          templateIdMap.get(item.sourceId) ?? (currentTemplateIds.has(item.sourceId) ? item.sourceId : null);
        if (mapped) next.sourceId = mapped;
        else disable('テンプレート');
      } else if (item.type === 'map_region' && !RESERVED_REGION_SOURCE_IDS.has(item.sourceId)) {
        const mapped = regionIdMap.get(item.sourceId);
        if (mapped) next.sourceId = mapped;
        else disable('エクスポート範囲');
      }
      if (item.visibilitySetId) {
        const mapped = visibilitySetIdMap.get(item.visibilitySetId);
        if (mapped) next.visibilitySetId = mapped;
        else {
          delete next.visibilitySetId;
          warnings.push(
            `プロファイル「${profileName}」のレイヤー表示セットが見つからないため、現在の表示を使うようにしました。`,
          );
        }
      }
      return next;
    };

    diffProfiles(current.export_profiles, incoming.export_profiles).forEach((d) => {
      const profile = d.incoming;
      if (!profile || !selection.acceptedProfileIds.has(profile.id)) return;
      const items = profile.items.map((item) => remapItem(profile.name, item));
      if (d.status === 'added') {
        plan.exportProfiles.add.push({ ...structuredClone(profile), id: uuidv4(), items });
      } else if (d.status === 'changed' && d.current) {
        plan.exportProfiles.update.push({
          id: d.current.id,
          profile: { ...structuredClone(profile), id: d.current.id, items },
        });
      }
    });
  }

  // 6. 取り込み先に無いプリセットへの参照は、取り込み元の値に展開する（残すと参照先が無く出力が壊れる）。
  inlineMissingPresets(plan, incoming.options_schema, finalSchema, warnings);

  // 7. インストールされていないプラグインへの警告
  if (ctx.installedPluginIds) {
    warnMissingPlugins(plan, ctx.installedPluginIds, warnings);
  }

  return plan;
}

function inlineMissingPresets(
  plan: ProjectImportPlan,
  incomingSchema: OptionsSchema | null,
  finalSchema: OptionsSchema | null,
  warnings: string[],
): void {
  if (!incomingSchema) return;
  const nodeIds = Object.keys(plan.data.nodes);
  const annotationCount = plan.data.annotationObjects.length;
  if (nodeIds.length === 0 && annotationCount === 0) return;

  const finalScopes = finalSchema ? collectPresetScopes(finalSchema) : new Map();
  const removals: { scope: string; name: string; value: OptionValue }[] = [];
  collectPresetScopes(incomingSchema).forEach((presets, scope) => {
    const known = new Set((finalScopes.get(scope) ?? []).map((p: { name: string }) => p.name));
    presets.forEach((p) => {
      if (!known.has(p.name)) removals.push({ scope, name: p.name, value: p.value });
    });
  });
  if (removals.length === 0) return;

  const lists: WaypointOptions[] = [
    ...nodeIds.map((id) => plan.data.nodes[id].options ?? {}),
    ...plan.data.annotationObjects.map((a) => a.options ?? {}),
  ];
  const result = inlineRemovedPresets(incomingSchema, lists, {}, removals);
  if (result.count === 0) return;

  nodeIds.forEach((id, i) => {
    if (plan.data.nodes[id].options)
      plan.data.nodes[id] = { ...plan.data.nodes[id], options: result.optionValuesList[i] };
  });
  plan.data.annotationObjects = plan.data.annotationObjects.map((a, i) =>
    a.options ? ({ ...a, options: result.optionValuesList[nodeIds.length + i] } as AnnotationObject) : a,
  );
  warnings.push(`取り込み先のスキーマに無いプリセットへの参照 ${result.count} 件を、プリセットの値に展開しました。`);
}

function warnMissingPlugins(plan: ProjectImportPlan, installed: ReadonlySet<string>, warnings: string[]): void {
  const missing = new Set<string>();
  Object.values(plan.data.nodes).forEach((n) => {
    if (n.plugin_id && !installed.has(n.plugin_id)) missing.add(n.plugin_id);
  });
  Object.values(plan.data.annotationGroups).forEach((g) => {
    if (g.plugin_id && !installed.has(g.plugin_id)) missing.add(g.plugin_id);
  });
  const calc = plan.settingsPatch.active_path_calculator_plugin_id ?? null;
  if (calc && !installed.has(calc)) missing.add(calc);
  if (missing.size > 0) {
    warnings.push(`インストールされていないプラグインを使うデータがあります: ${[...missing].join(', ')}`);
  }
}

/** プランが実際に何かを変更するか（空の計画を適用しないための判定）。 */
export function isPlanEmpty(plan: ProjectImportPlan): boolean {
  const d = plan.data;
  return (
    Object.keys(plan.settingsPatch).length === 0 &&
    plan.optionsSchema === null &&
    plan.templates.add.length === 0 &&
    plan.templates.update.length === 0 &&
    plan.exportProfiles.add.length === 0 &&
    plan.exportProfiles.update.length === 0 &&
    d.rootNodeIds.length === 0 &&
    d.mapLayers.length === 0 &&
    d.customLayers.length === 0 &&
    d.annotationObjects.length === 0 &&
    Object.keys(d.annotationGroups).length === 0 &&
    d.exportRegions.length === 0
  );
}
