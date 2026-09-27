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
    expect(value).toHaveValue(0.5);
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

  it("refuses to save when a global's value falls outside its declared choices", async () => {
    // 型付き入力になったことで GUI からタイプミスで不正な値を打ち込むことはできなくなったが、
    // 既定値として使われている選択肢を後から削除すれば、同様に不整合な状態を GUI 上で作れる。
    const message = vi.spyOn(DialogAPI, 'message').mockResolvedValue();
    const { user } = renderWithStore(<OptionSchemaTab />, {
      optionsSchema: {
        options: [],
        globals: [{ name: 'mode', label: 'Mode', type: 'string', enum_values: ['normal', 'slow'], value: 'slow' }],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Remove choice slow' }));
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    expect(message).toHaveBeenCalledWith(expect.stringContaining('globals[0].value'), undefined);
    expect(getAppState().optionsSchema?.globals[0].value).toBe('slow');
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
    await user.selectOptions(screen.getByLabelText('on_reached_actions item type'), 'union');

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

  it('defines an object field nested inside another object (unlimited GUI nesting depth)', async () => {
    const { user } = renderWithStore(<OptionSchemaTab />);

    await user.click(screen.getByRole('button', { name: 'Add Field' }));
    const outerKey = screen.getByLabelText('Option key name');
    await user.clear(outerKey);
    await user.type(outerKey, 'outer');
    await user.selectOptions(screen.getByLabelText('outer type'), 'object');

    await user.click(screen.getByRole('button', { name: 'Add Nested Field' }));
    const innerKey = screen.getByLabelText('Field key name');
    await user.clear(innerKey);
    await user.type(innerKey, 'inner');
    await user.selectOptions(screen.getByLabelText('inner type'), 'object');

    // 2段目の object にも、さらにネストしたフィールドを追加できる（深さ制限が無いことの確認）。
    // 「Add Nested Field」ボタンは、inner 自身のブロック内（先頭）と outer 自身の末尾との2つ現れる。
    // inner 用（先頭）をクリックして、inner.fields に新しいフィールドを追加する。
    const addNestedButtons = screen.getAllByRole('button', { name: 'Add Nested Field' });
    await user.click(addNestedButtons[0]);
    // 「Field key name」は inner 自身のキー入力（先頭）と、今追加した新フィールドのキー入力
    // （inner のブロック内、inner 自身のキー入力より後）の2つになるため、後者（末尾）を使う。
    const leafKeys = screen.getAllByLabelText('Field key name');
    const leafKey = leafKeys[leafKeys.length - 1];
    await user.clear(leafKey);
    await user.type(leafKey, 'leaf');
    await user.selectOptions(screen.getByLabelText('leaf type'), 'boolean');

    await user.click(screen.getByRole('button', { name: /Apply/ }));

    const saved = getAppState().optionsSchema?.options[0];
    expect(saved?.type).toBe('object');
    expect(saved?.fields?.[0]).toMatchObject({
      name: 'inner',
      type: 'object',
      fields: [{ name: 'leaf', type: 'boolean' }],
    });
  });
});

describe('OptionSchemaTab Definitions (named, reusable types)', () => {
  it('adds a definition and references it from an option via Ref', async () => {
    const { user } = renderWithStore(<OptionSchemaTab />);

    await user.click(screen.getByRole('button', { name: 'Add Definition' }));
    const defName = screen.getByLabelText('Definition name');
    await user.clear(defName);
    await user.type(defName, 'action');
    await user.selectOptions(screen.getByLabelText('action type'), 'union');
    await user.click(screen.getByRole('button', { name: 'Add Variant' }));
    await user.clear(screen.getByLabelText('Variant value'));
    await user.type(screen.getByLabelText('Variant value'), 'wait');

    await user.click(screen.getByRole('button', { name: 'Add Field' }));
    const optKey = screen.getByLabelText('Option key name');
    await user.clear(optKey);
    await user.type(optKey, 'on_reached_actions');
    await user.selectOptions(screen.getByLabelText('on_reached_actions type'), 'list');
    await user.selectOptions(screen.getByLabelText('on_reached_actions item type'), 'ref');
    await user.selectOptions(screen.getByLabelText('on_reached_actions item ref target'), 'action');

    await user.click(screen.getByRole('button', { name: /Apply/ }));

    const saved = getAppState().optionsSchema;
    expect(saved?.definitions).toEqual([
      expect.objectContaining({
        name: 'action',
        type: 'union',
        variants: [expect.objectContaining({ value: 'wait' })],
      }),
    ]);
    expect(saved?.options[0].item).toEqual({ type: 'ref', ref: 'action' });
  });

  it('refuses to save a definition that references itself (a direct cycle)', async () => {
    const message = vi.spyOn(DialogAPI, 'message').mockResolvedValue();
    const { user } = renderWithStore(<OptionSchemaTab />);

    await user.click(screen.getByRole('button', { name: 'Add Definition' }));
    await user.click(screen.getByRole('button', { name: 'Add Definition' }));
    const names = screen.getAllByLabelText('Definition name');
    await user.clear(names[0]);
    await user.type(names[0], 'a');
    await user.clear(names[1]);
    await user.type(names[1], 'b');

    // 'a' を 'b' への ref にする（自己参照ではないが、循環を作るための片側）。
    await user.selectOptions(screen.getByLabelText('a type'), 'ref');
    await user.selectOptions(screen.getByLabelText('a ref target'), 'b');
    // 'b' を 'a' への ref にして、間接的な循環（a -> b -> a）を作る。
    await user.selectOptions(screen.getByLabelText('b type'), 'ref');
    await user.selectOptions(screen.getByLabelText('b ref target'), 'a');

    await user.click(screen.getByRole('button', { name: /Apply/ }));

    expect(message).toHaveBeenCalledWith(expect.stringContaining('循環'), undefined);
    expect(getAppState().optionsSchema).toBeNull();
  });

  it('removes a definition', async () => {
    const { user } = renderWithStore(<OptionSchemaTab />, {
      optionsSchema: { options: [], globals: [], definitions: [{ name: 'action', type: 'string' }] },
    });

    await user.click(screen.getByRole('button', { name: 'Remove definition action' }));
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    expect(getAppState().optionsSchema?.definitions).toEqual([]);
  });
});

describe('OptionSchemaTab Choices editor', () => {
  it('adds and removes choices as chips, and lets a value be picked from them', async () => {
    const { user } = renderWithStore(<OptionSchemaTab />, {
      optionsSchema: { options: [{ name: 'mode', label: 'Mode', type: 'string' }], globals: [] },
    });

    await user.type(screen.getByLabelText('mode new choice'), 'normal');
    await user.click(screen.getByRole('button', { name: /Add Choice/ }));
    await user.type(screen.getByLabelText('mode new choice'), 'queue_wait');
    await user.click(screen.getByRole('button', { name: /Add Choice/ }));

    await user.selectOptions(screen.getByLabelText('mode default'), 'queue_wait');
    await user.click(screen.getByRole('button', { name: 'Remove choice normal' }));
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    const saved = getAppState().optionsSchema?.options[0];
    expect(saved?.enum_values).toEqual(['queue_wait']);
    expect(saved?.default).toBe('queue_wait');
  });
});
