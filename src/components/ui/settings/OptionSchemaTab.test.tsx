import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OptionSchemaTab } from './OptionSchemaTab';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { DialogAPI } from '../../../api';

describe('OptionSchemaTab global fields', () => {
  it('saves a global field with a typed value into the project schema', async () => {
    const { user } = renderWithStore(<OptionSchemaTab />);

    await user.click(screen.getByRole('button', { name: /Add Global/ }));
    const key = screen.getByLabelText('Global field key name');
    await user.clear(key);
    await user.type(key, 'default_speed');
    await user.selectOptions(screen.getByLabelText('default_speed type'), 'float');
    await user.type(screen.getByLabelText('default_speed value'), '0.5');
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    expect(getAppState().optionsSchema?.globals).toEqual([
      expect.objectContaining({ name: 'default_speed', type: 'float', value: 0.5 }),
    ]);
    expect(getAppState().isDirty).toBe(true);
  });

  it('shows the saved global fields and lets the value be changed', async () => {
    const { user } = renderWithStore(<OptionSchemaTab />, {
      optionsSchema: {
        options: [],
        globals: [{ name: 'default_speed', label: 'Default Speed', type: 'float', value: 0.5 }],
      },
    });

    const value = screen.getByLabelText('default_speed value');
    expect(value).toHaveValue('0.5');
    await user.clear(value);
    await user.type(value, '1.25');
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    expect(getAppState().optionsSchema?.globals[0].value).toBe(1.25);
  });

  it('removes a global field', async () => {
    const { user } = renderWithStore(<OptionSchemaTab />, {
      optionsSchema: { options: [], globals: [{ name: 'frame_id', label: 'Frame', type: 'string', value: 'map' }] },
    });

    await user.click(screen.getByRole('button', { name: 'Remove frame_id' }));
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    expect(getAppState().optionsSchema?.globals).toEqual([]);
  });

  it('refuses to save a value that does not match the field type', async () => {
    const message = vi.spyOn(DialogAPI, 'message').mockResolvedValue();
    const { user } = renderWithStore(<OptionSchemaTab />, {
      optionsSchema: { options: [], globals: [{ name: 'default_speed', label: 'Speed', type: 'float', value: 0.5 }] },
    });

    const value = screen.getByLabelText('default_speed value');
    await user.clear(value);
    await user.type(value, 'fast');
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    expect(message).toHaveBeenCalledWith(expect.stringContaining('global fields'), undefined);
    expect(getAppState().optionsSchema?.globals[0].value).toBe(0.5);
  });

  it('refuses to save two global fields with the same key', async () => {
    const message = vi.spyOn(DialogAPI, 'message').mockResolvedValue();
    const { user } = renderWithStore(<OptionSchemaTab />, {
      optionsSchema: {
        options: [],
        globals: [
          { name: 'a', label: 'A', type: 'string', value: '1' },
          { name: 'b', label: 'B', type: 'string', value: '2' },
        ],
      },
    });

    const keys = screen.getAllByLabelText('Global field key name');
    await user.clear(keys[1]);
    await user.type(keys[1], 'a');
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    expect(message).toHaveBeenCalledWith(expect.stringContaining('globals'), undefined);
    expect(getAppState().optionsSchema?.globals.map((g) => g.name)).toEqual(['a', 'b']);
  });
});

describe('OptionSchemaTab recursive types (object / union)', () => {
  it('defines a list<union> option (mg_robot on_reached_actions-style tagged union) via the GUI', async () => {
    const { user } = renderWithStore(<OptionSchemaTab />);

    await user.click(screen.getByRole('button', { name: 'Add Field' }));
    const key = screen.getByLabelText('Option key name');
    await user.clear(key);
    await user.type(key, 'on_reached_actions');

    await user.selectOptions(screen.getByLabelText('on_reached_actions type'), 'list');
    await user.selectOptions(screen.getByLabelText('on_reached_actions list item type'), 'union');

    await user.click(screen.getByRole('button', { name: 'Add Variant' }));
    await user.clear(screen.getByLabelText('Variant value'));
    await user.type(screen.getByLabelText('Variant value'), 'wait');

    await user.click(screen.getByRole('button', { name: 'Add Field to Variant' }));
    const nestedKey = screen.getByLabelText('Field key name');
    await user.clear(nestedKey);
    await user.type(nestedKey, 'countdown_ms');
    await user.selectOptions(screen.getByLabelText('countdown_ms type'), 'integer');

    await user.click(screen.getByRole('button', { name: /Apply/ }));

    const saved = getAppState().optionsSchema?.options[0];
    expect(saved?.name).toBe('on_reached_actions');
    expect(saved?.type).toBe('list');
    expect(saved?.item).toEqual({
      type: 'union',
      discriminator: 'type',
      variants: [{ value: 'wait', fields: [{ name: 'countdown_ms', label: 'New Field', type: 'integer' }] }],
    });
  });

  it('defines an object option with fixed fields via the GUI', async () => {
    const { user } = renderWithStore(<OptionSchemaTab />);

    await user.click(screen.getByRole('button', { name: 'Add Field' }));
    const key = screen.getByLabelText('Option key name');
    await user.clear(key);
    await user.type(key, 'navigation');
    await user.selectOptions(screen.getByLabelText('navigation type'), 'object');

    await user.click(screen.getByRole('button', { name: 'Add Nested Field' }));
    const nestedKey = screen.getByLabelText('Field key name');
    await user.clear(nestedKey);
    await user.type(nestedKey, 'is_through_point');
    await user.selectOptions(screen.getByLabelText('is_through_point type'), 'boolean');

    await user.click(screen.getByRole('button', { name: /Apply/ }));

    const saved = getAppState().optionsSchema?.options[0];
    expect(saved?.type).toBe('object');
    expect(saved?.fields).toEqual([{ name: 'is_through_point', label: 'New Field', type: 'boolean' }]);
  });

  it('refuses to save two union variants with the same value', async () => {
    const message = vi.spyOn(DialogAPI, 'message').mockResolvedValue();
    const { user } = renderWithStore(<OptionSchemaTab />, {
      optionsSchema: {
        options: [
          {
            name: 'actions',
            label: 'Actions',
            type: 'list',
            item: {
              type: 'union',
              discriminator: 'type',
              variants: [
                { value: 'wait', fields: [] },
                { value: 'amcl_reset', fields: [] },
              ],
            },
          },
        ],
        globals: [],
      },
    });

    const variantValues = screen.getAllByLabelText('Variant value');
    await user.clear(variantValues[1]);
    await user.type(variantValues[1], 'wait');
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    expect(message).toHaveBeenCalledWith(expect.stringContaining('wait'), undefined);
    // 保存はブロックされ、既存のスキーマは変わらない。
    expect(getAppState().optionsSchema?.options[0].item?.variants?.map((v) => v.value)).toEqual(['wait', 'amcl_reset']);
  });
});
