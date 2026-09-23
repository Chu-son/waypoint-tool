import type { Transform } from './geometry';
import type { WaypointOptions } from './options';
import type { PipelineMetadata } from './pipeline';

export interface GeneratorMetadata {
  /** 1回の生成セッションを一意に識別するUUID。複合出力されたオブジェクト間で共有される */
  source_execution_id?: string;
  /** 実行されたプラグインのID */
  plugin_id?: string;
  /** 実行時に渡されたパラメータおよびインタラクション入力のスナップショット */
  generator_params?: {
    properties?: Record<string, any>;
    interaction_data?: Record<string, any>;
    [key: string]: any;
  };
  /** プラグインが出力した内部計算データ（ベクトル場、探索グラフ、数値メトリクスなど） */
  plugin_data?: Record<string, any>;
}

export interface WaypointBaselineItem {
  transform: Transform;
  options?: WaypointOptions;
  name?: string;
}

export interface WaypointDiffItem {
  index: number;
  hasTransformDiff: boolean;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  deltaYaw: number;
  modifiedOptions?: WaypointOptions;
  customName?: string;
}

export type GeneratorStash = Record<number, WaypointDiffItem>;

export interface GeneratorModificationSummary {
  hasModifications: boolean;
  modifiedCount: number;
  totalCurrent: number;
  totalBaseline: number;
  diffs: WaypointDiffItem[];
  hasCountChanged: boolean;
}

export type WaypointNode = {
  id: string;
  type: 'manual' | 'generator' | 'manual_group' | 'group';
  name?: string;
  transform?: Transform;
  generator_params?: Record<string, any>;
  options?: WaypointOptions;
  children_ids?: string[];
  plugin_id?: string; // Add plugin reference for generator nodes
  source_execution_id?: string;
  plugin_data?: Record<string, any>;
  baseline_waypoints?: WaypointBaselineItem[];
  pipeline_metadata?: PipelineMetadata;
};

export interface InsertionTarget {
  parentId: string | null;
  index: number;
}
