import unittest
import math
import zlib
import base64
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from wpt_plugin import RobotFootprint, Point, OccupancyGrid
from wpt_plugin.core import WaypointGenerator


class DummyGenerator(WaypointGenerator):
    def generate(self, context):
        return []


class TestRobotFootprint(unittest.TestCase):
    def test_circular_footprint(self):
        fp = RobotFootprint.circular(radius=0.5)
        self.assertEqual(fp.type, "circular")
        self.assertEqual(fp.radius, 0.5)
        self.assertAlmostEqual(fp.get_bounding_radius(), 0.5)

        # In local frame at robot pose (10, 20, 0)
        self.assertTrue(fp.is_point_inside(10.2, 20.2, 10.0, 20.0, 0.0))
        self.assertFalse(fp.is_point_inside(11.0, 20.0, 10.0, 20.0, 0.0))

        # to_polygon
        poly = fp.to_polygon(num_circle_segments=8)
        self.assertEqual(len(poly), 8)

        # to_world
        world_pts = fp.to_world(5.0, 5.0, 0.0, num_circle_segments=4)
        self.assertEqual(len(world_pts), 4)

    def test_rectangular_footprint(self):
        fp = RobotFootprint.rectangular(length=0.8, width=0.4, offset_x=0.0, offset_y=0.0)
        self.assertEqual(fp.type, "rectangular")
        self.assertAlmostEqual(fp.get_bounding_radius(), math.hypot(0.4, 0.2))

        # Test at origin, yaw = 0
        self.assertTrue(fp.is_point_inside(0.3, 0.1, 0.0, 0.0, 0.0))
        self.assertFalse(fp.is_point_inside(0.5, 0.1, 0.0, 0.0, 0.0))
        self.assertFalse(fp.is_point_inside(0.3, 0.3, 0.0, 0.0, 0.0))

        # Test at origin, yaw = pi/2 (Rotated 90 deg: X length is now along Y axis)
        self.assertTrue(fp.is_point_inside(0.1, 0.3, 0.0, 0.0, math.pi / 2))
        self.assertFalse(fp.is_point_inside(0.3, 0.1, 0.0, 0.0, math.pi / 2))

    def test_polygon_footprint(self):
        fp = RobotFootprint.polygon([
            [0.3, 0.2],
            [-0.3, 0.2],
            [-0.3, -0.2],
            [0.3, -0.2],
        ])
        self.assertEqual(fp.type, "polygon")
        self.assertEqual(len(fp.points), 4)

        self.assertTrue(fp.is_point_inside(0.0, 0.0, 0.0, 0.0, 0.0))
        self.assertTrue(fp.is_point_inside(0.25, 0.15, 0.0, 0.0, 0.0))
        self.assertFalse(fp.is_point_inside(0.35, 0.0, 0.0, 0.0, 0.0))

    def test_from_dict_validation_and_errors(self):
        # Valid dicts
        fp_circ = RobotFootprint.from_dict({"type": "circular", "radius": 0.35})
        self.assertEqual(fp_circ.radius, 0.35)

        fp_rect = RobotFootprint.from_dict({"type": "rectangular", "length": 0.6, "width": 0.4})
        self.assertEqual(fp_rect.length, 0.6)
        self.assertEqual(fp_rect.offset_x, 0.0)

        fp_poly = RobotFootprint.from_dict({"type": "polygon", "points": [[0, 0], [1, 0], [0, 1]]})
        self.assertEqual(len(fp_poly.points), 3)

        # Invalid type
        with self.assertRaises(ValueError):
            RobotFootprint.from_dict({"type": "triangle"})

        # Missing required keys
        with self.assertRaises(KeyError):
            RobotFootprint.from_dict({"type": "circular"})  # missing radius

        with self.assertRaises(KeyError):
            RobotFootprint.from_dict({"type": "rectangular", "length": 0.5})  # missing width

        with self.assertRaises(KeyError):
            RobotFootprint.from_dict({"type": "polygon"})  # missing points

        # Invalid dimensions
        with self.assertRaises(ValueError):
            RobotFootprint.circular(-0.1)

        with self.assertRaises(ValueError):
            RobotFootprint.rectangular(length=-0.5, width=0.4)

        with self.assertRaises(ValueError):
            RobotFootprint.polygon([[0, 0], [1, 1]])  # less than 3 points

    def test_get_robot_footprint_from_context(self):
        gen = DummyGenerator()
        ctx_with_fp = {
            "robot_footprint": {
                "type": "rectangular",
                "length": 0.6,
                "width": 0.4,
            }
        }
        fp = gen.get_robot_footprint(ctx_with_fp)
        self.assertIsNotNone(fp)
        self.assertEqual(fp.type, "rectangular")
        self.assertEqual(fp.length, 0.6)

        ctx_empty = {}
        fp_none = gen.get_robot_footprint(ctx_empty)
        self.assertIsNone(fp_none)

    def test_occupancy_grid_footprint_collision(self):
        width = 10
        height = 10
        raw_cells = [0] * (width * height)
        raw_cells[5 * width + 5] = 100

        compressed = base64.b64encode(zlib.compress(bytes(raw_cells))).decode("ascii")
        grid_data = {
            "width": width,
            "height": height,
            "resolution": 0.1,
            "origin": [0.0, 0.0, 0.0],
            "data": compressed,
        }
        grid = OccupancyGrid(grid_data)

        fp_circ = RobotFootprint.circular(radius=0.2)
        self.assertTrue(grid.is_footprint_colliding(fp_circ, 0.55, 0.45, 0.0))
        self.assertFalse(grid.is_footprint_colliding(fp_circ, 0.1, 0.1, 0.0))

        fp_rect = RobotFootprint.rectangular(length=0.4, width=0.2)
        self.assertTrue(grid.is_footprint_colliding(fp_rect, 0.4, 0.45, 0.0))
        self.assertFalse(grid.is_footprint_colliding(fp_rect, 0.2, 0.45, 0.0))


if __name__ == "__main__":
    unittest.main()
