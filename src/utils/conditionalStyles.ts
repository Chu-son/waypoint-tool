import {
  ConditionalStyleRule,
  ConditionGroup,
  ConditionRule,
  OptionsSchema,
  WaypointNode,
  AnnotationObject,
  RobotFootprint,
  WaypointShape,
} from '../types/store';
import { quaternionToYaw } from './transformUtils';

// ============================================================================
// Types
// ============================================================================

export interface ResolvedWaypointStyle {
  color?: string;
  fillColor?: string;
  scale?: number;
  opacity?: number;
  shape?: WaypointShape;
  labelVisible?: boolean;
}

export interface ResolvedPathStyle {
  color?: string;
  width?: number;
  opacity?: number;
  dashPattern?: 'solid' | 'dashed' | 'dotted';
}

export interface ResolvedFootprintStyle {
  shouldRender: boolean;
  visibleMode?: 'default' | 'force_show' | 'force_hide';
  footprint: RobotFootprint | null;
  strokeColor?: string;
  fillColor?: string;
  fillAlpha?: number;
  strokeWidth?: number;
}

export interface ResolvedAnnotationStyle {
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
  visible?: boolean;
}

// ============================================================================
// Safe Utility Helpers
// ============================================================================

/**
 * 16進数カラーコード（#RRGGBB または #RGB）を安全に PixiJS 用の数値（0xRRGGBB）に変換する。
 * 不正な値の場合は defaultColor を返す。
 */
export function parseColorSafe(hex?: string, defaultColor: number = 0xffa500): number {
  if (!hex || typeof hex !== 'string') return defaultColor;
  const cleanHex = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{3,8}$/.test(cleanHex)) return defaultColor;
  if (cleanHex.length === 3) {
    const r = cleanHex[0] + cleanHex[0];
    const g = cleanHex[1] + cleanHex[1];
    const b = cleanHex[2] + cleanHex[2];
    return parseInt(r + g + b, 16) || defaultColor;
  }
  const parsed = parseInt(cleanHex.slice(0, 6), 16);
  return isNaN(parsed) ? defaultColor : parsed;
}

/**
 * 数値を [min, max] の範囲にクランプする。無効値の場合は defaultVal を返す。
 */
export function clampNumber(val: any, min: number, max: number, defaultVal: number): number {
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return defaultVal;
  return Math.max(min, Math.min(max, num));
}

/**
 * PixiJS Graphics 上に破線を描画する幾何計算ユーティリティ。
 */
export function drawDashedLine(
  g: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashLength: number = 0.1,
  gapLength: number = 0.05
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.0001) return;

  const ux = dx / dist;
  const uy = dy / dist;

  let currentDist = 0;
  let drawing = true;

  while (currentDist < dist) {
    const segLen = drawing ? dashLength : gapLength;
    const nextDist = Math.min(currentDist + segLen, dist);

    const startX = x1 + ux * currentDist;
    const startY = y1 + uy * currentDist;
    const endX = x1 + ux * nextDist;
    const endY = y1 + uy * nextDist;

    if (drawing) {
      g.moveTo(startX, startY);
      g.lineTo(endX, endY);
    }

    currentDist = nextDist;
    drawing = !drawing;
  }
}

// ============================================================================
// Property Extraction & Default Value Resolution
// ============================================================================

/**
 * ノードまたはアノテーションから指定のプロパティ値を安全に取得する。
 * 未設定のオプションの場合は OptionSchema の default 値をフォールバック解決する。
 */
