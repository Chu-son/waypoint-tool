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

/** エクスポートテンプレートのレンダリングエンジン。省略時（旧プロジェクトのテンプレート）は後方互換のため Handlebars。 */
export type TemplateEngine = 'handlebars' | 'jinja';

export type ExportTemplate = {
  id: string;
  name: string;
  extension: string;
  suffix: string;
  content: string;
  scope?: 'global' | 'local';
  importMapping?: ImportFieldMapping;
  /** 省略時は 'handlebars'（後方互換）。新規作成するテンプレートの既定は 'jinja'。 */
  engine?: TemplateEngine;
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
  /** Map items only: the layer visibility set that decides which layers are drawn. Absent means the current display. */
  visibilitySetId?: string;
  /** Map items only: also list the output maps in a text file in the same directory. Absent means no list. */
  mapList?: ExportMapList;
  enabled: boolean;
}

/** How an existing list file is treated: `append` adds only the names it lacks, `conflict_setting` follows the profile. */
export type MapListExisting = 'append' | 'conflict_setting';

export interface ExportMapList {
  fileName: string;
  existing: MapListExisting;
}

export interface ExportProfile {
  id: string;
  name: string;
  description?: string;
  outputRootDir?: string;
  conflictResolution: ConflictResolution;
  items: ExportTargetItem[];
}
