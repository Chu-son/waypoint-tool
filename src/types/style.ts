// --- Conditional Styling Types ---
export type TargetElementType = 'waypoint' | 'path' | 'footprint' | 'annotation';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'between'
  | 'contains'
  | 'in'
  | 'is_empty'
  | 'is_not_empty';

export interface ConditionRule {
  id: string;
  type: 'rule';
  property: string; // e.g. "options.speed", "name", "type", "index"
  operator: ConditionOperator;
  value: any;
  secondValue?: any; // For 'between' operator
}

export interface ConditionGroup {
  id: string;
  type: 'group';
  logicalOperator: 'and' | 'or';
  children: Array<ConditionRule | ConditionGroup>;
}

export type WaypointShape = 'default' | 'circle' | 'square' | 'diamond' | 'star';

export interface WaypointStyleOverride {
  color?: string;
  fillColor?: string;
  scale?: number;
  opacity?: number;
  shape?: WaypointShape;
  labelVisible?: boolean;
}

export interface PathStyleOverride {
  color?: string;
  width?: number;
  widthFromOption?: string; // optionsの値を直接線幅(m)として適用
  opacity?: number;
  dashPattern?: 'solid' | 'dashed' | 'dotted';
  direction?: 'outgoing' | 'incoming';
}

export interface FootprintStyleOverride {
  visibleMode?: 'default' | 'force_show' | 'force_hide';
  sizeMode?: 'default' | 'scale' | 'custom_value' | 'from_option';
  scale?: number;
  customRadius?: number;
  customLength?: number;
  customWidth?: number;
  sizeOptionKey?: string; // optionsの値を寸法(m)として参照
  strokeColor?: string;
  fillColor?: string;
  fillAlpha?: number;
  strokeWidth?: number;
}

export interface AnnotationStyleOverride {
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
  visible?: boolean;
}

export interface ConditionalStyleRule {
  id: string;
  name: string;
  targetElement: TargetElementType;
  enabled: boolean;
  stopIfMatched: boolean; // マッチした場合に以降のルール評価を停止
  condition: ConditionGroup; // ネスト可能な条件グループ
  style: {
    waypoint?: WaypointStyleOverride;
    path?: PathStyleOverride;
    footprint?: FootprintStyleOverride;
    annotation?: AnnotationStyleOverride;
  };
}
