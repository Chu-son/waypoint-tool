"""Tests for the RectSweepGenerator plugin."""
import sys
import os
import math
import unittest
import importlib.util

_parent = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, _parent)

_spec = importlib.util.spec_from_file_location('rect_sweep_main', os.path.join(_parent, 'rect_sweep_generator', 'main.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
RectSweepGenerator = _mod.RectSweepGenerator


def _get_xy(wp):
    """Extract x, y from a waypoint dict (supports both flat and transform formats)."""
    if "transform" in wp:
        return wp["transform"]["x"], wp["transform"]["y"]
    return wp["x"], wp["y"]


class TestRectSweepGenerator(unittest.TestCase):
    """Requirement 4: Auto-generation — Rectangle sweep waypoint generation."""

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
        gen = RectSweepGenerator()
        result = gen.generate(self._make_context())
        self.assertEqual(result, [])

    def test_tiny_rectangle_returns_empty(self):
        """Rectangle with near-zero dimensions → empty list."""
        gen = RectSweepGenerator()
        ctx = self._make_context(rect={"center": {"x": 0, "y": 0}, "width": 0.001, "height": 0.001, "yaw": 0})
        result = gen.generate(ctx)
        self.assertEqual(result, [])

    def test_default_params_generate_expected_count(self):
        """Default params should generate num_lines * 2 waypoints."""
        gen = RectSweepGenerator()
        ctx = self._make_context(
            rect={"center": {"x": 5, "y": 5}, "width": 10, "height": 10, "yaw": 0},
            num_lines=4,
        )
        result = gen.generate(ctx)
        self.assertEqual(len(result), 8)  # 4 lines * 2 endpoints

    def test_start_corner_changes_start_position(self):
        """Different start_corner values produce different starting positions."""
        gen = RectSweepGenerator()
        rect = {"center": {"x": 0, "y": 0}, "width": 10, "height": 10, "yaw": 0}

        result_bl = gen.generate(self._make_context(rect=rect, start_corner="Bottom-Left"))
        result_tr = gen.generate(self._make_context(rect=rect, start_corner="Top-Right"))

        if len(result_bl) > 0 and len(result_tr) > 0:
            x_bl, y_bl = _get_xy(result_bl[0])
            x_tr, y_tr = _get_xy(result_tr[0])
            self.assertTrue(
                x_bl != x_tr or y_bl != y_tr,
                "Start positions should differ for different start corners"
            )

    def test_vertical_sweep_direction(self):
        """Vertical sweep direction should swap the axis of sweep."""
        gen = RectSweepGenerator()
        rect = {"center": {"x": 0, "y": 0}, "width": 10, "height": 10, "yaw": 0}

        result_h = gen.generate(self._make_context(rect=rect, sweep_direction="Horizontal"))
        result_v = gen.generate(self._make_context(rect=rect, sweep_direction="Vertical"))

        self.assertEqual(len(result_h), len(result_v))
        if len(result_h) > 0:
            coords_h = [_get_xy(r) for r in result_h]
            coords_v = [_get_xy(r) for r in result_v]
            self.assertNotEqual(coords_h, coords_v)

    def test_yaw_rotation_affects_coordinates(self):
        """Non-zero rectangle yaw should rotate all waypoint coordinates."""
        gen = RectSweepGenerator()
        rect_0 = {"center": {"x": 0, "y": 0}, "width": 10, "height": 10, "yaw": 0}
        rect_45 = {"center": {"x": 0, "y": 0}, "width": 10, "height": 10, "yaw": math.pi / 4}

        result_0 = gen.generate(self._make_context(rect=rect_0, num_lines=2))
        result_45 = gen.generate(self._make_context(rect=rect_45, num_lines=2))

        self.assertEqual(len(result_0), len(result_45))
        if len(result_0) > 0:
            x0, y0 = _get_xy(result_0[0])
            x45, y45 = _get_xy(result_45[0])
            self.assertTrue(
                abs(x0 - x45) > 0.1 or abs(y0 - y45) > 0.1,
                "Rotated coordinates should differ"
            )


if __name__ == '__main__':
    unittest.main()
