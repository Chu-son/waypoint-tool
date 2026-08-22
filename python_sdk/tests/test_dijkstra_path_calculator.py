import unittest
import base64
import zlib
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from wpt_plugin.path import PathCalculator
from wpt_plugin.occupancy_grid import OccupancyGrid


class TestDijkstraPathCalculator(unittest.TestCase):
    def setUp(self):
        self.calc = PathCalculator()
        # 10x10 grid with obstacle in the center (row 5, col 5)
        raw = bytearray([0] * 100)
        raw[5 * 10 + 5] = 100
        raw[5 * 10 + 4] = 100
        raw[5 * 10 + 6] = 100
        b64 = base64.b64encode(zlib.compress(bytes(raw))).decode('ascii')
        self.grid_data = {
            "width": 10,
            "height": 10,
            "resolution": 0.1,
            "origin": [0.0, 0.0, 0.0],
            "data": b64,
        }

    def test_calculate_path_avoid_obstacles_true(self):
        context = {
            "waypoints": [
                {"x": 0.1, "y": 0.5},
                {"x": 0.9, "y": 0.5},
            ],
            "occupancy_grid": self.grid_data,
            "properties": {
                "avoid_obstacles": True,
                "use_robot_footprint": False,
                "safety_margin": 0.05,
            }
        }
        segments = self.calc.calculate_path(context)
        self.assertEqual(len(segments), 1)
        self.assertTrue(len(segments[0]) > 2) # Should detour around obstacle

    def test_calculate_path_avoid_obstacles_false(self):
        context = {
            "waypoints": [
                {"x": 0.1, "y": 0.5},
                {"x": 0.9, "y": 0.5},
            ],
            "occupancy_grid": self.grid_data,
            "properties": {
                "avoid_obstacles": False,
            }
        }
        segments = self.calc.calculate_path(context)
        self.assertEqual(len(segments), 1)
        self.assertEqual(len(segments[0]), 2) # Direct straight line (start and goal)
        self.assertAlmostEqual(segments[0][0].x, 0.1)
        self.assertAlmostEqual(segments[0][1].x, 0.9)

    def test_calculate_path_with_robot_footprint(self):
        context = {
            "waypoints": [
                {"x": 0.1, "y": 0.5},
                {"x": 0.9, "y": 0.5},
            ],
            "occupancy_grid": self.grid_data,
            "robot_footprint": {
                "type": "circular",
                "radius": 0.1,
            },
            "properties": {
                "avoid_obstacles": True,
                "use_robot_footprint": True,
                "safety_margin": 0.05,
            }
        }
        segments = self.calc.calculate_path(context)
        self.assertEqual(len(segments), 1)
        self.assertTrue(len(segments[0]) > 2)

    def test_calculate_path_long_distance_detour(self):
        # 100x100 grid (resolution 0.05 -> 5.0m x 5.0m)
        # Wall across the middle at col 50, from row 20 to row 100 (blocks y=0..4.0m, leaves gap at rows 0..19 where y >= 4.0m)
        raw = bytearray([0] * (100 * 100))
        for r in range(20, 100):
            raw[r * 100 + 50] = 100

        b64 = base64.b64encode(zlib.compress(bytes(raw))).decode('ascii')
        grid_data = {
            "width": 100,
            "height": 100,
            "resolution": 0.05,
            "origin": [0.0, 0.0, 0.0],
            "data": b64,
        }

        # Start at (1.0m, 1.0m), Goal at (4.0m, 1.0m)
        context = {
            "waypoints": [
                {"x": 1.0, "y": 1.0},
                {"x": 4.0, "y": 1.0},
            ],
            "occupancy_grid": grid_data,
            "properties": {
                "avoid_obstacles": True,
                "use_robot_footprint": False,
                "safety_margin": 0.1,
            }
        }
        segments = self.calc.calculate_path(context)
        self.assertEqual(len(segments), 1)
        # Path must detour around wall (y must reach around y >= 4.0m where the gap is)
        path = segments[0]
        self.assertTrue(len(path) > 2)
        max_y = max(p.y for p in path)
        self.assertGreater(max_y, 3.8) # Successfully detoured through the gap at top!

    def test_calculate_path_near_obstacle_start_snapping(self):
        # Start is placed right next to obstacle (within clearance)
        context = {
            "waypoints": [
                {"x": 0.45, "y": 0.5}, # very close to obstacle at (0.5, 0.5)
                {"x": 0.9, "y": 0.5},
            ],
            "occupancy_grid": self.grid_data,
            "properties": {
                "avoid_obstacles": True,
                "use_robot_footprint": False,
                "safety_margin": 0.1,
            }
        }
        segments = self.calc.calculate_path(context)
        self.assertEqual(len(segments), 1)
        self.assertTrue(len(segments[0]) > 2)


if __name__ == '__main__':
    unittest.main()
