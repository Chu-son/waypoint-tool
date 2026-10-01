import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { diffLines } from '../../../utils/diff/lineDiff';
import { ItemDiffList, type ItemDiffRow } from './ItemDiffList';
import { TextDiffView } from './TextDiffView';

const rows: ItemDiffRow[] = [
  { id: 'a', label: 'Alpha', status: 'added' },
  { id: 'b', label: 'Beta', status: 'changed', lines: diffLines('speed: 1\nname: x', 'speed: 2\nname: x') },
  { id: 'c', label: 'Gamma', status: 'removed', actionLabel: 'Remove Gamma' },
  { id: 'd', label: 'Delta', status: 'unchanged' },
];

function Harness({ onChange }: { onChange?: (ids: Set<string>) => void }) {
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set(['a']));
  return (
    <ItemDiffList
      rows={rows}
      accepted={accepted}
      onChange={(next) => {
        setAccepted(next);
        onChange?.(next);
      }}
    />
  );
}

describe('ItemDiffList', () => {
  it('shows changed rows with their status and hides unchanged ones until asked', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Changed')).toBeInTheDocument();
    expect(screen.queryByText('Delta')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show 1 unchanged' }));

    expect(screen.getByText('Delta')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Import Delta' })).toBeDisabled();
  });

  it('reports the rows the user ticks and unticks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Import Beta' }));
    expect([...onChange.mock.lastCall![0]].sort()).toEqual(['a', 'b']);

    await user.click(screen.getByRole('checkbox', { name: 'Import Alpha' }));
    expect([...onChange.mock.lastCall![0]]).toEqual(['b']);
  });

  it('selects every changeable row at once and clears them', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('0 of 3 selected')).toBeInTheDocument();
  });

  it('uses the custom action label of a row', () => {
    render(<Harness />);
    expect(screen.getByRole('checkbox', { name: 'Remove Gamma' })).toBeInTheDocument();
  });

  it('expands a changed row to show what changed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('group', { name: 'Changes of Beta' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show changes of Beta' }));

    const diff = screen.getByRole('group', { name: 'Changes of Beta' });
    expect(diff).toHaveTextContent('speed: 1');
    expect(diff).toHaveTextContent('speed: 2');
    expect(screen.getByRole('button', { name: 'Hide changes of Beta' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('says so when there is nothing to compare', () => {
    render(<ItemDiffList rows={[]} accepted={new Set()} onChange={() => {}} />);
    expect(screen.getByText('There is nothing to compare.')).toBeInTheDocument();
  });
});

describe('TextDiffView', () => {
  it('folds long unchanged stretches around the change', () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 10', 'line ten');

    render(<TextDiffView lines={diffLines(before, after)} contextLines={1} />);

    const view = screen.getByRole('group', { name: 'Diff' });
    expect(view).toHaveTextContent('line 10');
    expect(view).toHaveTextContent('line ten');
    expect(view).toHaveTextContent('lines unchanged');
    expect(view).not.toHaveTextContent('line 3');
  });
});
