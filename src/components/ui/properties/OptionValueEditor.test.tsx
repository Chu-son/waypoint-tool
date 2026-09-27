import { act, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makeWaypoint, waypointTree } from '../../../test/fixtures';
import type { OptionsSchema } from '../../../types/store';
import { useAppStore } from '../../../stores/appStore';

/** mg_robot の on_reached_actions 相当のスキーマ: type で分岐するタグ付きユニオンのリスト。 */
const onReachedActionsSchema: OptionsSchema = {
  options: [
    {
      name: 'on_reached_actions',
      label: 'Actions',
      type: 'list',
      item: {
        type: 'union',
        discriminator: 'type',
        variants: [
          {
            value: 'wait',
            fields: [{ name: 'countdown_ms', label: 'Countdown (ms)', type: 'integer', default: 3000 }],
          },
          { value: 'amcl_reset', fields: [] },
        ],
      },
    },
  ],
  globals: [],
};

describe('OptionValueEditor via the Inspector (list<union>)', () => {
  it('adds an item, picks a variant, and fills its field into the node options', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1')]),
      selectedNodeIds: ['node-1'],
      optionsSchema: onReachedActionsSchema,
    });

    await user.click(screen.getByRole('button', { name: /Add Item/ }));
    await user.selectOptions(screen.getByLabelText('on_reached_actions[0] variant'), 'wait');
    await user.type(screen.getByLabelText('on_reached_actions[0].countdown_ms'), '5000');

    expect(getAppState().nodes['node-1'].options).toEqual({
      on_reached_actions: [{ type: 'wait', countdown_ms: 5000 }],
    });
  });

  it('drops fields that do not belong to the newly selected variant when switching', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([
        makeWaypoint('node-1', { options: { on_reached_actions: [{ type: 'wait', countdown_ms: 5000 }] } }),
      ]),
      selectedNodeIds: ['node-1'],
      optionsSchema: onReachedActionsSchema,
    });

    await user.selectOptions(screen.getByLabelText('on_reached_actions[0] variant'), 'amcl_reset');

    expect(getAppState().nodes['node-1'].options).toEqual({ on_reached_actions: [{ type: 'amcl_reset' }] });
  });

  it('adds a second item and removes the first, keeping only the remaining one', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1', { options: { on_reached_actions: [{ type: 'amcl_reset' }] } })]),
      selectedNodeIds: ['node-1'],
      optionsSchema: onReachedActionsSchema,
    });

    await user.click(screen.getByRole('button', { name: /Add Item/ }));
    await user.selectOptions(screen.getByLabelText('on_reached_actions[1] variant'), 'wait');
    await user.click(screen.getByRole('button', { name: 'Remove on_reached_actions item 0' }));

    expect(getAppState().nodes['node-1'].options).toEqual({
      on_reached_actions: [{ type: 'wait' }],
    });
  });

  it('reorders items with the move buttons', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([
        makeWaypoint('node-1', {
          options: { on_reached_actions: [{ type: 'wait', countdown_ms: 1000 }, { type: 'amcl_reset' }] },
        }),
      ]),
      selectedNodeIds: ['node-1'],
      optionsSchema: onReachedActionsSchema,
    });

    await user.click(screen.getByRole('button', { name: 'Move on_reached_actions item 1 up' }));

    expect(getAppState().nodes['node-1'].options).toEqual({
      on_reached_actions: [{ type: 'amcl_reset' }, { type: 'wait', countdown_ms: 1000 }],
    });
  });

  it('undoes the whole add-item action in a single step', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1')]),
      selectedNodeIds: ['node-1'],
      optionsSchema: onReachedActionsSchema,
    });

    await user.click(screen.getByRole('button', { name: /Add Item/ }));
    expect(getAppState().nodes['node-1'].options?.on_reached_actions).toHaveLength(1);

    getAppState().undo();

    expect(getAppState().nodes['node-1'].options?.on_reached_actions ?? []).toHaveLength(0);
  });
});

describe('OptionValueEditor via the Inspector (object)', () => {
  const navigationSchema: OptionsSchema = {
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

  it('edits object fields directly into node.options, leaving untouched fields unset', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1')]),
      selectedNodeIds: ['node-1'],
      optionsSchema: navigationSchema,
    });

    // is_through_point の既定値は true なので、チェックボックスは最初からチェック済みとして表示される。
    // クリックすると明示的に false へ上書きされる（through_tolerance には触れていないので未設定のまま）。
    const checkbox = screen.getByLabelText('navigation.is_through_point');
    expect(checkbox).toBeChecked();
    await user.click(checkbox);

    expect(getAppState().nodes['node-1'].options).toEqual({ navigation: { is_through_point: false } });
  });
});

