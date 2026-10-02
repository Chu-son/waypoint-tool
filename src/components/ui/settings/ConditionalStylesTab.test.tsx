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
        globals: [],
      },
    });
  });

  it('renders correctly with existing rules and master toggle', () => {
    render(<ConditionalStylesTab />);

    expect(screen.getByText('Conditional Styles')).toBeInTheDocument();
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

  describe('element conditions on a list option', () => {
    beforeEach(() => {
      useAppStore.setState({
        optionsSchema: {
          options: [
            {
              name: 'on_reached_actions',
              label: 'Actions',
              type: 'list',
              item: {
                type: 'union',
                variants: [
                  { value: 'load_map', fields: [{ name: 'localization', label: 'Loc', type: 'string' }] },
                  { value: 'amcl_reset', fields: [] },
                ],
              },
            },
          ],
          globals: [],
        },
      });
    });

    const storedCondition = () => useAppStore.getState().conditionalStyles[0].condition;

    it('adds an element condition that targets the first list option', () => {
      render(<ConditionalStylesTab />);

      fireEvent.click(screen.getByRole('button', { name: '要素条件追加' }));

      expect(storedCondition().children[1]).toMatchObject({
        type: 'collection',
        property: 'options.on_reached_actions',
        quantifier: 'any',
        condition: { children: [] },
      });
    });

    it('stores the quantifier and a sub-condition on the element key chosen in the editor', () => {
      render(<ConditionalStylesTab />);
      fireEvent.click(screen.getByRole('button', { name: '要素条件追加' }));

      fireEvent.change(screen.getByLabelText('量化子'), { target: { value: 'none' } });
      const addButtons = screen.getAllByRole('button', { name: '条件追加' });
      fireEvent.click(addButtons[addButtons.length - 1]);
      const properties = screen.getAllByLabelText('プロパティ');
      fireEvent.change(properties[properties.length - 1], { target: { value: 'type' } });
      const values = screen.getAllByLabelText('比較値');
      fireEvent.change(values[values.length - 1], { target: { value: 'load_map' } });

      expect(storedCondition().children[1]).toMatchObject({
        type: 'collection',
        quantifier: 'none',
        condition: { children: [{ type: 'rule', property: 'type', operator: 'equals', value: 'load_map' }] },
      });
    });

    it('offers the variant values as candidates for the discriminator inside the element condition', () => {
      const { container } = render(<ConditionalStylesTab />);
      fireEvent.click(screen.getByRole('button', { name: '要素条件追加' }));
      const addButtons = screen.getAllByRole('button', { name: '条件追加' });
      fireEvent.click(addButtons[addButtons.length - 1]);
      const properties = screen.getAllByLabelText('プロパティ');
      fireEvent.change(properties[properties.length - 1], { target: { value: 'type' } });

      const candidates = Array.from(container.querySelectorAll('datalist option')).map((o) => o.getAttribute('value'));
      expect(candidates).toEqual(expect.arrayContaining(['load_map', 'amcl_reset']));
    });
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
