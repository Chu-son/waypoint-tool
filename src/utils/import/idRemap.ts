import { v4 as uuidv4 } from 'uuid';
import type { AnnotationGroup, AnnotationObject } from '../../types/annotation';
import type { CustomLayer, ExportRegion, LayerVisibilitySet, MapSource, ProjectMapLayer } from '../../types/layer';
import type { PipelineMetadata } from '../../types/pipeline';
import type { WaypointNode } from '../../types/waypoint';
import { remapHierarchicalIds } from '../mapElementTreeUtils';

/**
 * 取り込み元プロジェクトのデータを今のプロジェクトへ足すときの ID 付け替え。
 * 取り込み元と今のプロジェクトは、片方をコピーして作られている場合など ID が衝突しうるため、
 * 取り込むものはすべて新しい ID を振り、それを指している参照（子・親・ソース・レイヤー順・表示セットなど）も付け替える。
 */

/** 生成実行 ID（`source_execution_id` など）を、同じ元 ID なら同じ新 ID に付け替える関数。 */
export type ExecutionIdRemapper = (id: string) => string;

export function createExecutionIdRemapper(): ExecutionIdRemapper {
  const issued = new Map<string, string>();
  return (id) => {
    let next = issued.get(id);
    if (!next) {
      next = uuidv4();
      issued.set(id, next);
    }
    return next;
  };
}

function remapPipelineMetadata(meta: PipelineMetadata, remapExec: ExecutionIdRemapper): PipelineMetadata {
  return {
    ...meta,
    pipeline_execution_id: remapExec(meta.pipeline_execution_id),
    step_execution_id: remapExec(meta.step_execution_id),
  };
}

/** `source_execution_id` と `pipeline_metadata` の実行 ID を付け替える（元のオブジェクトは変更しない）。 */
function remapExecutionFields<T extends { source_execution_id?: string; pipeline_metadata?: PipelineMetadata }>(
  item: T,
  remapExec: ExecutionIdRemapper,
): T {
  const next = { ...item };
  if (next.source_execution_id) next.source_execution_id = remapExec(next.source_execution_id);
  if (next.pipeline_metadata) next.pipeline_metadata = remapPipelineMetadata(next.pipeline_metadata, remapExec);
  return next;
}

export interface RemappedNodes {
  nodes: Record<string, WaypointNode>;
  rootNodeIds: string[];
}

/** ルートから辿れるノードだけを、新しい ID で複製する。 */
export function remapNodes(
  rootNodeIds: readonly string[],
  nodes: Record<string, WaypointNode>,
  remapExec: ExecutionIdRemapper,
): RemappedNodes {
  const result = remapHierarchicalIds([...rootNodeIds], nodes, {
    onCloneItem: (cloned) => {
      if (cloned.source_execution_id) cloned.source_execution_id = remapExec(cloned.source_execution_id);
      if (cloned.pipeline_metadata)
        cloned.pipeline_metadata = remapPipelineMetadata(cloned.pipeline_metadata, remapExec);
    },
  });
  return { nodes: result.newItems, rootNodeIds: result.newTopLevelIds };
}

export interface RemappedAnnotations {
  objects: AnnotationObject[];
  groups: Record<string, AnnotationGroup>;
  rootIds: string[];
}

/** アノテーションのオブジェクトとグループに新しい ID を振り、`children_ids` / `parent_id` / `group_id` を付け替える。 */
export function remapAnnotations(
  objects: readonly AnnotationObject[],
  groups: Record<string, AnnotationGroup>,
  rootIds: readonly string[],
  remapExec: ExecutionIdRemapper,
): RemappedAnnotations {
  const idMap = new Map<string, string>();
  objects.forEach((o) => idMap.set(o.id, uuidv4()));
  Object.keys(groups).forEach((id) => idMap.set(id, uuidv4()));
  const mapId = (id: string): string | undefined => idMap.get(id);
  const mapIds = (ids: readonly string[]): string[] => ids.map(mapId).filter((id): id is string => id !== undefined);

  const newObjects = objects.map((o) => {
    const next = remapExecutionFields({ ...o, id: mapId(o.id)! }, remapExec);
    next.group_id = o.group_id ? mapId(o.group_id) : undefined;
    return next as AnnotationObject;
  });

  const newGroups: Record<string, AnnotationGroup> = {};
  Object.values(groups).forEach((g) => {
    const id = mapId(g.id)!;
    const next = remapExecutionFields({ ...g, id }, remapExec);
    next.children_ids = mapIds(g.children_ids ?? []);
    next.parent_id = g.parent_id ? mapId(g.parent_id) : undefined;
    newGroups[id] = next;
  });

  return { objects: newObjects, groups: newGroups, rootIds: mapIds(rootIds) };
}

