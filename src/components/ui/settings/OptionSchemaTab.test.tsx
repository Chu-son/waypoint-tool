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

    expect(message).toHaveBeenCalledWith(expect.stringContaining('unique'), undefined);
    expect(getAppState().optionsSchema?.globals.map((g) => g.name)).toEqual(['a', 'b']);
  });
});
