"""Tests for the SweepPathGenerator plugin."""
import sys
import os
import math
import unittest

import importlib.util

_parent = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, _parent)

# Use importlib to avoid name collision with other main.py modules
_spec = importlib.util.spec_from_file_location('sweep_main', os.path.join(_parent, 'sweep_generator', 'main.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
SweepPathGenerator = _mod.SweepPathGenerator


def _get_xy(wp):
    """Extract x, y from a waypoint dict (transform format)."""
    return wp["transform"]["x"], wp["transform"]["y"]


class TestSweepPathGenerator(unittest.TestCase):
    """Requirement 4: Auto-generation — Sweep waypoint generation."""

    def _make_context(self, start_point=None, num_lines=3, pitch_x=1.0, pitch_y=1.0, snake_pattern=False):
        return {
            "properties": {
                "num_lines": num_lines,
                "pitch_x": pitch_x,
                "pitch_y": pitch_y,
                "snake_pattern": snake_pattern,
            },
            "interaction_data": {
                "start_point": start_point or {}
            }
        }

    def test_no_start_point_returns_empty(self):
        """No start point defined → empty list."""
        gen = SweepPathGenerator()
        result = gen.generate(self._make_context())
        self.assertEqual(result, [])

    def test_normal_mode_generates_start_end_pairs(self):
        """Each line has start and end points (2 per line)."""
        gen = SweepPathGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_lines=3,
        )
        result = gen.generate(ctx)
        # 3 lines * 2 points = 6 waypoints
        self.assertEqual(len(result), 6)

    def test_output_uses_transform_format(self):
        """Waypoints must use the standard transform format."""
        gen = SweepPathGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_lines=1,
        )
        result = gen.generate(ctx)
        self.assertTrue(len(result) > 0)
        self.assertIn("transform", result[0])
        self.assertIn("x", result[0]["transform"])
        self.assertIn("qw", result[0]["transform"])

    def test_snake_pattern_reverses_even_lines(self):
        """Snake pattern alternates direction on each line."""
        gen = SweepPathGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_lines=2,
            pitch_x=2.0,
            pitch_y=1.0,
            snake_pattern=True,
        )
        result = gen.generate(ctx)
        # Line 1 snake: should be reversed
        line1_start_x = _get_xy(result[2])[0]
        line1_end_x = _get_xy(result[3])[0]
        # In snake mode, line1 should go in reverse X direction
        self.assertGreaterEqual(line1_start_x, line1_end_x)

    def test_pitch_affects_spacing(self):
        """pitch_y separates the lines vertically."""
        gen = SweepPathGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_lines=2,
            pitch_y=3.0,
        )
        result = gen.generate(ctx)
        y_values = set(round(_get_xy(r)[1], 3) for r in result)
        # Should have 2 distinct Y values separated by pitch_y=3.0
        self.assertEqual(len(y_values), 2)


if __name__ == '__main__':
    unittest.main()