export function resolvePropertyValue(
  target: any,
  propPath: string,
  optionsSchema?: OptionsSchema | null,
  context?: { index?: number }
): any {
  if (!target || !propPath) return undefined;

  // 1. Index property
  if (propPath === 'index') {
    return context?.index !== undefined ? context.index : undefined;
  }

  // 2. Options property (e.g. "options.speed")
  if (propPath.startsWith('options.')) {
    const optKey = propPath.slice(8);
    let val = target.options?.[optKey];
    if (val === undefined && optionsSchema?.options) {
      const optDef = optionsSchema.options.find((o) => o.name === optKey);
      if (optDef && optDef.default !== undefined) {
        val = optDef.default;
      }
    }
    return val;
  }

  // 3. Transform properties (e.g. "transform.x", "transform.yaw")
  if (propPath.startsWith('transform.') && target.transform) {
    const sub = propPath.slice(10);
    if (sub === 'x') return target.transform.x;
    if (sub === 'y') return target.transform.y;
    if (sub === 'z') return target.transform.z ?? 0;
    if (sub === 'yaw') return quaternionToYaw(target.transform);
    return target.transform[sub];
  }

  // 4. Geometry coordinates for annotations (x, y, cx, cy, width, height, radius, yaw, x1, y1, x2, y2)
  if (propPath in target) {
    return target[propPath];
  }

  // 5. Nested object dot path fallback
  const parts = propPath.split('.');
  let current = target;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

// ============================================================================
// Condition Evaluation Engine
// ============================================================================

/**
 * 単一の ConditionRule を評価する。
 */
export function evaluateRule(
  rule: ConditionRule,
  target: any,
  optionsSchema?: OptionsSchema | null,
  context?: { index?: number }
): boolean {
  if (!rule || !rule.property) return true;

  const actualValue = resolvePropertyValue(target, rule.property, optionsSchema, context);
  const targetValue = rule.value;

  switch (rule.operator) {
    case 'is_empty':
      return actualValue === undefined || actualValue === null || actualValue === '' || (Array.isArray(actualValue) && actualValue.length === 0);

    case 'is_not_empty':
      return actualValue !== undefined && actualValue !== null && actualValue !== '' && (!Array.isArray(actualValue) || actualValue.length > 0);

    case 'equals': {
      if (actualValue === undefined || actualValue === null) {
        return targetValue === undefined || targetValue === null || targetValue === '';
      }
      if (typeof actualValue === 'boolean') {
        return actualValue === (targetValue === true || targetValue === 'true');
      }
      if (typeof actualValue === 'number') {
        return Number(actualValue) === Number(targetValue);
      }
      return String(actualValue).toLowerCase() === String(targetValue).toLowerCase();
    }

    case 'not_equals': {
      if (actualValue === undefined || actualValue === null) {
        return targetValue !== undefined && targetValue !== null && targetValue !== '';
      }
      if (typeof actualValue === 'boolean') {
        return actualValue !== (targetValue === true || targetValue === 'true');
      }
      if (typeof actualValue === 'number') {
        return Number(actualValue) !== Number(targetValue);
      }
      return String(actualValue).toLowerCase() !== String(targetValue).toLowerCase();
    }

    case 'greater_than': {
      const a = Number(actualValue);
      const b = Number(targetValue);
      if (isNaN(a) || isNaN(b)) return false;
      return a > b;
    }

    case 'greater_than_or_equal': {
      const a = Number(actualValue);
      const b = Number(targetValue);
      if (isNaN(a) || isNaN(b)) return false;
      return a >= b;
    }

    case 'less_than': {
      const a = Number(actualValue);
      const b = Number(targetValue);
      if (isNaN(a) || isNaN(b)) return false;
      return a < b;
    }

    case 'less_than_or_equal': {
      const a = Number(actualValue);
      const b = Number(targetValue);
      if (isNaN(a) || isNaN(b)) return false;
      return a <= b;
    }

    case 'between': {
      const a = Number(actualValue);
      const min = Number(targetValue);
      const max = Number(rule.secondValue);
      if (isNaN(a) || isNaN(min) || isNaN(max)) return false;
      return a >= Math.min(min, max) && a <= Math.max(min, max);
    }

    case 'contains': {
      if (actualValue === undefined || actualValue === null) return false;
      if (Array.isArray(actualValue)) {
        return actualValue.some((item) => String(item).toLowerCase().includes(String(targetValue).toLowerCase()));
      }
      return String(actualValue).toLowerCase().includes(String(targetValue).toLowerCase());
    }

    case 'in': {
      if (actualValue === undefined || actualValue === null) return false;
      const list = Array.isArray(targetValue)
        ? targetValue.map((v) => String(v).toLowerCase().trim())
        : String(targetValue)
            .split(',')
            .map((v) => v.toLowerCase().trim());
      return list.includes(String(actualValue).toLowerCase().trim());
    }

    default:
      return true;
  }
}

/**
 * ネスト可能な ConditionGroup を再帰的に評価する。
 */
export function evaluateConditionGroup(
  group: ConditionGroup,
  target: any,
  optionsSchema?: OptionsSchema | null,
  context?: { index?: number }
): boolean {
  if (!group || !Array.isArray(group.children) || group.children.length === 0) {
    return true;
  }

  if (group.logicalOperator === 'or') {
    return group.children.some((child) => {
      if (child.type === 'group') {
        return evaluateConditionGroup(child, target, optionsSchema, context);
      }
      return evaluateRule(child, target, optionsSchema, context);
    });
  }

  // Default: 'and'
  return group.children.every((child) => {
    if (child.type === 'group') {
      return evaluateConditionGroup(child, target, optionsSchema, context);
    }
    return evaluateRule(child, target, optionsSchema, context);
  });
}

// ============================================================================
// Cascading Style Resolvers
// ============================================================================

/**
 * ウェイポイントの条件付き書式を解決する。
 */
export function resolveWaypointConditionalStyle(
  node: WaypointNode,
  rules: ConditionalStyleRule[],
  enabled: boolean,
  optionsSchema?: OptionsSchema | null,
  context?: { index?: number }
): ResolvedWaypointStyle | null {
  if (!enabled || !Array.isArray(rules) || rules.length === 0) return null;

  const relevantRules = rules.filter((r) => r.enabled && r.targetElement === 'waypoint' && r.style?.waypoint);
  if (relevantRules.length === 0) return null;

  let merged: ResolvedWaypointStyle | null = null;

  for (const rule of relevantRules) {
    if (evaluateConditionGroup(rule.condition, node, optionsSchema, context)) {
      const override = rule.style.waypoint!;
      if (!merged) merged = {};

      if (override.color !== undefined && merged.color === undefined) merged.color = override.color;
      if (override.fillColor !== undefined && merged.fillColor === undefined) merged.fillColor = override.fillColor;
      if (override.scale !== undefined && merged.scale === undefined) merged.scale = clampNumber(override.scale, 0.1, 10.0, 1.0);
      if (override.opacity !== undefined && merged.opacity === undefined) merged.opacity = clampNumber(override.opacity, 0.0, 1.0, 1.0);
      if (override.shape !== undefined && merged.shape === undefined) merged.shape = override.shape;
      if (override.labelVisible !== undefined && merged.labelVisible === undefined) merged.labelVisible = override.labelVisible;

      if (rule.stopIfMatched) {
        break;
      }
    }
  }

  return merged;
}

/**
 * パス（線分）の条件付き書式を解決する。
 * Outgoing（始点ノード条件）または Incoming（終点ノード条件）を考慮してマージする。
 */
export function resolvePathConditionalStyle(
  sourceNode: WaypointNode | null,
  targetNode: WaypointNode | null,
  rules: ConditionalStyleRule[],
  enabled: boolean,
  optionsSchema?: OptionsSchema | null,
  context?: { sourceIndex?: number; targetIndex?: number }
): ResolvedPathStyle | null {
  if (!enabled || !Array.isArray(rules) || rules.length === 0) return null;

  const relevantRules = rules.filter((r) => r.enabled && r.targetElement === 'path' && r.style?.path);
  if (relevantRules.length === 0) return null;

  let merged: ResolvedPathStyle | null = null;

  for (const rule of relevantRules) {
    const override = rule.style.path!;
    const direction = override.direction || 'outgoing';

    const evaluatedNode = direction === 'incoming' ? targetNode : sourceNode;
    const evaluatedIndex = direction === 'incoming' ? context?.targetIndex : context?.sourceIndex;

    if (evaluatedNode && evaluateConditionGroup(rule.condition, evaluatedNode, optionsSchema, { index: evaluatedIndex })) {
      if (!merged) merged = {};

      if (override.color !== undefined && merged.color === undefined) merged.color = override.color;

      // 線幅：固定値または options からの直接参照
      if (merged.width === undefined) {
        if (override.widthFromOption) {
          const rawW = resolvePropertyValue(evaluatedNode, `options.${override.widthFromOption}`, optionsSchema);
          const numW = Number(rawW);
          if (!isNaN(numW) && numW > 0) {
            merged.width = numW;
          }
        }
        if (merged.width === undefined && override.width !== undefined) {
          merged.width = clampNumber(override.width, 0.01, 10.0, 0.1);
        }
      }

      if (override.opacity !== undefined && merged.opacity === undefined) merged.opacity = clampNumber(override.opacity, 0.0, 1.0, 0.7);
      if (override.dashPattern !== undefined && merged.dashPattern === undefined) merged.dashPattern = override.dashPattern;

      if (rule.stopIfMatched) {
        break;
      }
    }
  }

  return merged;
}

/**
 * フットプリントの条件付き書式を解決する。
 */
export function resolveFootprintConditionalStyle(
  node: WaypointNode,
  baseFootprint: RobotFootprint | null,
  rules: ConditionalStyleRule[],
  enabled: boolean,
  optionsSchema?: OptionsSchema | null,
  context?: { index?: number }
): ResolvedFootprintStyle | null {
  if (!enabled || !Array.isArray(rules) || rules.length === 0) return null;

  const relevantRules = rules.filter((r) => r.enabled && r.targetElement === 'footprint' && r.style?.footprint);
  if (relevantRules.length === 0) return null;

  let visibleMode: 'default' | 'force_show' | 'force_hide' = 'default';
  let sizeMode: 'default' | 'scale' | 'custom_value' | 'from_option' = 'default';
  let scaleMultiplier: number | undefined = undefined;
  let customRadius: number | undefined = undefined;
  let customLength: number | undefined = undefined;
  let customWidth: number | undefined = undefined;
  let sizeOptionKey: string | undefined = undefined;
  let strokeColor: string | undefined = undefined;
  let fillColor: string | undefined = undefined;
  let fillAlpha: number | undefined = undefined;
  let strokeWidth: number | undefined = undefined;

  let matched = false;

  for (const rule of relevantRules) {
    if (evaluateConditionGroup(rule.condition, node, optionsSchema, context)) {
      matched = true;
      const override = rule.style.footprint!;

      if (visibleMode === 'default' && override.visibleMode && override.visibleMode !== 'default') {
        visibleMode = override.visibleMode;
      }
      if (sizeMode === 'default' && override.sizeMode && override.sizeMode !== 'default') {
        sizeMode = override.sizeMode;
        scaleMultiplier = override.scale;
        customRadius = override.customRadius;
        customLength = override.customLength;
        customWidth = override.customWidth;
        sizeOptionKey = override.sizeOptionKey;
      }
      if (strokeColor === undefined && override.strokeColor !== undefined) strokeColor = override.strokeColor;
      if (fillColor === undefined && override.fillColor !== undefined) fillColor = override.fillColor;
      if (fillAlpha === undefined && override.fillAlpha !== undefined) fillAlpha = clampNumber(override.fillAlpha, 0.0, 1.0, 0.18);
      if (strokeWidth === undefined && override.strokeWidth !== undefined) strokeWidth = clampNumber(override.strokeWidth, 0.1, 20.0, 1.0);

      if (rule.stopIfMatched) {
        break;
      }
    }
  }

  if (!matched) return null;

  // フットプリント寸法の計算
  let effectiveFootprint: RobotFootprint | null = baseFootprint ? { ...baseFootprint } : null;

  if (effectiveFootprint) {
    if (sizeMode === 'scale' && scaleMultiplier && scaleMultiplier > 0) {
      if (effectiveFootprint.type === 'circular') {
        effectiveFootprint = { ...effectiveFootprint, radius: effectiveFootprint.radius * scaleMultiplier };
      } else if (effectiveFootprint.type === 'rectangular') {
        effectiveFootprint = {
          ...effectiveFootprint,
          length: effectiveFootprint.length * scaleMultiplier,
          width: effectiveFootprint.width * scaleMultiplier,
        };
      } else if (effectiveFootprint.type === 'polygon' && effectiveFootprint.points) {
        effectiveFootprint = {
          ...effectiveFootprint,
          points: effectiveFootprint.points.map(([px, py]) => [px * scaleMultiplier!, py * scaleMultiplier!]),
        };
      }
    } else if (sizeMode === 'from_option' && sizeOptionKey) {
      const optVal = resolvePropertyValue(node, `options.${sizeOptionKey}`, optionsSchema);
      const numVal = Number(optVal);
      if (!isNaN(numVal) && numVal > 0) {
        if (effectiveFootprint.type === 'circular') {
          effectiveFootprint = { ...effectiveFootprint, radius: numVal };
        } else if (effectiveFootprint.type === 'rectangular') {
          effectiveFootprint = { ...effectiveFootprint, length: numVal, width: numVal };
        }
      }
    } else if (sizeMode === 'custom_value') {
      if (effectiveFootprint.type === 'circular' && customRadius && customRadius > 0) {
        effectiveFootprint = { ...effectiveFootprint, radius: customRadius };
      } else if (effectiveFootprint.type === 'rectangular') {
        effectiveFootprint = {
          ...effectiveFootprint,
          length: customLength || effectiveFootprint.length,
          width: customWidth || effectiveFootprint.width,
        };
      }
    }
  }

  return {
    shouldRender: visibleMode === 'force_show',
    visibleMode,
    footprint: effectiveFootprint,
    strokeColor,
    fillColor,
    fillAlpha,
    strokeWidth,
  };
}

/**
 * アノテーションの条件付き書式を解決する。
 */
export function resolveAnnotationConditionalStyle(
  annotation: AnnotationObject,
  rules: ConditionalStyleRule[],
  enabled: boolean,
  optionsSchema?: OptionsSchema | null
): ResolvedAnnotationStyle | null {
  if (!enabled || !Array.isArray(rules) || rules.length === 0) return null;

  const relevantRules = rules.filter((r) => r.enabled && r.targetElement === 'annotation' && r.style?.annotation);
  if (relevantRules.length === 0) return null;

  let merged: ResolvedAnnotationStyle | null = null;

  for (const rule of relevantRules) {
    if (evaluateConditionGroup(rule.condition, annotation, optionsSchema)) {
      const override = rule.style.annotation!;
      if (!merged) merged = {};

      if (override.strokeColor !== undefined && merged.strokeColor === undefined) merged.strokeColor = override.strokeColor;
      if (override.fillColor !== undefined && merged.fillColor === undefined) merged.fillColor = override.fillColor;
      if (override.strokeWidth !== undefined && merged.strokeWidth === undefined) merged.strokeWidth = clampNumber(override.strokeWidth, 0.5, 20.0, 2.0);
      if (override.opacity !== undefined && merged.opacity === undefined) merged.opacity = clampNumber(override.opacity, 0.0, 1.0, 1.0);
      if (override.visible !== undefined && merged.visible === undefined) merged.visible = override.visible;

      if (rule.stopIfMatched) {
        break;
      }
    }
  }

  return merged;
}
