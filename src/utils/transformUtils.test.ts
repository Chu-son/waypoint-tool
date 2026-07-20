import { describe, it, expect, vi } from 'vitest';
import { quaternionToYaw, yawToQuaternion, applyElementPaste, calculateAnchorRelativeTransform } from './transformUtils';
import { WaypointNode } from '../types/store';
import { ElementCopyState } from '../stores/slices/uiSlice';

describe('transformUtils', () => {
  it('quaternionToYaw and yawToQuaternion convert correctly', () => {
    const yaw = Math.PI / 4; // 45 deg
    const q = yawToQuaternion(yaw);
    const convertedYaw = quaternionToYaw(q);
    expect(convertedYaw).toBeCloseTo(yaw);
  });

  it('calculateAnchorRelativeTransform calculates relative offset correctly', () => {
    const anchorTf = { x: 10, y: 10, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    const targetTf = { x: 15, y: 15, z: 2, qx: 0, qy: 0, qz: 0, qw: 1 };
    const rel = calculateAnchorRelativeTransform(targetTf, anchorTf);

    expect(rel.relX).toBeCloseTo(5);
    expect(rel.relY).toBeCloseTo(5);
    expect(rel.relZ).toBeCloseTo(2);
    expect(rel.relYaw).toBeCloseTo(0);
  });

  describe('applyElementPaste', () => {
    const anchorNode: WaypointNode = {
      id: 'anchor-1',
      type: 'manual',
      transform: { x: 10, y: 20, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 }, // Yaw = 0
    };

    const targetNode: WaypointNode = {
      id: 'target-1',
      type: 'manual',
      transform: { x: 15, y: 25, z: 1, qx: 0, qy: 0, qz: 0, qw: 1 },
    };

    const nodes = {
      [anchorNode.id]: anchorNode,
      [targetNode.id]: targetNode,
    };

    it('pastes World X value', () => {
      const updateNode = vi.fn();
      const copyState: ElementCopyState = {
        field: 'x',
        value: 100,
        coordSystem: 'world',
        previewNodeId: targetNode.id,
      };

      applyElementPaste(targetNode, copyState, null, nodes, updateNode);
      expect(updateNode).toHaveBeenCalledWith('target-1', {
        transform: { ...targetNode.transform, x: 100 },
      });
    });

    it('pastes World Yaw value', () => {
      const updateNode = vi.fn();
      const yawVal = Math.PI / 2;
      const copyState: ElementCopyState = {
        field: 'yaw',
        value: yawVal,
        coordSystem: 'world',
        previewNodeId: targetNode.id,
      };

      applyElementPaste(targetNode, copyState, null, nodes, updateNode);
      const q = yawToQuaternion(yawVal);
      expect(updateNode).toHaveBeenCalledWith('target-1', {
        transform: { ...targetNode.transform, ...q },
      });
    });

    it('pastes Anchor-relative X value', () => {
      const updateNode = vi.fn();
      // Anchor at (10, 20), Yaw = 0. target is at (15, 25) => relX = 5, relY = 5.
      // Copy relX = 12. New target X should be 10 + 12 = 22, Y stays 25.
      const copyState: ElementCopyState = {
        field: 'x',
        value: 12,
        coordSystem: 'anchor',
        previewNodeId: targetNode.id,
      };

      applyElementPaste(targetNode, copyState, 'anchor-1', nodes, updateNode);
      expect(updateNode).toHaveBeenCalledWith('target-1', {
        transform: { ...targetNode.transform, x: 22, y: 25 },
      });
    });

    it('pastes Anchor-relative Yaw value', () => {
      const updateNode = vi.fn();
      // Anchor Yaw = 0, copy relYaw = Math.PI / 2. New target Yaw = Math.PI / 2.
      const copyState: ElementCopyState = {
        field: 'yaw',
        value: Math.PI / 2,
        coordSystem: 'anchor',
        previewNodeId: targetNode.id,
      };

      applyElementPaste(targetNode, copyState, 'anchor-1', nodes, updateNode);
      const q = yawToQuaternion(Math.PI / 2);
      expect(updateNode).toHaveBeenCalledWith('target-1', {
        transform: { ...targetNode.transform, ...q },
      });
    });

    it('logs error and cancels paste if anchor is missing for anchor-relative paste (no fallback)', () => {
      const updateNode = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const copyState: ElementCopyState = {
        field: 'x',
        value: 12,
        coordSystem: 'anchor',
        previewNodeId: targetNode.id,
      };

      // Pass null anchorNodeId
      applyElementPaste(targetNode, copyState, null, nodes, updateNode);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('anchorNode is missing'),
        expect.anything()
      );
      expect(updateNode).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