export interface RemappedMaps {
  mapSources: MapSource[];
  mapLayers: ProjectMapLayer[];
  customLayers: CustomLayer[];
  /** 取り込んだレイヤー（マップとカスタム）の ID を上から順に並べたもの。 */
  layerOrder: string[];
  layerVisibilitySets: LayerVisibilitySet[];
  /** 旧表示セット ID → 新 ID。エクスポートプロファイルの参照付け替えに使う。 */
  visibilitySetIdMap: Map<string, string>;
}

/** マップ（ソースとインスタンス）、カスタムレイヤー、レイヤー表示セットを新しい ID で複製する。 */
export function remapMaps(
  mapSources: readonly MapSource[],
  mapLayers: readonly ProjectMapLayer[],
  customLayers: readonly CustomLayer[],
  layerOrder: readonly string[],
  visibilitySets: readonly LayerVisibilitySet[],
  remapExec: ExecutionIdRemapper,
): RemappedMaps {
  const sourceIdMap = new Map(mapSources.map((s) => [s.id, uuidv4()]));
  const layerIdMap = new Map<string, string>();
  mapLayers.forEach((l) => layerIdMap.set(l.id, uuidv4()));
  customLayers.forEach((l) => layerIdMap.set(l.id, uuidv4()));

  const newSources = mapSources.map((s) => ({ ...s, id: sourceIdMap.get(s.id)! }));
  const newLayers: ProjectMapLayer[] = mapLayers
    .filter((l) => sourceIdMap.has(l.sourceId))
    .map((l) => ({
      ...structuredClone(l),
      id: layerIdMap.get(l.id)!,
      sourceId: sourceIdMap.get(l.sourceId)!,
    }));
  const newCustomLayers = customLayers.map((l) =>
    remapExecutionFields({ ...structuredClone(l), id: layerIdMap.get(l.id)! }, remapExec),
  ) as CustomLayer[];

  const importedIds = new Set([...newLayers.map((l) => l.id), ...newCustomLayers.map((l) => l.id)]);
  const order = layerOrder.map((id) => layerIdMap.get(id)).filter((id): id is string => !!id && importedIds.has(id));
  // layer_order に載っていないレイヤーも、取りこぼさないよう末尾に足す。
  importedIds.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });

  const visibilitySetIdMap = new Map<string, string>();
  const newSets = visibilitySets.map((set) => {
    const id = uuidv4();
    visibilitySetIdMap.set(set.id, id);
    const visibility: Record<string, boolean> = {};
    Object.entries(set.visibility).forEach(([layerId, visible]) => {
      const mapped = layerIdMap.get(layerId);
      if (mapped && importedIds.has(mapped)) visibility[mapped] = visible;
    });
    return { ...set, id, visibility };
  });

  return {
    mapSources: newSources,
    mapLayers: newLayers,
    customLayers: newCustomLayers,
    layerOrder: order,
    layerVisibilitySets: newSets,
    visibilitySetIdMap,
  };
}

export interface RemappedRegions {
  regions: ExportRegion[];
  /** 旧リージョン ID → 新 ID。 */
  idMap: Map<string, string>;
}

export function remapExportRegions(regions: readonly ExportRegion[]): RemappedRegions {
  const idMap = new Map<string, string>();
  const next = regions.map((r) => {
    const id = uuidv4();
    idMap.set(r.id, id);
    return { ...structuredClone(r), id };
  });
  return { regions: next, idMap };
}
