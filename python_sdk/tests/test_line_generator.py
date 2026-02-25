"""Tests for the LineGenerator plugin."""
import sys
import os
import math
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'line_generator'))
from main import LineGenerator


class TestLineGenerator(unittest.TestCase):
    """Requirement 4: Auto-generation — Line waypoint generation."""

    def _make_context(self, start_point=None, num_points=5, spacing=1.0):
        return {
            "properties": {"num_points": num_points, "spacing": spacing},
            "interaction_data": {
                "start_point": start_point or {}
            }
        }

    def test_no_start_point_returns_empty(self):
        """No start point defined → empty list."""
        gen = LineGenerator()
        result = gen.generate(self._make_context(start_point=None))
        self.assertEqual(result, [])

    def test_default_params_generate_correct_count(self):
        """Default parameters generate the specified number of waypoints."""
        gen = LineGenerator()
        ctx = self._make_context(start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1})
        result = gen.generate(ctx)
        self.assertEqual(len(result), 5)

    def test_spacing_affects_coordinates(self):
        """Waypoints are spaced according to the spacing parameter."""
        gen = LineGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_points=3,
            spacing=2.0,
        )
        result = gen.generate(ctx)
        # All points along x-axis (yaw=0 → direction = +x)
        self.assertAlmostEqual(result[0]["x"], 0.0, places=5)
        self.assertAlmostEqual(result[1]["x"], 2.0, places=5)
        self.assertAlmostEqual(result[2]["x"], 4.0, places=5)

    def test_yaw_direction_affects_placement(self):
        """Points are placed along the start point's yaw direction."""
        gen = LineGenerator()
        # yaw=π/2 → direction = +y
        half = math.pi / 4.0
        qz = math.sin(half)
        qw = math.cos(half)
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": qz, "qw": qw},
            num_points=2,
            spacing=1.0,
        )
        result = gen.generate(ctx)
        # Second point should be ~(0, 1) since direction is +y
        self.assertAlmostEqual(result[1]["x"], 0.0, places=2)
        self.assertAlmostEqual(result[1]["y"], 1.0, places=2)


if __name__ == '__main__':
    unittest.main()
