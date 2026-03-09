"""Tests for the LinePathGenerator plugin."""
import sys
import os
import unittest
import importlib.util

_parent = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, _parent)

_spec = importlib.util.spec_from_file_location('line_main', os.path.join(_parent, 'line_path_generator', 'main.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
LinePathGenerator = _mod.LinePathGenerator


def _get_xy(wp):
    """Extract x, y from a waypoint dict (transform format)."""
    return wp["transform"]["x"], wp["transform"]["y"]


class TestLinePathGenerator(unittest.TestCase):
    """Line waypoint generation."""

    def _make_context(self, start_point=None, num_points=5, spacing=1.0):
        return {
            "properties": {"num_points": num_points, "spacing": spacing},
            "interaction_data": {
                "start_point": start_point or {}
            }
        }

    def test_no_start_point_returns_empty(self):
        """No start point defined → empty list."""
        gen = LinePathGenerator()
        result = gen.generate(self._make_context(start_point=None))
        self.assertEqual(result, [])

    def test_default_params_generate_correct_count(self):
        """Default parameters generate the specified number of waypoints."""
        gen = LinePathGenerator()
        ctx = self._make_context(start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1})
        result = gen.generate(ctx)
        self.assertEqual(len(result), 5)

    def test_spacing_affects_coordinates(self):
        """Waypoints are spaced according to the spacing parameter."""
        gen = LinePathGenerator()
        ctx = self._make_context(
            start_point={"x": 0, "y": 0, "qx": 0, "qy": 0, "qz": 0, "qw": 1},
            num_points=3,
            spacing=2.0,
        )
        result = gen.generate(ctx)
        x0, _ = _get_xy(result[0])
        x1, _ = _get_xy(result[1])
        x2, _ = _get_xy(result[2])
        self.assertAlmostEqual(x0, 0.0, places=5)
        self.assertAlmostEqual(x1, 2.0, places=5)
        self.assertAlmostEqual(x2, 4.0, places=5)


if __name__ == '__main__':
    unittest.main()
