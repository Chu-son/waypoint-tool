export type ImportFieldMapping = {
  itemsPath?: string;
  id?: string;
  x: string;
  y: string;
  z?: string;
  yaw?: string;
  qx?: string;
  qy?: string;
  qz?: string;
  qw?: string;
  optionsPath?: string;
};

export type ExportTemplate = {
  id: string;
  name: string;
  extension: string;
  suffix: string;
  content: string;
  scope?: 'global' | 'local';
  importMapping?: ImportFieldMapping;
};

export type DefaultExportFormat = {
  id: string; // e.g. '__default_yaml__'
  name: string;
  extension: string;
  suffix: string;
  enabled: boolean;
};

export type ExportTargetType = 'waypoint_template' | 'waypoint_default' | 'map_region' | 'map_all_regions';

export type ConflictResolution = 'overwrite' | 'backup_file';

export interface ExportTargetItem {
  id: string;
  type: ExportTargetType;
  sourceId: string;
  relativePathPattern: string;
  mapFormat?: 'ros_standard' | 'png_only';
  includeMapImage?: boolean;
  enabled: boolean;
}

export interface ExportProfile {
  id: string;
  name: string;
  description?: string;
  outputRootDir?: string;
  conflictResolution: ConflictResolution;
  items: ExportTargetItem[];
}
