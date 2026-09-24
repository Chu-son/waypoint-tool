/**
 * Pure construction of the backend "export package" request from an export profile.
 */
import type { ExportRegion, ExportTargetItem, ExportTemplate } from '../types/store';
import type { PackageExportMapItem, PackageExportWaypointItem } from '../api/types';
import type { ResolvedExportFile } from './exportTemplateEngine';

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
  waypoints: Record<string, any>[];
  mapLayers: PackageExportMapItem['layers'];
  /** Canvas screenshot (base64 PNG) for items with `includeMapImage`. */
  mapImageB64?: string;
}

const mapItemFor = (
  item: ExportTargetItem,
  region: ExportRegion,
  file: ResolvedExportFile,
  layers: PackageExportMapItem['layers'],
): PackageExportMapItem => ({
  save_path: file.fullPath.replace(/\.(pgm|png)$/i, ''),
  format: item.mapFormat || 'ros_standard',
  region: { name: region.name, rect: region.rect, layerVisibility: {} },
  layers,
});

/** Turns enabled profile items into the waypoint files and map region exports the backend writes. */
export function buildExportPackageItems(input: ExportPackageInput): {
  waypointItems: PackageExportWaypointItem[];
  mapItems: PackageExportMapItem[];
} {
  const { enabledItems, resolvedFiles, templates, regions, waypoints, mapLayers, mapImageB64 } = input;
  const waypointItems: PackageExportWaypointItem[] = [];
  const mapItems: PackageExportMapItem[] = [];
  const primaryFileOf = (item: ExportTargetItem) =>
    resolvedFiles.find((f) => f.item.id === item.id && !f.isPairSecondary);

  for (const item of enabledItems) {
    if (item.type === 'waypoint_template' || item.type === 'waypoint_default') {
      const file = primaryFileOf(item);
      if (!file) continue;
      waypointItems.push({
        path: file.fullPath,
        waypoints,
        template:
          item.type === 'waypoint_template' ? templates.find((t) => t.id === item.sourceId)?.content : undefined,
        image_data_b64: item.includeMapImage ? mapImageB64 : undefined,
      });
    } else if (item.type === 'map_all_regions') {
      for (const region of regions) {
        const file = resolvedFiles.find(
          (f) => f.item.id === item.id && !f.isPairSecondary && f.fileName.startsWith(region.name),
        );
        if (file) mapItems.push(mapItemFor(item, region, file, mapLayers));
      }
    } else if (item.type === 'map_region') {
      const region = regions.find((r) => r.id === item.sourceId);
      const file = primaryFileOf(item);
      if (region && file) mapItems.push(mapItemFor(item, region, file, mapLayers));
    }
  }

  return { waypointItems, mapItems };
}
