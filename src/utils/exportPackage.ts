/**
 * Pure construction of the backend "export package" request from an export profile.
 */
import type { ExportRegion, ExportTargetItem, ExportTemplate, LayerVisibilitySet } from '../types/store';
import type { PackageExportMapItem, PackageExportWaypointItem } from '../api/types';
import type { ResolvedExportFile } from './exportTemplateEngine';
import type { LayerStack } from './layerStack';
import { currentLayerVisibility, resolveSetVisibility, undecidedLayerIds } from './layerVisibilitySets';

type StackLayers = Pick<LayerStack, 'mapLayers' | 'customLayers'>;

const isMapItem = (item: ExportTargetItem) => item.type === 'map_region' || item.type === 'map_all_regions';

/** Which layers a map item draws: those its layer visibility set shows, or the current display when it names none. */
function layerVisibilityFor(
  item: ExportTargetItem,
  sets: LayerVisibilitySet[],
  stack: StackLayers,
): Record<string, boolean> {
  const set = sets.find((s) => s.id === item.visibilitySetId);
  return set ? resolveSetVisibility(set, stack) : currentLayerVisibility(stack);
}

export interface MapVisibilityProblems {
  /** Path patterns of map items whose layer visibility set has been deleted. */
  missingSetPatterns: string[];
  /** Sets used by map items that do not cover some layers an export would draw. */
  undecided: { setName: string; count: number }[];
}

/**
 * Problems with the layer visibility sets that enabled map items name. A missing set cannot be exported
 * (silently drawing the current display instead could put obstacles into a map meant to have none); a set
 * that does not cover a layer draws that layer as it is shown now, which the user should confirm.
 */
export function findMapVisibilityProblems(
  items: ExportTargetItem[],
  sets: LayerVisibilitySet[],
  stack: StackLayers,
): MapVisibilityProblems {
  const problems: MapVisibilityProblems = { missingSetPatterns: [], undecided: [] };
  const seenSets = new Set<string>();
  for (const item of items.filter(isMapItem)) {
    if (item.visibilitySetId === undefined) continue;
    const set = sets.find((s) => s.id === item.visibilitySetId);
    if (!set) {
      problems.missingSetPatterns.push(item.relativePathPattern);
      continue;
    }
    if (seenSets.has(set.id)) continue;
    seenSets.add(set.id);
    const count = undecidedLayerIds(set, stack, { exportableOnly: true }).length;
    if (count > 0) problems.undecided.push({ setName: set.name, count });
  }
  return problems;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYYMMDD_HHmmss` in local time, used to name backups of overwritten files. */
export function formatSessionTimestamp(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export interface ExportPackageInput {
  enabledItems: ExportTargetItem[];
  /** Output of resolveExportFiles for `enabledItems`. */
  resolvedFiles: ResolvedExportFile[];
  templates: ExportTemplate[];
  regions: ExportRegion[];
  /** Sets that map items may name, and the layers they apply to (for the visibility of the current display). */
  visibilitySets: LayerVisibilitySet[];
  layerStack: StackLayers;
  waypoints: Record<string, any>[];
  /** Every layer a map item might draw, hidden ones included; each item picks its own with its visibility. */
  mapLayers: PackageExportMapItem['layers'];
  /** Canvas screenshot (base64 PNG) for items with `includeMapImage`. */
  mapImageB64?: string;
}

const mapItemFor = (
  item: ExportTargetItem,
  region: ExportRegion,
  file: ResolvedExportFile,
  layers: PackageExportMapItem['layers'],
  layerVisibility: Record<string, boolean>,
): PackageExportMapItem => ({
  save_path: file.fullPath.replace(/\.(pgm|png)$/i, ''),
  format: item.mapFormat || 'ros_standard',
  region: { name: region.name, rect: region.rect, layerVisibility },
  layers,
});

/** Turns enabled profile items into the waypoint files and map region exports the backend writes. */
export function buildExportPackageItems(input: ExportPackageInput): {
  waypointItems: PackageExportWaypointItem[];
  mapItems: PackageExportMapItem[];
} {
  const {
    enabledItems,
    resolvedFiles,
    templates,
    regions,
    visibilitySets,
    layerStack,
    waypoints,
    mapLayers,
    mapImageB64,
  } = input;
  const waypointItems: PackageExportWaypointItem[] = [];
  const mapItems: PackageExportMapItem[] = [];
  const primaryFileOf = (item: ExportTargetItem) =>
    resolvedFiles.find((f) => f.item.id === item.id && !f.isPairSecondary);

  for (const item of enabledItems) {
    if (item.type === 'waypoint_template' || item.type === 'waypoint_default') {
      const file = primaryFileOf(item);
      if (!file) continue;
      const matchedTemplate =
        item.type === 'waypoint_template' ? templates.find((t) => t.id === item.sourceId) : undefined;
      waypointItems.push({
        path: file.fullPath,
        waypoints,
        template: matchedTemplate?.content,
        engine: matchedTemplate?.engine,
        image_data_b64: item.includeMapImage ? mapImageB64 : undefined,
      });
    } else if (item.type === 'map_all_regions') {
      for (const region of regions) {
        const file = resolvedFiles.find(
          (f) => f.item.id === item.id && !f.isPairSecondary && f.fileName.startsWith(region.name),
        );
        if (file)
          mapItems.push(
            mapItemFor(item, region, file, mapLayers, layerVisibilityFor(item, visibilitySets, layerStack)),
          );
      }
    } else if (item.type === 'map_region') {
      const region = regions.find((r) => r.id === item.sourceId);
      const file = primaryFileOf(item);
      if (region && file) {
        mapItems.push(mapItemFor(item, region, file, mapLayers, layerVisibilityFor(item, visibilitySets, layerStack)));
      }
    }
  }

  return { waypointItems, mapItems };
}
