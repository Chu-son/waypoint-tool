import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makeWaypoint, waypointTree } from '../../../test/fixtures';
import type { OptionsSchema } from '../../../types/store';

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
