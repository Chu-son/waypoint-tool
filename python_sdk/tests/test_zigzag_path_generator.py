"""Tests for the ZigzagPathGenerator plugin."""
import sys
import os
import math
import unittest
import importlib.util

_parent = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, _parent)

# Use importlib to avoid name collision with other main.py modules
_spec = importlib.util.spec_from_file_location('zigzag_main', os.path.join(_parent, 'zigzag_path_generator', 'main.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
ZigzagPathGenerator = _mod.ZigzagPathGenerator


def _get_xy(wp):
    """Extract x, y from a waypoint dict (transform format)."""
    return wp["transform"]["x"], wp["transform"]["y"]


class TestZigzagPathGenerator(unittest.TestCase):
    """Zigzag waypoint generation."""

    def _make_context(self, start_point=None, num_lines=3, pitch_x=1.0, pitch_y=1.0):
        return {
            "properties": {
                "num_lines": num_lines,
                "pitch_x": pitch_x,
                "pitch_y": pitch_y,
            },
            "interaction_data": {
                "start_point": start_point or {}
            }
        }

    def test_no_start_point_returns_empty(self):
        """No start point defined → empty list."""
        gen = ZigzagPathGenerator()
        result = gen.generate(self._make_context())
        self.assertEqual(result, [])

    def test_normal_mode_generates_start_end_pairs(self):
        """Each line has start and end points (2 per line)."""
        gen = ZigzagPathGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_lines=3,
        )
        result = gen.generate(ctx)
        # 3 lines * 2 points = 6 waypoints
        self.assertEqual(len(result), 6)

    def test_output_uses_transform_format(self):
        """Waypoints must use the standard transform format."""
        gen = ZigzagPathGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_lines=1,
        )
        result = gen.generate(ctx)
        self.assertTrue(len(result) > 0)
        self.assertIn("transform", result[0])
        self.assertIn("x", result[0]["transform"])
        self.assertIn("qw", result[0]["transform"])

    def test_zigzag_pattern_is_always_forward(self):
        """Zigzag (Non-snake) pattern: all lines go in the same direction."""
        gen = ZigzagPathGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_lines=2,
            pitch_x=2.0,
            pitch_y=1.0,
        )
        result = gen.generate(ctx)
        # Line 0: 0 -> 2
        # Line 1: 0 -> 2 (since snake_pattern logic was removed)
        l0_start_x = _get_xy(result[0])[0]
        l0_end_x = _get_xy(result[1])[0]
        l1_start_x = _get_xy(result[2])[0]
        l1_end_x = _get_xy(result[3])[0]
        
        self.assertEqual(l0_start_x, 0.0)
        self.assertEqual(l0_end_x, 2.0)
        self.assertEqual(l1_start_x, 0.0)
        self.assertEqual(l1_end_x, 2.0)

    def test_pitch_affects_spacing(self):
        """pitch_y separates the lines vertically."""
        gen = ZigzagPathGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_lines=2,
            pitch_y=3.0,
        )
        result = gen.generate(ctx)
        y_values = sorted(list(set(round(_get_xy(r)[1], 3) for r in result)))
        self.assertEqual(len(y_values), 2)
        self.assertAlmostEqual(y_values[1] - y_values[0], 3.0)


if __name__ == '__main__':
    unittest.main()
