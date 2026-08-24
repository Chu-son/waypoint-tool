"""Tests for DrivableAreaAnnotationGenerator."""
import sys
import os
import unittest
import zlib
import base64

import importlib.util

_parent = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, _parent)
from wpt_plugin import OccupancyGrid

_spec = importlib.util.spec_from_file_location('drivable_area_anno_main', os.path.join(_parent, 'drivable_area_annotation_generator', 'main.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
DrivableAreaAnnotationGenerator = _mod.DrivableAreaAnnotationGenerator


class TestDrivableAreaAnnotationGenerator(unittest.TestCase):
    def _create_mock_grid(self, width, height, resolution=0.05, origin=(0.0, 0.0, 0.0), obstacles=None):
        raw = bytearray([OccupancyGrid.FREE] * (width * height))
        if obstacles:
            for r, c in obstacles:
                if 0 <= r < height and 0 <= c < width:
                    raw[r * width + c] = OccupancyGrid.OBSTACLE
        b64 = base64.b64encode(zlib.compress(bytes(raw))).decode('ascii')
        return {
            "width": width,
            "height": height,
            "resolution": resolution,
            "origin": list(origin),
            "data": b64
        }

    def test_virtual_grid_with_annotation_points(self):
        gen = DrivableAreaAnnotationGenerator()
        context = {
            "interaction_data": {
                "seed_annotations": [
                    {"id": "pt-1", "type": "point", "x": 1.0, "y": 2.0},
                    {"id": "pt-2", "type": "point", "x": 3.0, "y": 4.0},
                ]
            },
            "properties": {
                "max_radius": 2.0,
                "layer_color": "#3b82f6",
                "fill_opacity": 0.5
            }
        }
        res = gen.generate_layer(context)
        self.assertIsNotNone(res)
        self.assertEqual(res["name"], "Drivable Area (Annotations)")
        self.assertTrue(res["image_base64"].startswith("data:image/png;base64,"))

    def test_with_occupancy_grid(self):
        gen = DrivableAreaAnnotationGenerator()
        mock_grid = self._create_mock_grid(20, 20, resolution=0.1, origin=(0.0, 0.0, 0.0))
        context = {
            "occupancy_grid": mock_grid,
            "interaction_data": {
                "seed_annotations": [
                    {"id": "pt-1", "type": "point", "x": 0.5, "y": 0.5}
                ]
            },
            "properties": {
                "max_radius": 1.0,
                "use_robot_footprint": False,
                "extra_margin": 0.0
            }
        }
        res = gen.generate_layer(context)
        self.assertIsNotNone(res)
        self.assertEqual(res["info"]["width"], 20)
        self.assertEqual(res["info"]["height"], 20)


if __name__ == '__main__':
    unittest.main()
