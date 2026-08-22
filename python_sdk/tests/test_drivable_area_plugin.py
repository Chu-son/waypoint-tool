"""Tests for DrivableAreaLayerGenerator and layer color helpers."""
import sys
import os
import json
import io
import unittest
import zlib
import base64

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from wpt_plugin import MapLayerGenerator, OccupancyGrid
from wpt_plugin.layer import _parse_color_rgba

# Import DrivableAreaLayerGenerator plugin
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'drivable_area_layer_generator'))
from main import DrivableAreaLayerGenerator


class TestLayerColorAndDrivableArea(unittest.TestCase):
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

    def test_parse_color_rgba(self):
        # Hex 6 chars
        c = _parse_color_rgba("#22c55e", default_alpha=150)
        self.assertEqual(c, (0x22, 0xc5, 0x5e, 150))

        # Hex 8 chars (includes alpha)
        c = _parse_color_rgba("#22c55eff", default_alpha=150)
        self.assertEqual(c, (0x22, 0xc5, 0x5e, 255))

        # Hex 3 chars
        c = _parse_color_rgba("#abc", default_alpha=180)
        self.assertEqual(c, (0xaa, 0xbb, 0xcc, 180))

        # Tuple / List
        c = _parse_color_rgba((10, 20, 30), default_alpha=200)
        self.assertEqual(c, (10, 20, 30, 200))

        c = _parse_color_rgba((10, 20, 30, 40))
        self.assertEqual(c, (10, 20, 30, 40))

    def test_create_layer_from_mask_with_hex(self):
        mask = [[1, 0], [0, 1]]
        layer = MapLayerGenerator.create_layer_from_mask(
            mask,
            origin=[0.0, 0.0, 0.0],
            resolution=0.1,
            name="Test Mask Layer",
            color_rgba="#3b82f6",
        )
        self.assertEqual(layer["name"], "Test Mask Layer")
        self.assertTrue(layer["image_base64"].startswith("data:image/png;base64,"))
        self.assertEqual(layer["info"]["width"], 2)
        self.assertEqual(layer["info"]["height"], 2)

    def test_drivable_area_generator_virtual_grid(self):
        gen = DrivableAreaLayerGenerator()
        context = {
            "properties": {
                "max_radius": 5.0,
                "layer_color": "#06b6d4",
                "fill_opacity": 0.8,
            },
            "interaction_data": {
                "seed_point": {"x": 1.0, "y": 2.0}
            }
        }
        res = gen.generate_layer(context)
        self.assertIn("image_base64", res)
        self.assertEqual(res["name"], "Drivable Area Overlay")
        self.assertEqual(res["info"]["resolution"], 0.05)

    def test_drivable_area_generator_with_grid_and_footprint(self):
        gen = DrivableAreaLayerGenerator()
        # 20x20 grid with obstacle at (10, 10)
        grid_data = self._create_mock_grid(20, 20, resolution=0.1, origin=(0.0, 0.0, 0.0), obstacles=[(10, 10)])
        context = {
            "occupancy_grid": grid_data,
            "robot_footprint": {
                "type": "circular",
                "radius": 0.25 # 2.5 cells clearance
            },
            "properties": {
                "max_radius": 1.0,
                "use_robot_footprint": True,
                "extra_margin": 0.05,
                "layer_color": "#ef4444",
                "fill_opacity": 0.5,
            },
            "interaction_data": {
                "seed_point": {"x": 0.2, "y": 0.2} # row 18, col 2 in grid
            }
        }
        res = gen.generate_layer(context)
        self.assertIn("image_base64", res)
        self.assertEqual(res["name"], "Drivable Area Layer")
    def test_occupancy_grid_semantic_apis_and_protocol(self):
        # 10x10 grid with custom metadata and signed int8 decoding
        raw = bytearray([0] * 100) # FREE = 0
        raw[2 * 10 + 3] = 100      # OBSTACLE = 100
        raw[5 * 10 + 5] = 255      # UNKNOWN = -1 in signed int8 (0xFF)
        b64 = base64.b64encode(zlib.compress(bytes(raw))).decode('ascii')
        grid_data = {
            "width": 10,
            "height": 10,
            "resolution": 0.1,
            "origin": [0.0, 0.0, 0.0],
            "encoding": "int8_zlib_base64",
            "cell_values": {
                "free": 0,
                "obstacle": 100,
                "unknown": -1
            },
            "data": b64,
        }
        grid = OccupancyGrid(grid_data)
        
        # Test semantic cell APIs
        self.assertTrue(grid.is_free_cell(0, 0))
        self.assertFalse(grid.is_obstacle_cell(0, 0))
        self.assertFalse(grid.is_unknown_cell(0, 0))
        self.assertEqual(grid.get_cell(0, 0), 0)

        self.assertTrue(grid.is_obstacle_cell(2, 3))
        self.assertFalse(grid.is_free_cell(2, 3))
        self.assertEqual(grid.get_cell(2, 3), 100)

        self.assertTrue(grid.is_unknown_cell(5, 5))
        self.assertFalse(grid.is_free_cell(5, 5))
        self.assertEqual(grid.get_cell(5, 5), -1)

        # Out of bounds should be unknown
        self.assertTrue(grid.is_unknown_cell(-1, 0))
        self.assertEqual(grid.get_cell(-1, 0), -1)

    def test_drivable_area_generator_allow_unknown(self):
        gen = DrivableAreaLayerGenerator()
        # 10x10 grid: (row 0..9). Center row 5 is UNKNOWN (255)
        raw = bytearray([OccupancyGrid.FREE] * 100)
        for c in range(10):
            raw[5 * 10 + c] = 255  # UNKNOWN
        b64 = base64.b64encode(zlib.compress(bytes(raw))).decode('ascii')
        grid_data = {
            "width": 10,
            "height": 10,
            "resolution": 0.1,
            "origin": [0.0, 0.0, 0.0],
            "data": b64,
        }

        # Case 1: allow_unknown = False (Conservative) -> Cannot cross unknown row
        context_conservative = {
            "occupancy_grid": grid_data,
            "properties": {
                "max_radius": 1.0,
                "use_robot_footprint": False,
                "allow_unknown": False,
            },
            "interaction_data": {
                "seed_point": {"x": 0.2, "y": 0.2} # row 7, col 2 in grid
            }
        }
        res1 = gen.generate_layer(context_conservative)
        self.assertIn("image_base64", res1)

        # Case 2: allow_unknown = True (Optimistic) -> Can traverse unknown space
        context_optimistic = {
            "occupancy_grid": grid_data,
            "properties": {
                "max_radius": 1.0,
                "use_robot_footprint": False,
                "allow_unknown": True,
            },
            "interaction_data": {
                "seed_point": {"x": 0.2, "y": 0.2}
            }
        }
        res2 = gen.generate_layer(context_optimistic)
        self.assertIn("image_base64", res2)

    def test_drivable_area_generator_multiple_seed_points(self):
        gen = DrivableAreaLayerGenerator()
        # 30x30 free grid
        grid_data = self._create_mock_grid(30, 30, resolution=0.1, origin=(0.0, 0.0, 0.0))
        context = {
            "occupancy_grid": grid_data,
            "properties": {
                "max_radius": 0.5,
                "use_robot_footprint": False,
            },
            "interaction_data": {
                "seed_points": [
                    {"x": 0.5, "y": 0.5},
                    {"x": 2.0, "y": 2.0},
                ]
            }
        }
        res = gen.generate_layer(context)
        self.assertIn("image_base64", res)
        self.assertEqual(res["name"], "Drivable Area Layer")
        self.assertEqual(res["info"]["width"], 30)
        self.assertEqual(res["info"]["height"], 30)


if __name__ == '__main__':
    unittest.main()
