import { Braces, FileCode, FolderInput, Map as MapIcon, MapPin, Puzzle, type LucideIcon } from 'lucide-react';
import type { ImportCategory } from '../../../../types/modal';

export interface ImportCategoryInfo {
  id: ImportCategory;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** インポートの入口に並べる、取り込める対象の種類。 */
export const IMPORT_CATEGORIES: readonly ImportCategoryInfo[] = [
  {
    id: 'waypoints',
    label: 'Waypoints',
    description: 'Add waypoints from a YAML or JSON file, using an export template to read its fields.',
    icon: MapPin,
  },
  {
    id: 'project',
    label: 'From Another Project',
    description:
      'Pick settings and data to bring in from a project file (.wptroj): option schema, templates, robot, waypoints, maps and more.',
    icon: FolderInput,
  },
  {
    id: 'optionSchema',
    label: 'Option Schema',
    description: 'Load an option schema file and choose which options, globals and definitions to take over.',
    icon: Braces,
  },
  {
    id: 'template',
    label: 'Export Template',
    description: 'Load a template file (.wpt_template). If one with the same name exists, review the changes first.',
    icon: FileCode,
  },
  {
    id: 'map',
    label: 'Map',
    description: 'Add a ROS map (YAML) or an image map as a new layer.',
    icon: MapIcon,
  },
  {
    id: 'plugins',
    label: 'Plugins',
    description: 'Install plugins from a folder.',
    icon: Puzzle,
  },
];

export const getImportCategory = (id: ImportCategory): ImportCategoryInfo =>
  IMPORT_CATEGORIES.find((c) => c.id === id)!;
