import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineNameInput } from './InlineNameInput';

function setup(name = 'Old') {
  const onRename = vi.fn();
  const onCancel = vi.fn();
  render(<InlineNameInput name={name} onRename={onRename} onCancel={onCancel} />);
  return { user: userEvent.setup(), input: screen.getByRole('textbox'), onRename, onCancel };
}

describe('InlineNameInput', () => {
  it('starts focused with the current name', () => {
    const { input } = setup();
    expect(input).toHaveValue('Old');
    expect(input).toHaveFocus();
  });

  it('commits the trimmed name on Enter', async () => {
    const { user, input, onRename, onCancel } = setup();
    await user.clear(input);
    await user.type(input, '  New name  {Enter}');
    expect(onRename).toHaveBeenCalledWith('New name');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('commits on blur', async () => {
    const { user, input, onRename } = setup();
    await user.type(input, '2');
    await user.tab();
    expect(onRename).toHaveBeenCalledWith('Old2');
  });

  it('cancels on Escape without renaming', async () => {
    const { user, input, onRename, onCancel } = setup();
    await user.type(input, 'xyz{Escape}');
    expect(onCancel).toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
  });

  it.each([
    ['an unchanged name', '{Enter}'],
    ['an empty name', '{Control>}a{/Control}{Backspace}   {Enter}'],
  ])('cancels instead of renaming for %s', async (_, keys) => {
    const { user, input, onRename, onCancel } = setup();
    await user.type(input, keys);
    expect(onRename).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
