import type { WaypointOptions } from './options';
import type { PipelineMetadata } from './pipeline';

export type AnnotationType = 'point' | 'oriented_point' | 'line' | 'rect' | 'circle';

export interface AnnotationBase {
  id: string;
  name: string;
  type: AnnotationType;
  visible: boolean;
  labelVisible: boolean;
  color?: string; // HEX color (e.g. '#3B82F6')
  group_id?: string; // 親グループID（存在する場合）
  options?: WaypointOptions; // カスタムオプション
  source_execution_id?: string;
  plugin_data?: Record<string, any>;
  pipeline_metadata?: PipelineMetadata;
}

export interface PointAnnotation extends AnnotationBase {
  type: 'point';
  x: number;
  y: number;
}

export interface OrientedPointAnnotation extends AnnotationBase {
  type: 'oriented_point';
  x: number;
  y: number;
  yaw: number; // radians
}

export interface LineAnnotation extends AnnotationBase {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  showLength?: boolean;
}

export interface RectAnnotation extends AnnotationBase {
  type: 'rect';
  cx: number;
  cy: number;
  width: number;
  height: number;
  angle: number; // radians
}

export interface CircleAnnotation extends AnnotationBase {
  type: 'circle';
  cx: number;
  cy: number;
  radius: number;
}

export type AnnotationObject =
  PointAnnotation | OrientedPointAnnotation | LineAnnotation | RectAnnotation | CircleAnnotation;

export interface AnnotationGroup {
  id: string;
  name: string;
  type: 'generator' | 'manual_group';
  visible: boolean;
  color?: string;
  children_ids: string[];
  parent_id?: string;
  plugin_id?: string;
  source_execution_id?: string;
  generator_params?: Record<string, any>;
  plugin_data?: Record<string, any>;
  pipeline_metadata?: PipelineMetadata;
}