describe('OptionValueEditor via the Inspector (map, e.g. a service request dict)', () => {
  const serviceActionSchema: OptionsSchema = {
    options: [
      {
        name: 'on_reached_actions',
        label: 'Actions',
        type: 'list',
        item: {
          type: 'union',
          discriminator: 'type',
          variants: [
            {
              value: 'service',
              fields: [
                { name: 'service', label: 'Service', type: 'string' },
                { name: 'request', label: 'Request', type: 'map', value_type: { type: 'boolean' } },
              ],
            },
          ],
        },
      },
    ],
    globals: [],
  };

  it('adds a free-form key to a map field (mg_robot-style request dict)', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1', { options: { on_reached_actions: [{ type: 'service' }] } })]),
      selectedNodeIds: ['node-1'],
      optionsSchema: serviceActionSchema,
    });

    await user.type(screen.getByLabelText('on_reached_actions[0].request new key'), 'data');
    await user.click(screen.getByRole('button', { name: /Add Key/ }));
    await user.click(screen.getByLabelText('on_reached_actions[0].request.data'));

    expect(getAppState().nodes['node-1'].options).toEqual({
      on_reached_actions: [{ type: 'service', request: { data: true } }],
    });
  });
});

describe('OptionValueEditor "reset to default" control', () => {
  const speedSchema: OptionsSchema = {
    options: [{ name: 'speed', label: 'Speed', type: 'float', default: 0.5 }],
    globals: [],
  };

  it('shows the reset button once a value is explicit, and it clears the key back to unset', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1', { options: { speed: 1.2 } })]),
      selectedNodeIds: ['node-1'],
      optionsSchema: speedSchema,
    });

    const resetButton = screen.getByRole('button', { name: 'Reset to default' });
    await user.click(resetButton);

    expect(getAppState().nodes['node-1'].options).toEqual({});
    expect(screen.getByLabelText('speed')).toHaveAttribute('placeholder', '既定: 0.5');
  });

  it('does not show a reset button while the field is unset', () => {
    renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1')]),
      selectedNodeIds: ['node-1'],
      optionsSchema: speedSchema,
    });

    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
  });

  it('resets an object field back to unset, independent from its sibling fields', async () => {
    const navigationSchema: OptionsSchema = {
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
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([
        makeWaypoint('node-1', { options: { navigation: { is_through_point: false, through_tolerance: 5 } } }),
      ]),
      selectedNodeIds: ['node-1'],
      optionsSchema: navigationSchema,
    });

    // 2つの子フィールド分 + navigation オブジェクト全体を丸ごと戻す分で、reset ボタンは3つ表示される。
    // 子フィールドの reset ボタンは、子エディタの内側（DOM 上ではオブジェクト全体のボタンより前）に並ぶ。
    const resetButtons = screen.getAllByRole('button', { name: 'Reset to default' });
    expect(resetButtons).toHaveLength(3);
    await user.click(resetButtons[0]);

    expect(getAppState().nodes['node-1'].options).toEqual({ navigation: { through_tolerance: 5 } });
  });
});

describe('OptionValueEditor boolean tri-state behavior', () => {
  const throughSchema: OptionsSchema = {
    options: [{ name: 'is_through_point', label: 'Through', type: 'boolean', default: true }],
    globals: [],
  };

  it('shows the default state with no reset button when unset, then an explicit value with a reset button', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1')]),
      selectedNodeIds: ['node-1'],
      optionsSchema: throughSchema,
    });

    const checkbox = screen.getByLabelText('is_through_point');
    expect(checkbox).toBeChecked(); // showing the default (true)
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();

    await user.click(checkbox);
    expect(getAppState().nodes['node-1'].options).toEqual({ is_through_point: false });
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(getAppState().nodes['node-1'].options).toEqual({});
    expect(screen.getByLabelText('is_through_point')).toBeChecked(); // back to showing the default
  });
});

describe('OptionValueEditor tracks the selected waypoint (no stale display across switches)', () => {
  const anySchema: OptionsSchema = {
    options: [{ name: 'metadata', label: 'Metadata', type: 'any' }],
    globals: [],
  };

  it('shows each waypoint\'s own "any" value instead of the previously selected one', () => {
    renderWithStore(<PropertiesPanel />, {
      ...waypointTree([
        makeWaypoint('node-1', { options: { metadata: { a: 1 } } }),
        makeWaypoint('node-2', { options: { metadata: { b: 2 } } }),
      ]),
      selectedNodeIds: ['node-1'],
      optionsSchema: anySchema,
    });

    expect(screen.getByLabelText('metadata')).toHaveValue('{"a":1}');

    act(() => useAppStore.setState({ selectedNodeIds: ['node-2'] }));

    expect(screen.getByLabelText('metadata')).toHaveValue('{"b":2}');
  });

  const requestSchema: OptionsSchema = {
    options: [{ name: 'request', label: 'Request', type: 'map', value_type: { type: 'boolean' } }],
    globals: [],
  };

  it("shows each waypoint's own map keys instead of the previously selected one's", () => {
    renderWithStore(<PropertiesPanel />, {
      ...waypointTree([
        makeWaypoint('node-1', { options: { request: { alpha: true } } }),
        makeWaypoint('node-2', { options: { request: { beta: false } } }),
      ]),
      selectedNodeIds: ['node-1'],
      optionsSchema: requestSchema,
    });

    expect(screen.getByLabelText('request key')).toHaveValue('alpha');

    act(() => useAppStore.setState({ selectedNodeIds: ['node-2'] }));

    expect(screen.getByLabelText('request key')).toHaveValue('beta');
  });
});

