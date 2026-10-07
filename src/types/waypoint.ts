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
  /** プラグインが付けた、再生成をまたいで同じ点を指す安定キー（スタッシュの照合に使う） */
  stash_key?: string;
}

export interface WaypointDiffItem {
  index: number;
  /** 照合に使った安定キー。キーを持たない生成物の差分では未設定（番号で照合する） */
  key?: string;
  hasTransformDiff: boolean;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  deltaYaw: number;
  modifiedOptions?: WaypointOptions;
  customName?: string;
}

export type GeneratorStash = Record<string | number, WaypointDiffItem>;

export interface GeneratorModificationSummary {
  hasModifications: boolean;
  modifiedCount: number;
  totalCurrent: number;
  totalBaseline: number;
  diffs: WaypointDiffItem[];
  hasCountChanged: boolean;
}

/**
 * ジェネレーターが置き換えた範囲（グループや入れ子のジェネレーターを含む部分木）の写し。
 * 「元に戻す」で階層ごと復元するために、初回実行時に取る。
 */
export interface SourceSnapshot {
  topLevelIds: string[];
  nodes: Record<string, WaypointNode>;
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
  /** `needs: ["waypoint_range"]` のジェネレーターが置き換えた元の部分木。「元に戻す」で使う */
  source_snapshot?: SourceSnapshot;
  pipeline_metadata?: PipelineMetadata;
};

export interface InsertionTarget {
  parentId: string | null;
  index: number;
}
