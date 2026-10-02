import { describe, it, expect, vi } from 'vitest';
import {
  parseColorSafe,
  clampNumber,
  drawDashedLine,
  resolvePropertyValue,
  evaluateRule,
  evaluateConditionGroup,
  resolveWaypointConditionalStyle,
  resolvePathConditionalStyle,
  resolveFootprintConditionalStyle,
  resolveAnnotationConditionalStyle,
} from './conditionalStyles';
import {
  ConditionalStyleRule,
  ConditionCollection,
  ConditionGroup,
  ConditionRule,
  OptionsSchema,
  WaypointNode,
  AnnotationObject,
  RobotFootprint,
} from '../types/store';
import type { TypeSpec } from '../types/options';

describe('conditionalStyles utility', () => {
  describe('safe helpers', () => {
    it('parseColorSafe correctly parses HEX and handles invalid inputs', () => {
      expect(parseColorSafe('#ff0000')).toBe(0xff0000);
      expect(parseColorSafe('00ff00')).toBe(0x00ff00);
      expect(parseColorSafe('#f00')).toBe(0xff0000);
      expect(parseColorSafe('invalid', 0x123456)).toBe(0x123456);
      expect(parseColorSafe(undefined, 0x123456)).toBe(0x123456);
    });

    it('parseColorSafe keeps black shorthand instead of falling back to the default', () => {
      expect(parseColorSafe('#000', 0x123456)).toBe(0x000000);
    });

    it('clampNumber clamps value to range', () => {
      expect(clampNumber(5, 0, 10, 0)).toBe(5);
      expect(clampNumber(-5, 0, 10, 0)).toBe(0);
      expect(clampNumber(15, 0, 10, 0)).toBe(10);
      expect(clampNumber('invalid', 0, 10, 3)).toBe(3);
    });

    it('drawDashedLine generates dashed strokes on Graphics', () => {
      const g = {
        moveTo: vi.fn(),
        lineTo: vi.fn(),
      };
      drawDashedLine(g, 0, 0, 1, 0, 0.2, 0.1);
      expect(g.moveTo).toHaveBeenCalled();
      expect(g.lineTo).toHaveBeenCalled();
      expect(g.moveTo.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('resolvePropertyValue', () => {
    const schema: OptionsSchema = {
      options: [
        { name: 'speed', label: 'Speed', type: 'float', default: 1.0 },
        { name: 'mode', label: 'Mode', type: 'string', default: 'normal' },
      ],
      globals: [],
    };

    const node: WaypointNode = {
      id: 'wp-1',
      type: 'manual',
      name: 'Start Point',
      transform: { x: 10, y: 20, z: 0.5, qx: 0, qy: 0, qz: 0, qw: 1 },
      options: {
        speed: 2.5,
      },
    };

    it('extracts options with fallback to schema default', () => {
      // Existing in node
      expect(resolvePropertyValue(node, 'options.speed', schema)).toBe(2.5);
      // Missing in node, fallback to default
      expect(resolvePropertyValue(node, 'options.mode', schema)).toBe('normal');
      // Completely undefined
      expect(resolvePropertyValue(node, 'options.unknown', schema)).toBeUndefined();
    });

    it('extracts index and transform properties', () => {
      expect(resolvePropertyValue(node, 'index', schema, { index: 3 })).toBe(3);
      expect(resolvePropertyValue(node, 'name', schema)).toBe('Start Point');
      expect(resolvePropertyValue(node, 'transform.x', schema)).toBe(10);
      expect(resolvePropertyValue(node, 'transform.y', schema)).toBe(20);
      expect(resolvePropertyValue(node, 'transform.yaw', schema)).toBe(0);
    });

    it('walks a dot path into an object option field, resolving that field default too', () => {
      const objectSchema: OptionsSchema = {
        options: [
          {
            name: 'navigation',
            label: 'Navigation',
            type: 'object',
            fields: [
              { name: 'is_through_point', label: 'Through', type: 'boolean', default: true },
              { name: 'through_tolerance', label: 'Tolerance', type: 'float', default: 3.0 },
            ],
          },
        ],
        globals: [],
      };
      const objNode: WaypointNode = {
        id: 'wp-2',
        type: 'manual',
        options: { navigation: { is_through_point: false } },
      };

      expect(resolvePropertyValue(objNode, 'options.navigation.is_through_point', objectSchema)).toBe(false);
      // 明示的な値が無いフィールドはスキーマの既定値まで補われる。
      expect(resolvePropertyValue(objNode, 'options.navigation.through_tolerance', objectSchema)).toBe(3.0);
    });
  });

  describe('evaluateRule', () => {
    const node: WaypointNode = {
      id: 'wp-1',
      type: 'manual',
      options: {
        speed: 2.5,
        tag: 'charging_dock',
        enabled: true,
        modes: ['auto', 'fast'],
      },
    };

    it('evaluates comparison operators', () => {
      expect(
        evaluateRule({ id: 'r1', type: 'rule', property: 'options.speed', operator: 'greater_than', value: 2.0 }, node),
      ).toBe(true);
      expect(
        evaluateRule({ id: 'r2', type: 'rule', property: 'options.speed', operator: 'less_than', value: 2.0 }, node),
      ).toBe(false);
      expect(
        evaluateRule(
          { id: 'r3', type: 'rule', property: 'options.speed', operator: 'between', value: 2.0, secondValue: 3.0 },
          node,
        ),
      ).toBe(true);
      expect(
        evaluateRule(
          { id: 'r4', type: 'rule', property: 'options.speed', operator: 'between', value: 3.0, secondValue: 4.0 },
          node,
        ),
      ).toBe(false);
    });

    it('evaluates equality and string operators', () => {
      expect(
        evaluateRule(
          { id: 'r5', type: 'rule', property: 'options.tag', operator: 'equals', value: 'CHARGING_DOCK' },
          node,
        ),
      ).toBe(true);
      expect(
        evaluateRule(
          { id: 'r6', type: 'rule', property: 'options.tag', operator: 'contains', value: 'charging' },
          node,
        ),
      ).toBe(true);
      expect(
        evaluateRule(
          { id: 'r7', type: 'rule', property: 'options.tag', operator: 'in', value: 'dock, depot, charging_dock' },
          node,
        ),
      ).toBe(true);
    });

    it('evaluates emptiness', () => {
      expect(
        evaluateRule(
          { id: 'r8', type: 'rule', property: 'options.speed', operator: 'is_not_empty', value: null },
          node,
        ),
      ).toBe(true);
      expect(
        evaluateRule({ id: 'r9', type: 'rule', property: 'options.missing', operator: 'is_empty', value: null }, node),
      ).toBe(true);
    });

    it('matches "contains" against a union discriminator inside a list of objects', () => {
      const actionsNode: WaypointNode = {
        id: 'wp-2',
        type: 'manual',
        options: { on_reached_actions: [{ type: 'wait', countdown_ms: 3000 }, { type: 'amcl_reset' }] },
      };
      expect(
        evaluateRule(
          {
            id: 'r10',
            type: 'rule',
            property: 'options.on_reached_actions',
            operator: 'contains',
            value: 'amcl_reset',
          },
          actionsNode,
        ),
      ).toBe(true);
      expect(
        evaluateRule(
          {
            id: 'r11',
            type: 'rule',
            property: 'options.on_reached_actions',
            operator: 'contains',
            value: 'wait_trigger',
          },
          actionsNode,
        ),
      ).toBe(false);
    });

    it('treats an empty object/array option value as empty', () => {
      const emptyNode: WaypointNode = {
        id: 'wp-3',
        type: 'manual',
        options: { navigation: {}, on_reached_actions: [] },
      };
      expect(
        evaluateRule(
          { id: 'r12', type: 'rule', property: 'options.navigation', operator: 'is_empty', value: null },
          emptyNode,
        ),
      ).toBe(true);
      expect(
        evaluateRule(
          { id: 'r13', type: 'rule', property: 'options.on_reached_actions', operator: 'is_empty', value: null },
          emptyNode,
        ),
      ).toBe(true);
    });
  });

  describe('collection conditions (list / map elements)', () => {
    const actionSpec: TypeSpec = {
      type: 'union',
      variants: [
        {
          value: 'service',
          fields: [
            { name: 'service', label: 'Service', type: 'string' },
            { name: 'request', label: 'Request', type: 'map', value_type: { type: 'string' } },
          ],
        },
        { value: 'load_map', fields: [{ name: 'localization', label: 'Localization', type: 'string' }] },
        { value: 'amcl_reset', fields: [] },
      ],
      presets: [
        { name: 'lidar_on', value: { type: 'service', service: '/front_lidar/enable', request: { data: 'true' } } },
      ],
    };
    const schema: OptionsSchema = {
      options: [
        { name: 'on_reached_actions', label: 'Actions', type: 'list', item: actionSpec },
        { name: 'zones', label: 'Zones', type: 'list', item: { type: 'string' } },
      ],
      globals: [],
    };
    const rule = (property: string, value: string): ConditionRule => ({
      id: `r_${property}_${value}`,
      type: 'rule',
      property,
      operator: 'equals',
      value,
    });
    const collection = (
      property: string,
      quantifier: ConditionCollection['quantifier'],
      ...children: ConditionRule[] | ConditionCollection[]
    ): ConditionGroup => ({
      id: 'root',
      type: 'group',
      logicalOperator: 'and',
      children: [
        {
          id: 'c',
          type: 'collection',
          property,
          quantifier,
          condition: { id: 'g', type: 'group', logicalOperator: 'and', children },
        },
      ],
    });
    const nodeWith = (options: WaypointNode['options']): WaypointNode => ({ id: 'wp', type: 'manual', options });
    const evaluate = (group: ConditionGroup, node: WaypointNode) => evaluateConditionGroup(group, node, schema);

    const withMap = nodeWith({
      on_reached_actions: [
        { type: 'service', service: '/a' },
        { type: 'load_map', localization: 'floor1' },
      ],
    });

    it('matches when any element satisfies the sub-condition', () => {
      expect(evaluate(collection('options.on_reached_actions', 'any', rule('type', 'load_map')), withMap)).toBe(true);
      expect(evaluate(collection('options.on_reached_actions', 'any', rule('type', 'wait')), withMap)).toBe(false);
    });

    it('does not mix fields of different elements in one sub-condition', () => {
      const sameElement = collection(
        'options.on_reached_actions',
        'any',
        rule('type', 'service'),
        rule('localization', 'floor1'),
      );
      expect(evaluate(sameElement, withMap)).toBe(false);
    });

    it('supports all and none, which are true for an empty or unset list', () => {
      const onlyLoadMap = nodeWith({ on_reached_actions: [{ type: 'load_map' }] });
      expect(evaluate(collection('options.on_reached_actions', 'all', rule('type', 'load_map')), onlyLoadMap)).toBe(
        true,
      );
      expect(evaluate(collection('options.on_reached_actions', 'all', rule('type', 'load_map')), withMap)).toBe(false);
      expect(evaluate(collection('options.on_reached_actions', 'none', rule('type', 'load_map')), withMap)).toBe(false);
      expect(evaluate(collection('options.on_reached_actions', 'none', rule('type', 'wait')), withMap)).toBe(true);
      for (const quantifier of ['all', 'none'] as const) {
        const group = collection('options.on_reached_actions', quantifier, rule('type', 'load_map'));
        expect(evaluate(group, nodeWith({ on_reached_actions: [] }))).toBe(true);
        expect(evaluate(group, nodeWith({}))).toBe(true);
      }
      expect(evaluate(collection('options.on_reached_actions', 'any', rule('type', 'load_map')), nodeWith({}))).toBe(
        false,
      );
    });

    it('compares against the preset value for an element that references a preset', () => {
      const presetNode = nodeWith({ on_reached_actions: [{ $preset: 'lidar_on' }] });
      expect(
        evaluate(collection('options.on_reached_actions', 'any', rule('service', '/front_lidar/enable')), presetNode),
      ).toBe(true);
    });

    it('evaluates the values of a map, and a nested collection inside an element', () => {
      const nested = collection('options.on_reached_actions', 'any', {
        id: 'inner',
        type: 'collection',
        property: 'request',
        quantifier: 'any',
        condition: { id: 'ig', type: 'group', logicalOperator: 'and', children: [rule('', 'true')] },
      });
      const serviceNode = nodeWith({
        on_reached_actions: [{ type: 'service', service: '/a', request: { data: 'true' } }],
      });
      expect(evaluate(nested, serviceNode)).toBe(true);
      expect(
        evaluate(nested, nodeWith({ on_reached_actions: [{ type: 'service', request: { data: 'false' } }] })),
      ).toBe(false);
    });

    it('treats an empty property as the element itself for a list of scalars', () => {
      const zoneNode = nodeWith({ zones: ['dock', 'lobby'] });
      expect(evaluate(collection('options.zones', 'any', rule('', 'dock')), zoneNode)).toBe(true);
      expect(evaluate(collection('options.zones', 'all', rule('', 'dock')), zoneNode)).toBe(false);
    });

    it('can be combined with ordinary rules in the same group', () => {
      const group = collection('options.on_reached_actions', 'any', rule('type', 'load_map'));
      group.children.push({ id: 'n', type: 'rule', property: 'id', operator: 'equals', value: 'other' });
      expect(evaluate(group, withMap)).toBe(false);
      group.logicalOperator = 'or';
      expect(evaluate(group, withMap)).toBe(true);
    });
  });

  describe('evaluateConditionGroup (Nested Condition Tree)', () => {
    const node: WaypointNode = {
      id: 'wp-1',
      type: 'manual',
      options: {
        speed: 3.0,
        area: 'warehouse',
        emergency: false,
      },
    };

    it('evaluates AND logic', () => {
      const andGroup = {
        id: 'g1',
        type: 'group' as const,
        logicalOperator: 'and' as const,
        children: [
          { id: 'r1', type: 'rule' as const, property: 'options.speed', operator: 'greater_than' as const, value: 2.0 },
          {
            id: 'r2',
            type: 'rule' as const,
            property: 'options.area',
            operator: 'equals' as const,
            value: 'warehouse',
          },
        ],
      };
      expect(evaluateConditionGroup(andGroup, node)).toBe(true);
    });

    it('evaluates nested (A and B) or C logic', () => {
      const nestedGroup = {
        id: 'root',
        type: 'group' as const,
        logicalOperator: 'or' as const,
        children: [
          {
            id: 'sub',
            type: 'group' as const,
            logicalOperator: 'and' as const,
            children: [
              {
                id: 'r1',
                type: 'rule' as const,
                property: 'options.speed',
                operator: 'greater_than' as const,
                value: 5.0,
              }, // False
              {
                id: 'r2',
                type: 'rule' as const,
                property: 'options.area',
                operator: 'equals' as const,
                value: 'warehouse',
              }, // True
            ],
          },
          { id: 'r3', type: 'rule' as const, property: 'options.emergency', operator: 'equals' as const, value: false }, // True
        ],
      };
      expect(evaluateConditionGroup(nestedGroup, node)).toBe(true);
    });
  });

  describe('Cascading Style Resolvers', () => {
    const node: WaypointNode = {
      id: 'wp-1',
      type: 'manual',
      options: {
        speed: 3.0,
        highlight: true,
      },
    };

    const rules: ConditionalStyleRule[] = [
      {
        id: 'rule-1',
        name: 'High Speed Red',
        targetElement: 'waypoint',
        enabled: true,
        stopIfMatched: false,
        condition: {
          id: 'g1',
          type: 'group',
          logicalOperator: 'and',
          children: [{ id: 'r1', type: 'rule', property: 'options.speed', operator: 'greater_than', value: 2.0 }],
        },
        style: {
          waypoint: {
            color: '#FF0000',
            shape: 'star',
          },
        },
      },
      {
        id: 'rule-2',
        name: 'Highlight Scale',
        targetElement: 'waypoint',
        enabled: true,
        stopIfMatched: false,
        condition: {
          id: 'g2',
          type: 'group',
          logicalOperator: 'and',
          children: [{ id: 'r2', type: 'rule', property: 'options.highlight', operator: 'equals', value: true }],
        },
        style: {
          waypoint: {
            scale: 1.5,
            color: '#00FF00', // Should be ignored because rule-1 has higher precedence
          },
        },
      },
    ];

    it('cascades waypoint styles correctly (higher precedence wins for conflicts, merges non-conflicting)', () => {
      const resolved = resolveWaypointConditionalStyle(node, rules, true);
      expect(resolved).not.toBeNull();
      expect(resolved?.color).toBe('#FF0000'); // From rule-1
      expect(resolved?.shape).toBe('star'); // From rule-1
      expect(resolved?.scale).toBe(1.5); // From rule-2
    });

    it('respects stopIfMatched flag', () => {
      const stopRules = [{ ...rules[0], stopIfMatched: true }, rules[1]];
      const resolved = resolveWaypointConditionalStyle(node, stopRules, true);
      expect(resolved?.color).toBe('#FF0000');
      expect(resolved?.scale).toBeUndefined(); // rule-2 was never evaluated
    });

    it('resolves path styles with Outgoing direction and option width', () => {
      const sourceNode: WaypointNode = {
        id: 'src',
        type: 'manual',
        options: { pathWidthOpt: 0.4 },
      };
      const pathRules: ConditionalStyleRule[] = [
        {
          id: 'p-rule-1',
          name: 'Wide Path',
          targetElement: 'path',
          enabled: true,
          stopIfMatched: false,
          condition: {
            id: 'pg1',
            type: 'group',
            logicalOperator: 'and',
            children: [
              { id: 'pr1', type: 'rule', property: 'options.pathWidthOpt', operator: 'is_not_empty', value: null },
            ],
          },
          style: {
            path: {
              color: '#0000FF',
              widthFromOption: 'pathWidthOpt',
              dashPattern: 'dashed',
              direction: 'outgoing',
            },
          },
        },
      ];

      const resolved = resolvePathConditionalStyle(sourceNode, null, pathRules, true);
      expect(resolved?.color).toBe('#0000FF');
      expect(resolved?.width).toBe(0.4);
      expect(resolved?.dashPattern).toBe('dashed');
    });

    it('resolves footprint styles with force_show and scale', () => {
      const baseFootprint: RobotFootprint = { type: 'circular', radius: 0.3 };
      const fpRules: ConditionalStyleRule[] = [
        {
          id: 'fp-1',
          name: 'Expanded Footprint',
          targetElement: 'footprint',
          enabled: true,
          stopIfMatched: false,
          condition: {
            id: 'fpg1',
            type: 'group',
            logicalOperator: 'and',
            children: [{ id: 'fpr1', type: 'rule', property: 'options.speed', operator: 'greater_than', value: 2.0 }],
          },
          style: {
            footprint: {
              visibleMode: 'force_show',
              sizeMode: 'scale',
              scale: 2.0,
              strokeColor: '#FFFF00',
            },
          },
        },
      ];

      const resolved = resolveFootprintConditionalStyle(node, baseFootprint, fpRules, true);
      expect(resolved?.shouldRender).toBe(true);
      expect(resolved?.footprint?.type).toBe('circular');
      expect((resolved?.footprint as any)?.radius).toBe(0.6); // 0.3 * 2.0
      expect(resolved?.strokeColor).toBe('#FFFF00');
    });

    it('resolves annotation styles', () => {
      const annotation: AnnotationObject = {
        id: 'ann-1',
        name: 'Danger Zone',
        type: 'rect',
        visible: true,
        labelVisible: true,
        cx: 0,
        cy: 0,
        width: 10,
        height: 10,
        angle: 0,
        options: { alert: 'critical' },
      };

      const annRules: ConditionalStyleRule[] = [
        {
          id: 'ar-1',
          name: 'Alert Zone Red',
          targetElement: 'annotation',
          enabled: true,
          stopIfMatched: false,
          condition: {
            id: 'ag1',
            type: 'group',
            logicalOperator: 'and',
            children: [{ id: 'ar1', type: 'rule', property: 'options.alert', operator: 'equals', value: 'critical' }],
          },
          style: {
            annotation: {
              strokeColor: '#FF0000',
              fillColor: '#AA0000',
              strokeWidth: 4,
            },
          },
        },
      ];

      const resolved = resolveAnnotationConditionalStyle(annotation, annRules, true);
      expect(resolved?.strokeColor).toBe('#FF0000');
      expect(resolved?.fillColor).toBe('#AA0000');
      expect(resolved?.strokeWidth).toBe(4);
    });
  });
});
