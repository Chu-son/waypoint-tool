import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ConditionalStylesTab } from './ConditionalStylesTab';
import { useAppStore } from '../../../stores/appStore';
import { ConditionalStyleRule } from '../../../types/store';

describe('ConditionalStylesTab', () => {
  const sampleRule: ConditionalStyleRule = {
    id: 'test_rule_1',
    name: '充電ステーション強調',
    enabled: true,
    targetElement: 'waypoint',
    condition: {
      id: 'grp-1',
      type: 'group',
      logicalOperator: 'and',
      children: [
        {
          id: 'rule-1',
          type: 'rule',
          property: 'options.type',
          operator: 'equals',
          value: 'charge',
        },
      ],
    },
    style: {
      waypoint: {
        color: '#ffaa00',
        shape: 'star',
      },
    },
    stopIfMatched: false,
  };

  beforeEach(() => {
    useAppStore.setState({
      conditionalStyles: [sampleRule],
      conditionalStylesEnabled: true,
      optionsSchema: {
        options: [
          { name: 'type', label: 'Type', type: 'string', default: 'normal' },
          { name: 'speed', label: 'Speed', type: 'float', default: 1.0 },
        ],
      },
    });
  });

  it('renders correctly with existing rules and master toggle', () => {
    render(<ConditionalStylesTab />);

    expect(screen.getByText('条件付き書式 (Conditional Styles)')).toBeInTheDocument();
    expect(screen.getByText('充電ステーション強調')).toBeInTheDocument();
    expect(screen.getByText('ルール設定 (Rule Details)')).toBeInTheDocument();
  });

  it('can toggle master conditional styles enabled/disabled', () => {
    render(<ConditionalStylesTab />);

    // Toggle master switch
    const toggles = screen.getAllByRole('switch');
    // First toggle is master switch
    fireEvent.click(toggles[0]);

    expect(useAppStore.getState().conditionalStylesEnabled).toBe(false);
  });

  it('can add a new rule of waypoint type', () => {
    render(<ConditionalStylesTab />);

    const addWaypointBtn = screen.getByRole('button', { name: /Waypoint/i });
    act(() => {
      fireEvent.click(addWaypointBtn);
    });

    const styles = useAppStore.getState().conditionalStyles;
    expect(styles.length).toBe(2);
    expect(styles[1].targetElement).toBe('waypoint');
  });

  it('can duplicate an existing rule', () => {
    render(<ConditionalStylesTab />);

    const duplicateBtn = screen.getByTitle('複製');
    act(() => {
      fireEvent.click(duplicateBtn);
    });

    const styles = useAppStore.getState().conditionalStyles;
    expect(styles.length).toBe(2);
    expect(styles[1].name).toBe('充電ステーション強調 (コピー)');
  });

  it('can remove a rule', () => {
    render(<ConditionalStylesTab />);

    const deleteBtn = screen.getByTitle('削除');
    act(() => {
      fireEvent.click(deleteBtn);
    });

    const styles = useAppStore.getState().conditionalStyles;
    expect(styles.length).toBe(0);
    expect(screen.getByText('登録されているルールはありません。')).toBeInTheDocument();
  });

  it('can update rule details in editor', () => {
    render(<ConditionalStylesTab />);

    const nameInput = screen.getByDisplayValue('充電ステーション強調');
    fireEvent.change(nameInput, { target: { value: '更新されたルール名' } });

    const updatedRule = useAppStore.getState().conditionalStyles[0];
    expect(updatedRule.name).toBe('更新されたルール名');
  });

  it('can reorder rules with move up and down buttons', () => {
    const secondRule: ConditionalStyleRule = {
      ...sampleRule,
      id: 'test_rule_2',
      name: 'ルール2',
    };
    useAppStore.setState({
      conditionalStyles: [sampleRule, secondRule],
    });

    render(<ConditionalStylesTab />);

    const moveDownBtns = screen.getAllByTitle('下へ移動');
    act(() => {
      fireEvent.click(moveDownBtns[0]);
    });

    const styles = useAppStore.getState().conditionalStyles;
    expect(styles[0].id).toBe('test_rule_2');
    expect(styles[1].id).toBe('test_rule_1');
  });
});
