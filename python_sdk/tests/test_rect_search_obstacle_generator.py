"""Tests for the RectSearchGenerator plugin."""
import sys
import os
import math
import unittest
import importlib.util

_parent = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, _parent)

_spec = importlib.util.spec_from_file_location('rect_search_obstacle_main', os.path.join(_parent, 'rect_search_obstacle_generator', 'main.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
RectSearchObstacleGenerator = _mod.RectSearchObstacleGenerator


def _get_xy(wp):
    """Extract x, y from a waypoint dict (transform format)."""
    return wp["transform"]["x"], wp["transform"]["y"]


class TestRectSearchObstacleGenerator(unittest.TestCase):
    """Rectangle search waypoint generation."""

    def _make_context(self, rect=None, num_lines=3, start_corner="Bottom-Left",
                      sweep_direction="Horizontal"):
        return {
            "properties": {
                "num_lines": num_lines,
                "start_corner": start_corner,
                "sweep_direction": sweep_direction,
            },
            "interaction_data": {
                "sweep_rect": rect or {}
            }
        }

    def test_no_rectangle_returns_empty(self):
        """No rectangle defined → empty list."""
        gen = RectSearchObstacleGenerator()
        result = gen.generate(self._make_context())
        self.assertEqual(result, [])

    def test_default_params_generate_expected_count(self):
        """Default params should generate num_lines * 2 waypoints."""
        gen = RectSearchObstacleGenerator()
        ctx = self._make_context(
            rect={"center": {"x": 5, "y": 5}, "width": 10, "height": 10, "yaw": 0},
            num_lines=4,
        )
        result = gen.generate(ctx)
        self.assertEqual(len(result), 8)  # 4 lines * 2 endpoints

    def test_comb_behavior_all_lines_same_direction(self):
        """Confirm all lines go in the same direction (comb pattern L->R)."""
        gen = RectSearchObstacleGenerator()
        rect = {"center": {"x": 0, "y": 0}, "width": 10, "height": 10, "yaw": 0}
        ctx = self._make_context(rect=rect, num_lines=2)
        result = gen.generate(ctx)
        
        # Line 0: BL -> BR
        # Line 1: BL -> BR (same direction, not reversed)
        x0_s, _ = _get_xy(result[0])
        x0_e, _ = _get_xy(result[1])
        x1_s, _ = _get_xy(result[2])
        x1_e, _ = _get_xy(result[3])
        
        self.assertTrue(x0_e > x0_s)
        self.assertTrue(x1_e > x1_s)

    def test_start_corner_changes_start_position(self):
        """Different start_corner values produce different starting positions."""
        gen = RectSearchObstacleGenerator()
        rect = {"center": {"x": 0, "y": 0}, "width": 10, "height": 10, "yaw": 0}

        result_bl = gen.generate(self._make_context(rect=rect, start_corner="Bottom-Left"))
        result_tr = gen.generate(self._make_context(rect=rect, start_corner="Top-Right"))

        x_bl, y_bl = _get_xy(result_bl[0])
        x_tr, y_tr = _get_xy(result_tr[0])
        self.assertTrue(x_bl != x_tr or y_bl != y_tr)


if __name__ == '__main__':
    unittest.main()
