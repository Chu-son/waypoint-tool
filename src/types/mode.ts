import { AnnotationToolType } from '../stores/slices/annotationSlice';
import { ElementCopyField, ElementCopyCoordSystem } from '../stores/slices/uiSlice';

export type AppModeState =
  | { mode: 'select' }
  | {
      mode: 'waypoint_add';
      snapInput: string;
      lockedWaypointId: string | null;
      forcedAxis: 'X' | 'Y' | null;
      forcedSign: 1 | -1 | null;
    }
  | {
      mode: 'generator_add';
      pluginId: string | null;
    }
  | {
      mode: 'annotation_edit';
      subTool: AnnotationToolType;
      targetGroupId: string | null;
    }
  | {
      mode: 'custom_layer_edit';
      subTool: 'rect' | 'circle' | 'freehand' | 'line';
      targetLayerId: string;
      fillValue: number;
      brushSize: number;
    }
  | { mode: 'export_region_edit' }
  | {
      mode: 'plugin_interaction';
      pluginId: string;
      inputKey: string;
    }
  | {
      mode: 'element_paste';
      field: ElementCopyField;
      value: number;
      coordSystem: ElementCopyCoordSystem;
      previewNodeId: string | null;
    }
  | { mode: 'measure' };

export type AppModeTransition =
  | { mode: 'select' }
  | {
      mode: 'waypoint_add';
      snapInput?: string;
      lockedWaypointId?: string | null;
      forcedAxis?: 'X' | 'Y' | null;
      forcedSign?: 1 | -1 | null;
    }
  | {
      mode: 'generator_add';
      pluginId?: string | null;
    }
  | {
      mode: 'annotation_edit';
      subTool?: AnnotationToolType;
      targetGroupId?: string | null;
    }
  | {
      mode: 'custom_layer_edit';
      targetLayerId: string;
      subTool?: 'rect' | 'circle' | 'freehand' | 'line';
      fillValue?: number;
      brushSize?: number;
    }
  | { mode: 'export_region_edit' }
  | {
      mode: 'plugin_interaction';
      pluginId: string;
      inputKey: string;
    }
  | {
      mode: 'element_paste';
      field: ElementCopyField;
      value: number;
      coordSystem: ElementCopyCoordSystem;
      previewNodeId?: string | null;
    }
  | { mode: 'measure' };
