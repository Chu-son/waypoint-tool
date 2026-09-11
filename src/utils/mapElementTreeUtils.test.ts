import { describe, it, expect } from 'vitest';
import {
  filterTopLevelIds,
  remapHierarchicalIds,
  resolveMapElementName,
} from './mapElementTreeUtils';

describe('mapElementTreeUtils', () => {
  describe('filterTopLevelIds', () => {
    it('returns top-level ids in tree order excluding descendants', () => {
      // Tree:
      // g1
      //  ├─ n1
      //  └─ n2
      // n3
      const flatIds = ['g1', 'n1', 'n2', 'n3'];
      const descendantsMap: Record<string, string[]> = {
        g1: ['n1', 'n2'],
        n1: [],
        n2: [],
        n3: [],
      };
      const getDescendants = (id: string) => descendantsMap[id] || [];

      // When g1, n1, n3 are selected, n1 should be excluded because g1 is selected
      const result = filterTopLevelIds(['n1', 'g1', 'n3'], flatIds, getDescendants);
      expect(result).toEqual(['g1', 'n3']);
    });

    it('returns empty array when input is empty', () => {
      expect(filterTopLevelIds([], ['n1'], () => [])).toEqual([]);
    });
  });

  describe('remapHierarchicalIds', () => {
    it('generates new UUIDs and updates children_ids and parent references', () => {
      interface MockNode {
        id: string;
        name: string;
        children_ids?: string[];
        group_id?: string;
      }

      const items: Record<string, MockNode> = {
        g1: { id: 'g1', name: 'Group 1', children_ids: ['n1', 'n2'] },
        n1: { id: 'n1', name: 'Node 1', group_id: 'g1' },
        n2: { id: 'n2', name: 'Node 2', group_id: 'g1' },
      };

      const result = remapHierarchicalIds(['g1'], items, { parentRefField: 'group_id' });

      expect(result.newTopLevelIds).toHaveLength(1);
      const newG1Id = result.newTopLevelIds[0];
      expect(newG1Id).not.toBe('g1');

      const clonedG1 = result.newItems[newG1Id];
      expect(clonedG1).toBeDefined();
      expect(clonedG1.children_ids).toHaveLength(2);

      const newN1Id = clonedG1.children_ids![0];
      const newN2Id = clonedG1.children_ids![1];
      expect(newN1Id).not.toBe('n1');
      expect(newN2Id).not.toBe('n2');

      const clonedN1 = result.newItems[newN1Id];
      const clonedN2 = result.newItems[newN2Id];
      expect(clonedN1.group_id).toBe(newG1Id);
      expect(clonedN2.group_id).toBe(newG1Id);
    });
  });

  describe('resolveMapElementName', () => {
    it('keeps original name if not forced and not duplicate', () => {
      const existing = new Set(['WP 1', 'WP 2']);
      expect(resolveMapElementName('WP 3', { existingNames: existing, forceCopySuffix: false })).toBe('WP 3');
    });

    it('appends (Copy) if name already exists in existingNames', () => {
      const existing = new Set(['WP 1', 'WP 2']);
      expect(resolveMapElementName('WP 1', { existingNames: existing, forceCopySuffix: false })).toBe('WP 1 (Copy)');
    });

    it('increments Copy count if (Copy) already exists', () => {
      const existing = new Set(['WP 1', 'WP 1 (Copy)', 'WP 1 (Copy 2)']);
      expect(resolveMapElementName('WP 1', { existingNames: existing, forceCopySuffix: true })).toBe('WP 1 (Copy 3)');
    });

    it('always appends (Copy) if forceCopySuffix is true even if not yet in existingNames', () => {
      const existing = new Set(['WP 1']);
      expect(resolveMapElementName('WP 2', { existingNames: existing, forceCopySuffix: true })).toBe('WP 2 (Copy)');
    });
  });
});