describe('OptionValueEditor scalar list editing', () => {
  const tagsSchema: OptionsSchema = {
    options: [{ name: 'tags', label: 'Tags', type: 'list', item: { type: 'string' } }],
    globals: [],
  };

  it('edits, adds, and removes scalar items individually rather than through a single CSV field', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1', { options: { tags: ['a', 'b'] } })]),
      selectedNodeIds: ['node-1'],
      optionsSchema: tagsSchema,
    });

    expect(screen.getByLabelText('tags[0]')).toHaveValue('a');
    expect(screen.getByLabelText('tags[1]')).toHaveValue('b');

    await user.clear(screen.getByLabelText('tags[0]'));
    await user.type(screen.getByLabelText('tags[0]'), 'z');
    expect(getAppState().nodes['node-1'].options?.tags).toEqual(['z', 'b']);

    await user.click(screen.getByRole('button', { name: /Add Item/ }));
    expect(getAppState().nodes['node-1'].options?.tags).toEqual(['z', 'b', '']);

    await user.click(screen.getByRole('button', { name: 'Remove tags item 1' }));
    expect(getAppState().nodes['node-1'].options?.tags).toEqual(['z', '']);
  });

  it('adds several items at once by pasting comma-separated text', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1')]),
      selectedNodeIds: ['node-1'],
      optionsSchema: tagsSchema,
    });

    await user.click(screen.getByRole('button', { name: /カンマ区切りで貼り付け/ }));
    await user.type(screen.getByLabelText('tags paste csv'), 'a, b, c');
    await user.keyboard('{Enter}');

    expect(getAppState().nodes['node-1'].options?.tags).toEqual(['a', 'b', 'c']);
  });
});

describe('OptionValueEditor multi-selection', () => {
  const schema: OptionsSchema = {
    options: [
      { name: 'speed', label: 'Speed', type: 'float' },
      {
        name: 'navigation',
        label: 'Navigation',
        type: 'object',
        fields: [{ name: 'is_through_point', label: 'Through', type: 'boolean' }],
      },
    ],
    globals: [],
  };

  it('bulk-sets a scalar across every selected manual waypoint', async () => {
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1'), makeWaypoint('node-2')]),
      selectedNodeIds: ['node-1', 'node-2'],
      optionsSchema: schema,
    });

    const speedField = screen.getByLabelText('speed');
    expect(speedField).toHaveAttribute('placeholder', 'Mixed');
    await user.type(speedField, '2');

    expect(getAppState().nodes['node-1'].options?.speed).toBe(2);
    expect(getAppState().nodes['node-2'].options?.speed).toBe(2);
  });

  it('shows a "select a single waypoint" message for complex types instead of editing them', () => {
    renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1'), makeWaypoint('node-2')]),
      selectedNodeIds: ['node-1', 'node-2'],
      optionsSchema: schema,
    });

    expect(screen.getByText(/select a single waypoint to edit/)).toBeInTheDocument();
    expect(screen.queryByLabelText('navigation.is_through_point')).not.toBeInTheDocument();
  });
});

describe('OptionValueEditor resolves definitions/ref before rendering', () => {
  it('edits a value through a ref the same way as an inline union (the shared "action" type)', async () => {
    const schema: OptionsSchema = {
      options: [
        { name: 'on_reached_actions', label: 'On Reached', type: 'list', item: { type: 'ref', ref: 'action' } },
        { name: 'on_departure_actions', label: 'On Departure', type: 'list', item: { type: 'ref', ref: 'action' } },
      ],
      globals: [],
      definitions: [
        {
          name: 'action',
          type: 'union',
          discriminator: 'type',
          variants: [
            { value: 'wait', fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer', default: 3000 }] },
          ],
        },
      ],
    };
    const { user } = renderWithStore(<PropertiesPanel />, {
      ...waypointTree([makeWaypoint('node-1')]),
      selectedNodeIds: ['node-1'],
      optionsSchema: schema,
    });

    await user.click(screen.getAllByRole('button', { name: /Add Item/ })[0]);
    await user.selectOptions(screen.getByLabelText('on_reached_actions[0] variant'), 'wait');
    await user.type(screen.getByLabelText('on_reached_actions[0].countdown_ms'), '1000');

    expect(getAppState().nodes['node-1'].options).toEqual({
      on_reached_actions: [{ type: 'wait', countdown_ms: 1000 }],
    });
  });
});
